import fs from "node:fs/promises";
import path from "node:path";
import Joi from "joi";
import User from "../models/user.model.js";
import VendorProduct from "../models/vendor-product.model.js";
import UserProduct from "../models/user-product.model.js";
import {
  deleteVendorProductMedia,
  getVendorProductMediaBucket,
  getVendorProductMediaId,
  getVendorProductMediaPath,
  consumeVendorProductMediaUploads,
  validateOwnedVendorProductMediaUploads,
} from "../services/vendor-product-media.service.js";
import { getVendorProductUploadDirectory } from "../middleware/vendor-product-upload.js";

const productFieldsSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().min(10).max(2000).required(),
  category: Joi.string().trim().min(2).max(60).required(),
  price: Joi.number().positive().max(100000000).required(),
  discountPercent: Joi.number().integer().min(0).max(90).default(0),
  offer: Joi.string().trim().max(100).allow("").default(""),
});

const getUploadedFiles = (req) => Object.values(req.files || {}).flat();

const cleanupUploadedMedia = async (files) => {
  await Promise.all(files.map(async (file) => {
    try {
      if (file.id) {
        await deleteVendorProductMedia(getVendorProductMediaPath(file));
      }
    } catch (error) {
      console.error("Unable to remove uploaded vendor product media:", error);
    }
  }));
};

const removeLegacyFiles = async (mediaPaths) => {
  const legacyPaths = mediaPaths.filter((mediaPath) => (
    typeof mediaPath === "string"
    && /^\/uploads\/vendor-products\/[0-9a-f-]+\.(jpg|png|webp|mp4|webm)$/i.test(mediaPath)
  ));
  await Promise.all(legacyPaths.map(async (mediaPath) => {
    try {
      await fs.unlink(path.join(getVendorProductUploadDirectory(), path.basename(mediaPath)));
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Unable to remove uploaded vendor product media:", error);
      }
    }
  }));
};

const parseRetainedImages = (value) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  const raw = Array.isArray(value)
    ? value.find((item) => typeof item === "string" && item.trim().startsWith("[")) ?? value[0]
    : value;
  if (raw === undefined || raw === null || raw === "") return undefined;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) && parsed.every((image) => typeof image === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
};

const parseRetainedVideo = (value) => {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value.find((item) => typeof item === "string") ?? value[0] : value;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed === null) return "";
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return trimmed;
  }
};

const getValidatedProductFields = (body) => productFieldsSchema.validate({
  name: body.name,
  description: body.description,
  category: body.category,
  price: body.price,
  discountPercent: body.discountPercent === "" ? 0 : body.discountPercent,
  offer: body.offer,
}, { abortEarly: true, convert: true });

const listProducts = async (req, res, next) => {
  try {
    const products = await VendorProduct.find({ vendorId: req.authUserId })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ products });
  } catch (error) {
    return next(error);
  }
};

const listStorefrontProducts = async (req, res, next) => {
  try {
    const activeVendors = await User.find({
      accountType: "vendor",
      isBlocked: { $ne: true },
    }).select("_id").lean();
    const products = await VendorProduct.find({
      vendorId: { $in: activeVendors.map((vendor) => vendor._id) },
    })
      .select("name description category price discountPercent offer images video vendorId createdAt")
      .populate("vendorId", "name")
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ products });
  } catch (error) {
    return next(error);
  }
};

