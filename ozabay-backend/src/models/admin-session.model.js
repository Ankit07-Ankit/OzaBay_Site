import mongoose from "mongoose";

const adminSessionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    ipAddress: String,
    userAgent: String,
    revoked: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

const AdminSession = mongoose.model("AdminSession", adminSessionSchema);

export default AdminSession;
