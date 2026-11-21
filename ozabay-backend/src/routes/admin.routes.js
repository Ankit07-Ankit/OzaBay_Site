import { Router } from "express";
import {
  adminLogin,
  adminLogout,
  deleteAccount,
  deleteProduct,
  getSummary,
  getSupportUnreadCount,
  listAccounts,
  listOrders,
  listProducts,
  updateAccountStatus,
  listSupportMessages,
  replyToSupportMessage,
  deleteSupportMessage,
} from "../controllers/admin.controller.js";
import requireAdmin from "../middleware/admin.middleware.js";
import {
  listAdminProductReviews,
  replyToAdminProductReview,
  deleteAdminProductReview,
} from "../controllers/product-review.controller.js";

const adminRouter = Router();

adminRouter.post("/login", adminLogin);
adminRouter.use(requireAdmin);
adminRouter.post("/logout", adminLogout);
adminRouter.get("/summary", getSummary);
adminRouter.get("/accounts", listAccounts);
adminRouter.get("/orders", listOrders);
adminRouter.patch("/accounts/:accountId/status", updateAccountStatus);
adminRouter.delete("/accounts/:accountId", deleteAccount);
adminRouter.get("/products", listProducts);
adminRouter.delete("/products/:productId", deleteProduct);
adminRouter.get("/support/unread-count", getSupportUnreadCount);
adminRouter.get("/support", listSupportMessages);
adminRouter.post("/support/:ticketId/replies", replyToSupportMessage);
adminRouter.delete("/support/:ticketId", deleteSupportMessage);
adminRouter.get("/reviews", listAdminProductReviews);
adminRouter.post("/reviews/:reviewId/replies", replyToAdminProductReview);
adminRouter.delete("/reviews/:reviewId", deleteAdminProductReview);

export default adminRouter;
