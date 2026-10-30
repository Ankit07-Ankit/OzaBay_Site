import fs from "node:fs/promises";
import path from "node:path";
import Joi from "joi";
import VendorProduct from "../models/vendor-product.model.js";
import UserProduct from "../models/user-product.model.js";
import {
  getVendorProductMediaPath,
  getVendorProductUploadDirectory,
} from "../middleware/vendor-product-upload.js";

const productFieldsSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().min(10).max(2000).required(),
  category: Joi.string().trim().min(2).max(60).required(),
  price: Joi.number().positive().max(100000000).required(),
  discountPercent: Joi.number().integer().min(0).max(90).default(0),
  offer: Joi.string().trim().max(100).allow("").default(""),
});

const getUploadedFiles = (req) => Object.values(req.files || {}).flat();

const removeFiles = async (files) => {
  await Promise.all(files.map(async (file) => {
    try {
      await fs.unlink(file.path);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Unable to remove uploaded vendor product media:", error);
      }
    }
  }));
};

const verifyMediaSignatures = async (files) => {
  for (const file of files) {
    const handle = await fs.open(file.path, "r");
    try {
      const header = Buffer.alloc(12);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      const bytes = header.subarray(0, bytesRead);
      const validImage = file.mimetype === "image/jpeg"
        ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : file.mimetype === "image/png"
          ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          : file.mimetype === "image/webp"
            ? bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
            : false;
      const validVideo = file.mimetype === "video/mp4"
        ? bytes.length >= 8 && bytes.toString("ascii", 4, 8) === "ftyp"
        : file.mimetype === "video/webm"
          ? bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
          : false;

      if (!validImage && !validVideo) {
        return false;
      }
    } finally {
      await handle.close();
    }
  }
  return true;
};

const parseRetainedImages = (value) => {
  if (value === undefined) return undefined;
  try {
    const images = JSON.parse(value);
    return Array.isArray(images) && images.every((image) => typeof image === "string")
      ? images
      : null;
  } catch {
    return null;
  }
};

const getRetainedVideo = (value) => {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : null;
};

const isProductMediaPath = (value) => (
  typeof value === "string"
  && /^\/uploads\/vendor-products\/[0-9a-f-]+\.(jpg|png|webp|mp4|webm)$/i.test(value)
);

const filesForMedia = (mediaPaths) => {
  const uploadDirectory = getVendorProductUploadDirectory();
  return mediaPaths
    .filter(isProductMediaPath)
    .map((mediaPath) => ({
      path: path.join(uploadDirectory, path.basename(mediaPath)),
    }));
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
    const products = await VendorProduct.find({ vendorId: req.authUserId }).sort({ createdAt: -1 });
    return res.status(200).json({ products });
  } catch (error) {
    return next(error);
  }
};

const listStorefrontProducts = async (req, res, next) => {
  try {
    const products = await VendorProduct.find()
      .select("name description category price discountPercent offer images video vendorId createdAt")
      .populate("vendorId", "name")
      .sort({ createdAt: -1 });
    return res.status(200).json({ products });
  } catch (error) {
    return next(error);
  }
};

const createProduct = async (req, res, next) => {
  const files = getUploadedFiles(req);
  const body = req.body || {};
  try {
    const { error, value } = getValidatedProductFields(body);
    const uploadedImages = (req.files?.images || [])
      .filter((file) => file.mimetype.startsWith("image/"));
    const uploadedVideo = (req.files?.video || [])[0];

    if (error) {
      await removeFiles(files);
      return res.status(400).json({ message: error.details[0].message });
    }
    if (body.images !== undefined || body.video !== undefined) {
      await removeFiles(files);
      return res.status(400).json({ message: "New products must use uploaded media files" });
    }
    if (uploadedImages.length === 0 || uploadedImages.length > 5) {
      await removeFiles(files);
      return res.status(400).json({ message: "Upload between one and five product images" });
    }
    if (!(await verifyMediaSignatures(files))) {
      await removeFiles(files);
      return res.status(400).json({ message: "An uploaded file does not match its selected image or video type" });
    }

    const product = await VendorProduct.create({
      ...value,
      vendorId: req.authUserId,
      images: uploadedImages.map(getVendorProductMediaPath),
      video: uploadedVideo ? getVendorProductMediaPath(uploadedVideo) : "",
    });
    return res.status(201).json({ product });
  } catch (error) {
    await removeFiles(files);
    return next(error);
  }
};

const updateProduct = async (req, res, next) => {
  const files = getUploadedFiles(req);
  const body = req.body || {};
  try {
    const product = await VendorProduct.findOne({
      _id: req.params.productId,
      vendorId: req.authUserId,
    });
    if (!product) {
      await removeFiles(files);
      return res.status(404).json({ message: "Product not found" });
    }

    const { error, value } = getValidatedProductFields(body);
    const retainedImages = parseRetainedImages(body.images);
    const retainedVideo = getRetainedVideo(body.video);
    const uploadedImages = (req.files?.images || [])
      .filter((file) => file.mimetype.startsWith("image/"));
    const uploadedVideo = (req.files?.video || [])[0];

    if (error) {
      await removeFiles(files);
      return res.status(400).json({ message: error.details[0].message });
    }
    if (
      retainedImages === null
      || (retainedImages && retainedImages.some((image) => !product.images.includes(image)))
      || retainedVideo === null
      || (retainedVideo && retainedVideo !== product.video)
    ) {
      await removeFiles(files);
      return res.status(400).json({ message: "Product media can only be retained from this product" });
    }

    const images = [
      ...(retainedImages ?? product.images),
      ...uploadedImages.map(getVendorProductMediaPath),
    ];
    if (images.length === 0 || images.length > 5) {
      await removeFiles(files);
      return res.status(400).json({ message: "A product must have between one and five images" });
    }
    if (!(await verifyMediaSignatures(files))) {
      await removeFiles(files);
      return res.status(400).json({ message: "An uploaded file does not match its selected image or video type" });
    }

    const previousMedia = [...product.images, ...(product.video ? [product.video] : [])];
    const nextVideo = uploadedVideo
      ? getVendorProductMediaPath(uploadedVideo)
      : retainedVideo ?? product.video;

    Object.assign(product, value, { images, video: nextVideo });
    await product.save();

    const nextMedia = new Set([...images, ...(nextVideo ? [nextVideo] : [])]);
    await removeFiles(filesForMedia(previousMedia.filter((mediaPath) => !nextMedia.has(mediaPath))));
    return res.status(200).json({ product });
  } catch (error) {
    await removeFiles(files);
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

    await UserProduct.deleteMany({ productId: `vendor-${product._id}` });
    await removeFiles(filesForMedia([...product.images, ...(product.video ? [product.video] : [])]));
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export {
  createProduct,
  deleteProduct,
  listProducts,
  listStorefrontProducts,
  updateProduct,
};
