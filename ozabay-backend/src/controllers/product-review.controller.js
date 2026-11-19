import ProductReview from "../models/product-review.model.js";
import User from "../models/user.model.js";
import VendorProduct from "../models/vendor-product.model.js";
import mongoose from "mongoose";

const getReviewSummary = async (productIds) => {
  const summaries = await ProductReview.aggregate([
    { $match: { productId: { $in: productIds } } },
    {
      $group: {
        _id: "$productId",
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  return Object.fromEntries(summaries.map((summary) => [
    summary._id,
    {
      averageRating: Number(summary.averageRating.toFixed(1)),
      reviewCount: summary.reviewCount,
    },
  ]));
};

const listProductReviewSummaries = async (req, res, next) => {
  try {
    const productIds = req.query.productIds.split(",");
    const summaries = await getReviewSummary(productIds);
    return res.status(200).json({ summaries });
  } catch (error) {
    return next(error);
  }
};

const listProductReviews = async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const [reviews, summaries] = await Promise.all([
      ProductReview.find({ productId })
        .select("userName rating feedback vendorReply adminReply createdAt")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      getReviewSummary([productId]),
    ]);

    return res.status(200).json({
      reviews,
      summary: summaries[productId] || { averageRating: 0, reviewCount: 0 },
    });
  } catch (error) {
    return next(error);
  }
};

const createOrUpdateProductReview = async (req, res, next) => {
  try {
    const user = await User.findById(req.authUserId).select("name verified");
    if (!user?.verified) {
      return res.status(403).json({ message: "Verify your account before writing a review." });
    }

    const review = await ProductReview.findOneAndUpdate(
      { productId: req.params.productId, userId: user._id },
      {
        $set: {
          userName: user.name,
          rating: req.body.rating,
          feedback: req.body.feedback,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select("userName rating feedback createdAt").lean();

    const summaries = await getReviewSummary([req.params.productId]);
    return res.status(200).json({
      review,
      summary: summaries[req.params.productId],
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Your review was updated elsewhere. Refresh and try again." });
    }
    return next(error);
  }
};

const listVendorProductReviews = async (req, res, next) => {
  try {
    const products = await VendorProduct.find({ vendorId: req.authUserId }).select("_id name").lean();
    const productIds = products.map((product) => String(product._id));
    const reviews = await ProductReview.find({ productId: { $in: productIds } })
      .select("productId userName rating feedback vendorReply adminReply createdAt")
      .sort({ createdAt: -1 })
      .lean();
    const names = Object.fromEntries(products.map((product) => [String(product._id), product.name]));
    return res.status(200).json({
      reviews: reviews.map((review) => ({ ...review, productName: names[review.productId] || "Product" })),
    });
  } catch (error) {
    return next(error);
  }
};

const replyToVendorProductReview = async (req, res, next) => {
  const message = String(req.body?.message || "").trim();
  if (message.length < 2 || message.length > 2000) {
    return res.status(400).json({ message: "Reply must be between 2 and 2000 characters." });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.reviewId)) {
    return res.status(400).json({ message: "Invalid review identifier." });
  }
  try {
    const review = await ProductReview.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found." });
    if (!mongoose.Types.ObjectId.isValid(review.productId)) {
      return res.status(404).json({ message: "Review product was not found." });
    }
    const product = await VendorProduct.findOne({
      _id: new mongoose.Types.ObjectId(review.productId),
      vendorId: req.authUserId,
    }).select("_id name");
    if (!product) return res.status(403).json({ message: "You can only reply to reviews for your own products." });
    review.vendorReply = { message, repliedAt: new Date() };
    await review.save();
    return res.status(200).json({ message: "Reply sent to the customer.", review });
  } catch (error) {
    return next(error);
  }
};

const listAdminProductReviews = async (req, res, next) => {
  try {
    const reviews = await ProductReview.find({})
      .select("productId userName rating feedback vendorReply adminReply createdAt")
      .sort({ createdAt: -1 })
      .lean();
    const productIds = [...new Set(reviews.map((review) => review.productId))];
    const products = await VendorProduct.find({ _id: { $in: productIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) } })
      .select("_id name vendorId")
      .populate("vendorId", "name email")
      .lean();
    const names = Object.fromEntries(products.map((product) => [String(product._id), product]));
    return res.status(200).json({
      reviews: reviews.map((review) => ({
        ...review,
        productName: names[review.productId]?.name || "Product",
        vendorName: names[review.productId]?.vendorId?.name || "",
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const replyToAdminProductReview = async (req, res, next) => {
  const message = String(req.body?.message || "").trim();
  if (message.length < 2 || message.length > 2000) {
    return res.status(400).json({ message: "Reply must be between 2 and 2000 characters." });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.reviewId)) {
    return res.status(400).json({ message: "Invalid review identifier." });
  }
  try {
    const review = await ProductReview.findByIdAndUpdate(
      req.params.reviewId,
      { $set: { adminReply: { message, repliedAt: new Date() } } },
      { new: true, runValidators: true },
    );
    if (!review) return res.status(404).json({ message: "Review not found." });
    return res.status(200).json({ message: "Reply sent.", review });
  } catch (error) {
    return next(error);
  }
};

const deleteAdminProductReview = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.reviewId)) {
    return res.status(400).json({ message: "Invalid review identifier." });
  }
  try {
    const review = await ProductReview.findByIdAndDelete(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found." });
    return res.status(200).json({ message: "Wrong review or feedback deleted." });
  } catch (error) {
    return next(error);
  }
};

export {
  createOrUpdateProductReview,
  listVendorProductReviews,
  replyToVendorProductReview,
  listAdminProductReviews,
  replyToAdminProductReview,
  deleteAdminProductReview,
  listProductReviewSummaries,
  listProductReviews,
};
