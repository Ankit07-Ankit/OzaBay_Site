import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ["customer", "vendor", "admin"], required: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const supportMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String, required: true, trim: true },
    userEmail: { type: String, required: true, trim: true },
    accountType: { type: String, enum: ["user", "vendor"], default: "user" },
    category: {
      type: String,
      enum: ["Support", "Feedback", "Order", "Return", "Review", "Vendor"],
      default: "Support",
    },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ["Open", "Replied", "Resolved"], default: "Open" },
    replies: { type: [replySchema], default: [] },
  },
  { timestamps: true },
);

supportMessageSchema.index({ createdAt: -1 });

export default mongoose.model("SupportMessage", supportMessageSchema);
