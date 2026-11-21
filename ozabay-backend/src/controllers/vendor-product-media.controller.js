import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import mongoose from "mongoose";
import VendorProduct from "../models/vendor-product.model.js";
import VendorProductMediaUpload from "../models/vendor-product-media-upload.model.js";
import {
  cleanupExpiredVendorProductMediaUploads,
  combineVendorProductMediaUpload,
  deleteVendorProductMedia,
  deleteVendorProductMediaUploadParts,
  getVendorProductMediaBucket,
  getVendorProductMediaPath,
  isValidVendorProductMediaSignature,
  mediaChunkSize,
  mediaMaxFileSize,
} from "../services/vendor-product-media.service.js";

const allowedMediaTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
]);
const uploadExpirationMs = 2 * 60 * 60 * 1000;

const createMediaUpload = async (req, res, next) => {
  try {
    const { field, originalName, contentType, size } = req.body || {};
    if (
      !["images", "video"].includes(field)
      || typeof contentType !== "string"
      || (field === "images" && !contentType.startsWith("image/"))
      || (field === "video" && !contentType.startsWith("video/"))
      || !allowedMediaTypes.has(contentType)
      || typeof originalName !== "string"
      || !originalName.trim()
      || originalName.length > 255
      || !Number.isInteger(size)
      || size < 1
      || size > mediaMaxFileSize
    ) {
      return res.status(400).json({ message: "Invalid product media upload details" });
    }

    await cleanupExpiredVendorProductMediaUploads();
    const chunkCount = Math.ceil(size / mediaChunkSize);
    const upload = await VendorProductMediaUpload.create({
      vendorId: req.authUserId,
      field,
      originalName: originalName.trim(),
      contentType,
      size,
      chunkCount,
      expiresAt: new Date(Date.now() + uploadExpirationMs),
    });
    return res.status(201).json({
      uploadId: upload._id,
      chunkSize: mediaChunkSize,
      chunkCount,
    });
  } catch (error) {
    return next(error);
  }
};

const uploadMediaChunk = async (req, res, next) => {
  let chunkFileId;
  try {
    if (!mongoose.isValidObjectId(req.params.uploadId)) {
      return res.status(404).json({ message: "Media upload not found" });
    }
    const upload = await VendorProductMediaUpload.findOne({
      _id: req.params.uploadId,
      vendorId: req.authUserId,
      status: "uploading",
      expiresAt: { $gt: new Date() },
    });
    if (!upload) {
      return res.status(404).json({ message: "Media upload not found or has expired" });
    }

    const chunkIndex = Number(req.params.chunkIndex);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= upload.chunkCount) {
      return res.status(400).json({ message: "Invalid media chunk number" });
    }
    if (upload.chunks.some((chunk) => chunk.index === chunkIndex)) {
      return res.status(409).json({ message: "This media chunk has already been uploaded" });
    }
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ message: "A binary media chunk is required" });
    }

    const expectedSize = Math.min(mediaChunkSize, upload.size - chunkIndex * mediaChunkSize);
    if (req.body.length !== expectedSize) {
      return res.status(400).json({ message: "The uploaded media chunk has an invalid size" });
    }
    if (
      chunkIndex === 0
      && !isValidVendorProductMediaSignature(upload.contentType, req.body.subarray(0, 12))
    ) {
      return res.status(400).json({ message: "The uploaded file does not match its selected image or video type" });
    }

    const bucket = getVendorProductMediaBucket();
    const chunkStream = bucket.openUploadStream(`temporary-${upload._id}-${chunkIndex}`, {
      metadata: {
        temporary: true,
        uploadId: String(upload._id),
        chunkIndex,
        vendorId: String(req.authUserId),
      },
    });
    chunkFileId = chunkStream.id;
    await pipeline(Readable.from([req.body]), chunkStream);

    const updated = await VendorProductMediaUpload.updateOne(
      {
        _id: upload._id,
        vendorId: req.authUserId,
        status: "uploading",
        "chunks.index": { $ne: chunkIndex },
      },
      {
        $push: { chunks: { index: chunkIndex, fileId: chunkFileId } },
        $set: { expiresAt: new Date(Date.now() + uploadExpirationMs) },
      },
    );
    if (updated.modifiedCount !== 1) {
      await bucket.delete(chunkFileId);
      return res.status(409).json({ message: "This media upload changed before the chunk was saved" });
    }

    return res.status(200).json({ message: "Media chunk saved" });
  } catch (error) {
    if (chunkFileId) {
      try {
        await getVendorProductMediaBucket().delete(chunkFileId);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          console.error("Unable to clean up vendor product media chunk:", cleanupError);
        }
      }
    }
    return next(error);
  }
};

