import { Router } from "express";
import { listUserProducts, saveUserProducts } from "../controllers/user-product.controller.js";
import requireAuth from "../middleware/auth.middleware.js";
import { userProductListValidation, userProductValidation } from "../middleware/auth.validation.js";

const userProductRouter = Router();

userProductRouter.get("/", requireAuth, userProductListValidation, listUserProducts);
userProductRouter.post("/", requireAuth, userProductValidation, saveUserProducts);
userProductRouter.use((error, req, res, next) => {
  console.error("User product request failed:", error);
  return res.status(500).json({ message: "Unable to save your saved products." });
});

export default userProductRouter;
