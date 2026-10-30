import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";

const uploadDirectory = fileURLToPath(
  new URL("../../uploads/vendor-products/", import.meta.url),
);

const mediaTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

class UnsupportedMediaError extends Error {}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      fs.mkdir(uploadDirectory, { recursive: true }, (error) => {
        callback(error, uploadDirectory);
      });
    },
    filename: (req, file, callback) => {
      callback(null, `${randomUUID()}${mediaTypes[file.mimetype]}`);
    },
  }),
  limits: {
    files: 6,
    fileSize: 50 * 1024 * 1024,
    fields: 8,
    fieldSize: 16 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");
    const allowedType = Object.hasOwn(mediaTypes, file.mimetype);

    if (
      !allowedType
      || (isImage && file.fieldname !== "images")
      || (isVideo && file.fieldname !== "video")
    ) {
      return callback(new UnsupportedMediaError(
        "Only JPEG, PNG, or WebP images and MP4 or WebM videos are supported",
      ));
    }
    return callback(null, true);
  },
});

const handleVendorProductUpload = (req, res, next) => {
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "video", maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "Each upload must be 50 MB or smaller" });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ message: error.message });
    }
    if (error instanceof UnsupportedMediaError) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  });
};

const getVendorProductUploadDirectory = () => uploadDirectory;
const getVendorProductMediaPath = (file) => `/uploads/vendor-products/${path.basename(file.filename)}`;

export {
  handleVendorProductUpload,
  getVendorProductMediaPath,
  getVendorProductUploadDirectory,
};
