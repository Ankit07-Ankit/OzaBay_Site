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
import User from "../models/user.model.js";
import {
  collectVendorCashOnDelivery,
  listVendorOrders,
  reviewVendorReturnRequest,
  updateVendorOrderItemStatus,
  updateVendorOrderStatus,
} from "../controllers/order.controller.js";
import {
  listVendorProductReviews,
  replyToVendorProductReview,
} from "../controllers/product-review.controller.js";
import {
  createSupportMessage,
  listSupportMessages,
  replyToSupportMessage,
} from "../controllers/support.controller.js";

const vendorRouter = Router();

vendorRouter.use(requireAuth, requireVendor);
vendorRouter.get("/products", listProducts);
vendorRouter.get("/orders", listVendorOrders);
vendorRouter.get("/reviews", listVendorProductReviews);
vendorRouter.post("/reviews/:reviewId/replies", replyToVendorProductReview);
vendorRouter.get("/support", listSupportMessages);
vendorRouter.post("/support", createSupportMessage);
vendorRouter.post("/support/:ticketId/replies", replyToSupportMessage);
vendorRouter.patch("/orders/:orderId/status", updateVendorOrderStatus);
vendorRouter.patch(
  "/orders/:orderId/items/:productId/status",
  updateVendorOrderItemStatus,
);
vendorRouter.patch(
  "/orders/:orderId/items/:productId/cash-on-delivery",
  collectVendorCashOnDelivery,
);
vendorRouter.patch(
  "/orders/:orderId/items/:productId/return",
  reviewVendorReturnRequest,
);
vendorRouter.post("/products", handleVendorProductUpload, createProduct);
vendorRouter.patch("/products/:productId", handleVendorProductUpload, updateProduct);
vendorRouter.delete("/products/:productId", deleteProduct);

// Vendor Shop Locations management
vendorRouter.get("/locations", async (req, res, next) => {
  try {
    const user = await User.findById(req.authUserId).select("shopLocations");
    return res.status(200).json({ locations: user?.shopLocations || [] });
  } catch (error) {
    return next(error);
  }
});

vendorRouter.post("/locations", async (req, res, next) => {
  try {
    const { name, type, categories, address, city, state, pincode, phone, timing, mapLink, isPrimary } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Shop location name is required" });
    }
    const user = await User.findById(req.authUserId);
    if (!user) return res.status(404).json({ message: "Vendor not found" });

    if (isPrimary) {
      user.shopLocations.forEach((loc) => { loc.isPrimary = false; });
    }

    const newLocation = {
      name: name.trim(),
      type: type?.trim() || "Studio / Workshop",
      categories: Array.isArray(categories)
        ? categories.map((c) => String(c).trim()).filter(Boolean)
        : (categories ? String(categories).split(",").map((c) => c.trim()).filter(Boolean) : []),
      address: address?.trim() || "",
      city: city?.trim() || "",
      state: state?.trim() || "",
      pincode: pincode?.trim() || "",
      phone: phone?.trim() || "",
      timing: timing?.trim() || "",
      mapLink: mapLink?.trim() || "",
      isPrimary: Boolean(isPrimary) || user.shopLocations.length === 0,
    };

    user.shopLocations.push(newLocation);
    await user.save();
    return res.status(201).json({
      message: "Shop location added successfully",
      location: user.shopLocations[user.shopLocations.length - 1],
      locations: user.shopLocations,
    });
  } catch (error) {
    return next(error);
  }
});

vendorRouter.patch("/locations/:locationId", async (req, res, next) => {
  try {
    const user = await User.findById(req.authUserId);
    if (!user) return res.status(404).json({ message: "Vendor not found" });

    const location = user.shopLocations.id(req.params.locationId);
    if (!location) {
      return res.status(404).json({ message: "Shop location not found" });
    }

    const { name, type, categories, address, city, state, pincode, phone, timing, mapLink, isPrimary } = req.body;

    if (name !== undefined) location.name = name.trim();
    if (type !== undefined) location.type = type.trim();
    if (categories !== undefined) {
      location.categories = Array.isArray(categories)
        ? categories.map((c) => String(c).trim()).filter(Boolean)
        : String(categories).split(",").map((c) => c.trim()).filter(Boolean);
    }
    if (address !== undefined) location.address = address.trim();
    if (city !== undefined) location.city = city.trim();
    if (state !== undefined) location.state = state.trim();
    if (pincode !== undefined) location.pincode = pincode.trim();
    if (phone !== undefined) location.phone = phone.trim();
    if (timing !== undefined) location.timing = timing.trim();
    if (mapLink !== undefined) location.mapLink = mapLink.trim();

    if (isPrimary) {
      user.shopLocations.forEach((loc) => {
        if (loc._id.toString() !== location._id.toString()) loc.isPrimary = false;
      });
      location.isPrimary = true;
    } else if (isPrimary === false) {
      location.isPrimary = false;
    }

    await user.save();
    return res.status(200).json({
      message: "Shop location updated successfully",
      location,
      locations: user.shopLocations,
    });
  } catch (error) {
    return next(error);
  }
});

vendorRouter.delete("/locations/:locationId", async (req, res, next) => {
  try {
    const user = await User.findById(req.authUserId);
    if (!user) return res.status(404).json({ message: "Vendor not found" });

    const location = user.shopLocations.id(req.params.locationId);
    if (!location) {
      return res.status(404).json({ message: "Shop location not found" });
    }

    user.shopLocations.pull(req.params.locationId);
    await user.save();
    return res.status(200).json({
      message: "Shop location deleted successfully",
      locations: user.shopLocations,
    });
  } catch (error) {
    return next(error);
  }
});
vendorRouter.use((error, req, res, next) => {
  console.error("Vendor product request failed:", error);
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: "Invalid product data" });
  }
  return res.status(500).json({ message: "Unable to process this vendor product request" });
});

export default vendorRouter;
