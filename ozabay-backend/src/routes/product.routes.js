import { Router } from "express";
import { listStorefrontProducts } from "../controllers/vendor-product.controller.js";
import {
  createOrUpdateProductReview,
  listProductReviewSummaries,
  listProductReviews,
} from "../controllers/product-review.controller.js";
import requireAuth from "../middleware/auth.middleware.js";
import {
  productReviewParamsValidation,
  productReviewSummaryValidation,
  productReviewValidation,
} from "../middleware/auth.validation.js";

const productRouter = Router();

productRouter.get("/reviews/summary", productReviewSummaryValidation, listProductReviewSummaries);
productRouter.get("/:productId/reviews", productReviewParamsValidation, listProductReviews);
productRouter.post(
  "/:productId/reviews",
  requireAuth,
  productReviewParamsValidation,
  productReviewValidation,
  createOrUpdateProductReview,
);
productRouter.get("/", listStorefrontProducts);
productRouter.use((error, req, res, next) => {
  console.error("Storefront product request failed:", error);
  return res.status(500).json({ message: "Unable to load maker products." });
});

export default productRouter;