const completeMediaUpload = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.uploadId)) {
      return res.status(404).json({ message: "Media upload not found" });
    }
    let upload = await VendorProductMediaUpload.findOne({
      _id: req.params.uploadId,
      vendorId: req.authUserId,
      expiresAt: { $gt: new Date() },
    });
    if (!upload) {
      return res.status(404).json({ message: "Media upload not found or has expired" });
    }
    if (upload.status === "completed" && upload.productFileId) {
      return res.status(200).json({
        mediaPath: getVendorProductMediaPath({ id: upload.productFileId }),
      });
    }
    if (upload.status !== "uploading" || upload.chunks.length !== upload.chunkCount) {
      return res.status(409).json({ message: "Upload all media chunks before completing the upload" });
    }

    const chunkIndexes = new Set(upload.chunks.map((chunk) => chunk.index));
    if (chunkIndexes.size !== upload.chunkCount) {
      return res.status(409).json({ message: "The media upload is missing one or more chunks" });
    }

    const claimed = await VendorProductMediaUpload.updateOne(
      { _id: upload._id, vendorId: req.authUserId, status: "uploading" },
      { $set: { status: "finalizing" } },
    );
    if (claimed.modifiedCount !== 1) {
      return res.status(409).json({ message: "This media upload is already being completed" });
    }
    upload.status = "finalizing";

    let productFileId;
    try {
      productFileId = await combineVendorProductMediaUpload(upload);
      upload.productFileId = productFileId;
      upload.status = "completed";
      upload.expiresAt = new Date(Date.now() + uploadExpirationMs);
      await upload.save();
      try {
        await deleteVendorProductMediaUploadParts(upload);
        upload.chunks = [];
        await upload.save();
      } catch (error) {
        console.error("Unable to remove temporary vendor media chunks:", error);
      }
      return res.status(200).json({
        mediaPath: getVendorProductMediaPath({ id: productFileId }),
      });
    } catch (error) {
      if (productFileId) {
        try {
          await deleteVendorProductMedia(getVendorProductMediaPath({ id: productFileId }));
        } catch (cleanupError) {
          console.error("Unable to clean up finalized vendor product media:", cleanupError);
        }
      }
      await VendorProductMediaUpload.updateOne(
        { _id: upload._id, vendorId: req.authUserId, status: "finalizing" },
        { $set: { status: "uploading", productFileId: null } },
      );
      throw error;
    }
  } catch (error) {
    return next(error);
  }
};

const cancelMediaUpload = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.uploadId)) {
      return res.status(404).json({ message: "Media upload not found" });
    }
    const upload = await VendorProductMediaUpload.findOneAndDelete({
      _id: req.params.uploadId,
      vendorId: req.authUserId,
    });
    if (!upload) {
      return res.status(404).json({ message: "Media upload not found" });
    }

    await deleteVendorProductMediaUploadParts(upload);
    if (upload.productFileId) {
      const mediaPath = getVendorProductMediaPath({ id: upload.productFileId });
      const productUsesMedia = await VendorProductMediaUpload.exists({
        productFileId: upload.productFileId,
        status: "completed",
        _id: { $ne: upload._id },
      });
      const productReference = await VendorProduct.exists({
        $or: [{ images: mediaPath }, { video: mediaPath }],
      });
      if (!productUsesMedia && !productReference) await deleteVendorProductMedia(mediaPath);
    }
    return res.status(200).json({ message: "Media upload cancelled" });
  } catch (error) {
    return next(error);
  }
};

export {
  cancelMediaUpload,
  completeMediaUpload,
  createMediaUpload,
  uploadMediaChunk,
};
