import mongoose from "mongoose";

const vendorProductSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 90,
    },
    offer: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: (images) => images.length > 0 && images.length <= 5,
        message: "Add between one and five product images",
      },
    },
    video: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

const VendorProduct = mongoose.model("VendorProduct", vendorProductSchema);

export default VendorProduct;
