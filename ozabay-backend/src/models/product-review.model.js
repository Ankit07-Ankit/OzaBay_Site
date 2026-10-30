import mongoose from "mongoose";

const productReviewSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

productReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
productReviewSchema.index({ productId: 1, createdAt: -1 });

const ProductReview = mongoose.model("ProductReview", productReviewSchema);

export default ProductReview;
