import mongoose from "mongoose";
import { pipeline } from "node:stream/promises";
import VendorProduct from "../models/vendor-product.model.js";
import VendorProductMediaUpload from "../models/vendor-product-media-upload.model.js";

const bucketName = "vendorProductMedia";
const mediaPathPattern = /^\/api\/products\/media\/([a-f\d]{24})$/i;
const mediaChunkSize = 3 * 1024 * 1024;
const mediaMaxFileSize = 50 * 1024 * 1024;

const isValidVendorProductMediaSignature = (mimeType, bytes) => {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12
      && bytes.toString("ascii", 0, 4) === "RIFF"
      && bytes.toString("ascii", 8, 12) === "WEBP";
  }
  if (mimeType === "video/mp4") {
    return bytes.length >= 8 && bytes.toString("ascii", 4, 8) === "ftyp";
  }
  if (mimeType === "video/webm") {
    return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  return false;
};

const getVendorProductMediaBucket = () => {
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("MongoDB must be connected before accessing vendor product media");
  }
  return new mongoose.mongo.GridFSBucket(database, { bucketName });
};

const getVendorProductMediaPath = (file) => `/api/products/media/${file.id}`;

const getVendorProductMediaId = (mediaPath) => {
  const match = typeof mediaPath === "string" && mediaPath.match(mediaPathPattern);
  return match ? new mongoose.Types.ObjectId(match[1]) : null;
};

const deleteVendorProductMedia = async (mediaPath) => {
  const id = getVendorProductMediaId(mediaPath);
  if (!id) return false;

  try {
    await getVendorProductMediaBucket().delete(id);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};

const deleteVendorProductMediaUploadParts = async (upload) => {
  const bucket = getVendorProductMediaBucket();
  await Promise.all((upload.chunks || []).map(async ({ fileId }) => {
    try {
      await bucket.delete(fileId);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }));
};

const cleanupExpiredVendorProductMediaUploads = async () => {
  const expiredUploads = await VendorProductMediaUpload.find({
    expiresAt: { $lte: new Date() },
  }).limit(50);

  for (const upload of expiredUploads) {
    await deleteVendorProductMediaUploadParts(upload);
    if (upload.productFileId) {
      const mediaPath = getVendorProductMediaPath({ id: upload.productFileId });
      const productUsesMedia = await VendorProduct.exists({
        $or: [{ images: mediaPath }, { video: mediaPath }],
      });
      if (!productUsesMedia) await deleteVendorProductMedia(mediaPath);
    }
    await VendorProductMediaUpload.deleteOne({ _id: upload._id });
  }
};

const combineVendorProductMediaUpload = async (upload) => {
  const bucket = getVendorProductMediaBucket();
  const chunks = [...upload.chunks].sort((a, b) => a.index - b.index);
  const uploadStream = bucket.openUploadStream(upload.originalName, {
    metadata: {
      contentType: upload.contentType,
      vendorId: upload.vendorId,
    },
  });
  const content = async function* streamChunks() {
    for (const chunk of chunks) {
      const stream = bucket.openDownloadStream(chunk.fileId);
      for await (const data of stream) yield data;
    }
  };

  try {
    await pipeline(content(), uploadStream);
  } catch (error) {
    try {
      await bucket.delete(uploadStream.id);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOENT") {
        console.error("Unable to clean up incomplete vendor product media:", cleanupError);
      }
    }
    throw error;
  }
  return uploadStream.id;
};

const validateOwnedVendorProductMediaUploads = async (vendorId, imagePaths, videoPath) => {
  const mediaPaths = [
    ...imagePaths.map((mediaPath) => ({ mediaPath, field: "images" })),
    ...(videoPath ? [{ mediaPath: videoPath, field: "video" }] : []),
  ];
  const ids = mediaPaths.map(({ mediaPath }) => getVendorProductMediaId(mediaPath));
  if (ids.some((id) => !id) || new Set(ids.map(String)).size !== ids.length) return null;

  const uploads = await VendorProductMediaUpload.find({
    vendorId,
    status: "completed",
    productFileId: { $in: ids },
  });
  if (uploads.length !== mediaPaths.length) return null;

  const uploadByFileId = new Map(uploads.map((upload) => [String(upload.productFileId), upload]));
  const isValid = mediaPaths.every(({ mediaPath, field }) => {
    const id = getVendorProductMediaId(mediaPath);
    return uploadByFileId.get(String(id))?.field === field;
  });
  return isValid ? uploads : null;
};

const consumeVendorProductMediaUploads = async (uploads) => {
  if (uploads.length === 0) return;
  await VendorProductMediaUpload.deleteMany({
    _id: { $in: uploads.map((upload) => upload._id) },
  });
};

export {
  cleanupExpiredVendorProductMediaUploads,
  combineVendorProductMediaUpload,
  consumeVendorProductMediaUploads,
  deleteVendorProductMedia,
  deleteVendorProductMediaUploadParts,
  getVendorProductMediaBucket,
  getVendorProductMediaId,
  getVendorProductMediaPath,
  isValidVendorProductMediaSignature,
  mediaChunkSize,
  mediaMaxFileSize,
  validateOwnedVendorProductMediaUploads,
};
