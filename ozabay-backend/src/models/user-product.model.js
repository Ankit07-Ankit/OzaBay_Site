import mongoose from "mongoose";

const userProductSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    productType: {
      type: String,
      enum: ["cart", "favorites"],
      required: [true, "Product type is required"],
    },
    productId: {
      type: String,
      required: [true, "Product ID is required"],
    },
    qty: {
      type: Number,
      min: 1,
      default: 1,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: { updatedAt: true } },
);

userProductSchema.index(
  { userId: 1, productType: 1, productId: 1 },
  { unique: true },
);

userProductSchema.index({ userId: 1, productType: 1 });

const UserProduct = mongoose.model("UserProduct", userProductSchema);

export default UserProduct;
