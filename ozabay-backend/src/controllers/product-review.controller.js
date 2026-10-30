import ProductReview from "../models/product-review.model.js";
import User from "../models/user.model.js";

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
        .select("userName rating feedback createdAt")
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

export {
  createOrUpdateProductReview,
  listProductReviewSummaries,
  listProductReviews,
};
