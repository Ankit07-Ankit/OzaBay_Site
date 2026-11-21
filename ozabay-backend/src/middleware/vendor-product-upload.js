import { fileURLToPath } from "node:url";
import multer from "multer";
import {
  deleteVendorProductMedia,
  getVendorProductMediaBucket,
} from "../services/vendor-product-media.service.js";

const uploadDirectory = fileURLToPath(
  new URL("../../uploads/vendor-products/", import.meta.url),
);

class UnsupportedMediaError extends Error {}

const isValidMediaSignature = (mimeType, bytes) => {
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

const gridFsStorage = {
  _handleFile(req, file, callback) {
    let bucket;
    let uploadStream;
    try {
      bucket = getVendorProductMediaBucket();
      uploadStream = bucket.openUploadStream(file.originalname, {
        metadata: { contentType: file.mimetype },
      });
    } catch (error) {
      callback(error);
      return;
    }

    let size = 0;
    let header = Buffer.alloc(12);
    let headerLength = 0;
    let completed = false;
    const finish = (error, info) => {
      if (completed) return;
      completed = true;
      callback(error, info);
    };

    file.stream.on("data", (chunk) => {
      size += chunk.length;
      if (headerLength < header.length) {
        const bytesToCopy = Math.min(header.length - headerLength, chunk.length);
        chunk.copy(header, headerLength, 0, bytesToCopy);
        headerLength += bytesToCopy;
      }
    });
    file.stream.once("error", (error) => uploadStream.destroy(error));
    uploadStream.once("error", (error) => finish(error));
    uploadStream.once("finish", async () => {
      header = header.subarray(0, headerLength);
      if (!isValidMediaSignature(file.mimetype, header)) {
        try {
          await bucket.delete(uploadStream.id);
        } catch (error) {
          console.error("Unable to remove invalid vendor product media:", error);
        }
        finish(new UnsupportedMediaError(
          "The uploaded file content does not match its selected image or video type",
        ));
        return;
      }
      finish(null, {
        id: uploadStream.id,
        filename: String(uploadStream.id),
        size,
      });
    });

    file.stream.pipe(uploadStream);
  },

  _removeFile(req, file, callback) {
    deleteVendorProductMedia(`/api/products/media/${file.id}`)
      .then(() => callback(null))
      .catch(callback);
  },
};

const upload = multer({
  storage: gridFsStorage,
  limits: {
    files: 6,
    fileSize: 50 * 1024 * 1024,
    fields: 8,
    fieldSize: 16 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");
    const allowedType = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
    ].includes(file.mimetype);

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

export {
  handleVendorProductUpload,
  getVendorProductUploadDirectory,
};
