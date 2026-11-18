import { Router } from "express";
import {
  adminLogin,
  adminLogout,
  deleteAccount,
  deleteProduct,
  getSummary,
  listAccounts,
  listOrders,
  listProducts,
  updateAccountStatus,
} from "../controllers/admin.controller.js";
import requireAdmin from "../middleware/admin.middleware.js";

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

export default adminRouter;
