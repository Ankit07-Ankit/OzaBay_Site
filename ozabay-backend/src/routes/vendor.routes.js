import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "../controllers/vendor-product.controller.js";
import requireAuth from "../middleware/auth.middleware.js";
import requireVendor from "../middleware/vendor.middleware.js";
import { handleVendorProductUpload } from "../middleware/vendor-product-upload.js";

const vendorRouter = Router();

vendorRouter.use(requireAuth, requireVendor);
vendorRouter.get("/products", listProducts);
vendorRouter.post("/products", handleVendorProductUpload, createProduct);
vendorRouter.patch("/products/:productId", handleVendorProductUpload, updateProduct);
vendorRouter.delete("/products/:productId", deleteProduct);
vendorRouter.use((error, req, res, next) => {
  console.error("Vendor product request failed:", error);
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: "Invalid product data" });
  }
  return res.status(500).json({ message: "Unable to process this vendor product request" });
});

export default vendorRouter;
