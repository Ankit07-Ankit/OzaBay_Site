import mongoose from "mongoose";

const studioBriefSchema = new mongoose.Schema({
  customer: {
    name: String, email: String, phone: String, city: String, address: String,
    quantity: Number, budget: String, neededBy: String, purpose: String, approval: String,
  },
  design: {
    form: String, material: String, finish: String, size: String, tone: String,
    engraving: String, notes: String,
  },
  referenceName: String,
  referenceType: String,
  referenceImage: { type: Buffer, select: false },
}, { timestamps: true });

studioBriefSchema.index({ createdAt: -1 });
export default mongoose.model("StudioBrief", studioBriefSchema);
