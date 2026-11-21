import { Router } from "express";
import {
  createOrder,
  cancelCustomerOrder,
  listCustomerOrders,
  requestCustomerItemCancellation,
  requestCustomerReturn,
  verifyPayment,
} from "../controllers/order.controller.js";
import requireAuth from "../middleware/auth.middleware.js";
import { requireUser } from "../middleware/vendor.middleware.js";

const orderRouter = Router();

orderRouter.use(requireAuth, requireUser);
orderRouter.get("/mine", listCustomerOrders);
orderRouter.post("/:orderId/cancel", cancelCustomerOrder);
orderRouter.post(
  "/:orderId/items/:productId/cancel-request",
  requestCustomerItemCancellation,
);
orderRouter.post("/:orderId/items/:productId/return", requestCustomerReturn);
orderRouter.post("/", createOrder);
orderRouter.post("/verify-payment", verifyPayment);
orderRouter.use((error, req, res, next) => {
  console.error("Customer order request failed:", error);
  if (error.statusCode === 401 && error.error?.code === "BAD_REQUEST_ERROR") {
    return res.status(503).json({
      message:
        "Razorpay rejected the server credentials. Check that the key ID and secret are a matching pair for the same test or live mode.",
    });
  }
  return res.status(500).json({ message: "Unable to process this order." });
});

export default orderRouter;
