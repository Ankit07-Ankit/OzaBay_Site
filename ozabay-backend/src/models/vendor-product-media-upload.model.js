import mongoose from "mongoose";

const vendorProductMediaUploadSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    field: {
      type: String,
      enum: ["images", "video"],
      required: true,
    },
    originalName: {
      type: String,
      required: true,
      maxlength: 255,
    },
    contentType: {
      type: String,
      enum: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"],
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: 50 * 1024 * 1024,
    },
    chunkCount: {
      type: Number,
      required: true,
      min: 1,
    },
    chunks: {
      type: [{
        index: { type: Number, required: true },
        fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
      }],
      default: [],
    },
    status: {
      type: String,
      enum: ["uploading", "finalizing", "completed"],
      default: "uploading",
    },
    productFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

const VendorProductMediaUpload = mongoose.model(
  "VendorProductMediaUpload",
  vendorProductMediaUploadSchema,
);

export default VendorProductMediaUpload;