const createProduct = async (req, res, next) => {
  const files = getUploadedFiles(req);
  const body = req.body || {};
  let mediaUploads = [];
  try {
    const { error, value } = getValidatedProductFields(body);
    const uploadedImages = (req.files?.images || [])
      .filter((file) => file.mimetype.startsWith("image/"));
    const uploadedVideo = (req.files?.video || [])[0];

    if (error) {
      await cleanupUploadedMedia(files);
      return res.status(400).json({ message: error.details[0].message });
    }
    if (
      files.length > 0
      && (body.images !== undefined || body.video !== undefined)
    ) {
      await cleanupUploadedMedia(files);
      return res.status(400).json({ message: "New products must use uploaded media files" });
    }
    const storedImages = body.images === undefined ? [] : body.images;
    const storedVideo = body.video === undefined ? "" : body.video;
    if (
      !Array.isArray(storedImages)
      || storedImages.some((image) => typeof image !== "string")
      || typeof storedVideo !== "string"
      || (uploadedImages.length > 0 && storedImages.length > 0)
      || ((uploadedVideo || storedVideo) && uploadedVideo && storedVideo)
    ) {
      await cleanupUploadedMedia(files);
      return res.status(400).json({ message: "Product media references are invalid" });
    }
    if (uploadedImages.length + storedImages.length === 0 || uploadedImages.length + storedImages.length > 5) {
      await cleanupUploadedMedia(files);
      return res.status(400).json({ message: "Upload between one and five product images" });
    }
    if (storedImages.length || storedVideo) {
      mediaUploads = await validateOwnedVendorProductMediaUploads(
        req.authUserId,
        storedImages,
        storedVideo,
      );
      if (!mediaUploads) {
        await cleanupUploadedMedia(files);
        return res.status(400).json({ message: "Uploaded product media is invalid or has expired" });
      }
    }

    const product = await VendorProduct.create({
      ...value,
      vendorId: req.authUserId,
      images: [
        ...uploadedImages.map(getVendorProductMediaPath),
        ...storedImages,
      ],
      video: uploadedVideo ? getVendorProductMediaPath(uploadedVideo) : storedVideo,
    });
    try {
      await consumeVendorProductMediaUploads(mediaUploads);
    } catch (error) {
      console.error("Unable to finalize vendor product media references:", error);
    }
    return res.status(201).json({ product });
  } catch (error) {
    await cleanupUploadedMedia(files);
    return next(error);
  }
};

