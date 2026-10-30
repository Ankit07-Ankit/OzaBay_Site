import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    refreshTokenHash: {
      type: String,
      required: [true, "Refresh token hash is required"],
    },
    ipAddress: {
      type: String,
      required: [true, "IP address is required"],
    },
    userAgent: {
      type: String,
      required: [true, "User agent is required"],
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
    },
  },
  { timestamps: true },
);

const Session = mongoose.model("Session", sessionSchema);

export default Session;