const updateProduct = async (req, res, next) => {
  const files = getUploadedFiles(req);
  const body = req.body || {};
  let mediaUploads = [];
  try {
    const product = await VendorProduct.findOne({
      _id: req.params.productId,
      vendorId: req.authUserId,
    });
    if (!product) {
      await cleanupUploadedMedia(files);
      return res.status(404).json({ message: "Product not found" });
    }

    const { error, value } = getValidatedProductFields(body);
    const retainedImages = parseRetainedImages(body.retainedImages ?? body.images);
    const retainedVideo = parseRetainedVideo(body.retainedVideo ?? body.video);
    const storedImages = body.uploadedImages === undefined ? [] : body.uploadedImages;
    const storedVideo = body.uploadedVideo === undefined ? "" : body.uploadedVideo;
    const uploadedImages = (req.files?.images || [])
      .filter((file) => file.mimetype.startsWith("image/"));
    const uploadedVideo = (req.files?.video || [])[0];

    if (error) {
      await cleanupUploadedMedia(files);
      return res.status(400).json({ message: error.details[0].message });
    }
    if (
      !Array.isArray(storedImages)
      || storedImages.some((image) => typeof image !== "string")
      || typeof storedVideo !== "string"
      || (uploadedImages.length > 0 && storedImages.length > 0)
      || (uploadedVideo && storedVideo)
    ) {
      await cleanupUploadedMedia(files);
      return res.status(400).json({ message: "Product media references are invalid" });
    }
    if (
      retainedImages === null
      || (Array.isArray(retainedImages) && retainedImages.some((image) => !product.images.includes(image)))
      || retainedVideo === null
      || (typeof retainedVideo === "string" && retainedVideo !== "" && retainedVideo !== product.video)
    ) {
      await cleanupUploadedMedia(files);
      return res.status(400).json({ message: "Product media can only be retained from this product" });
    }

    if (storedImages.length || storedVideo) {
      mediaUploads = await validateOwnedVendorProductMediaUploads(
        req.authUserId,
        storedImages,
        storedVideo,
      );
      if (!mediaUploads) {
        await cleanupUploadedMedia(files);
        return res.status(400).json({ message: "Uploaded product media is invalid or has expired" });
      }
    }
    const images = [
      ...(Array.isArray(retainedImages) ? retainedImages : product.images),
      ...uploadedImages.map(getVendorProductMediaPath),
      ...storedImages,
    ];
    if (images.length === 0 || images.length > 5) {
      await cleanupUploadedMedia(files);
      return res.status(400).json({ message: "A product must have between one and five images" });
    }

    const previousMedia = [...product.images, ...(product.video ? [product.video] : [])];
    const nextVideo = uploadedVideo
      ? getVendorProductMediaPath(uploadedVideo)
      : storedVideo
        ? storedVideo
      : typeof retainedVideo === "string"
        ? retainedVideo
        : product.video;

    Object.assign(product, value, { images, video: nextVideo });
    await product.save();
    try {
      await consumeVendorProductMediaUploads(mediaUploads);
    } catch (error) {
      console.error("Unable to finalize vendor product media references:", error);
    }

    const nextMedia = new Set([...images, ...(nextVideo ? [nextVideo] : [])]);
    const removedMedia = previousMedia.filter((mediaPath) => !nextMedia.has(mediaPath));
    await removeLegacyFiles(removedMedia);
    await cleanupStoredMedia(removedMedia);
    return res.status(200).json({ product });
  } catch (error) {
    await cleanupUploadedMedia(files);
    return next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const product = await VendorProduct.findOneAndDelete({
      _id: req.params.productId,
      vendorId: req.authUserId,
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await cleanupVendorProduct(product);
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

const cleanupVendorProduct = async (product) => {
  await UserProduct.deleteMany({ productId: `vendor-${product._id}` });
  const mediaPaths = [
    ...product.images,
    ...(product.video ? [product.video] : []),
  ];
  await removeLegacyFiles(mediaPaths);
  await cleanupStoredMedia(mediaPaths);
};

const cleanupStoredMedia = async (mediaPaths) => {
  await Promise.all(mediaPaths.map(async (mediaPath) => {
    if (!getVendorProductMediaId(mediaPath)) return;
    try {
      await deleteVendorProductMedia(mediaPath);
    } catch (error) {
      console.error("Unable to remove vendor product media from MongoDB:", error);
    }
  }));
};

const streamProductMedia = async (req, res, next) => {
  try {
    const id = getVendorProductMediaId(`/api/products/media/${req.params.mediaId}`);
    if (!id) {
      return res.status(404).json({ message: "Product media not found" });
    }

    const bucket = getVendorProductMediaBucket();
    const file = await bucket.find({ _id: id }).next();
    if (!file) {
      return res.status(404).json({ message: "Product media not found" });
    }

    const length = file.length;
    const rangeHeader = req.headers.range;
    let start = 0;
    let end = length - 1;
    let status = 200;
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!match || (!match[1] && !match[2])) {
        res.setHeader("Content-Range", `bytes */${length}`);
        return res.status(416).end();
      }

      if (!match[1]) {
        const suffixLength = Number(match[2]);
        if (suffixLength <= 0) {
          res.setHeader("Content-Range", `bytes */${length}`);
          return res.status(416).end();
        }
        start = Math.max(length - suffixLength, 0);
      } else {
        start = Number(match[1]);
        if (match[2]) end = Number(match[2]);
      }

      if (start >= length || end < start) {
        res.setHeader("Content-Range", `bytes */${length}`);
        return res.status(416).end();
      }
      end = Math.min(end, length - 1);
      status = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${length}`);
    }

    res.status(status);
    res.setHeader("Content-Type", file.metadata?.contentType || "application/octet-stream");
    res.setHeader("Content-Length", end - start + 1);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const stream = bucket.openDownloadStream(id, { start, end: end + 1 });
    stream.once("error", (error) => {
      if (res.headersSent) {
        res.destroy(error);
      } else {
        next(error);
      }
    });
    stream.pipe(res);
    return undefined;
  } catch (error) {
    return next(error);
  }
};

const removeVendorProduct = async (productId) => {
  const product = await VendorProduct.findByIdAndDelete(productId);
  if (product) {
    await cleanupVendorProduct(product);
  }
  return product;
};

export {
  createProduct,
  deleteProduct,
  listProducts,
  listStorefrontProducts,
  removeVendorProduct,
  streamProductMedia,
  updateProduct,
};
