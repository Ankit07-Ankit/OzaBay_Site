import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorProduct",
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    image: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    fulfillmentStatus: {
      type: String,
      enum: ["Received", "Crafting", "Shipped", "Out for delivery", "Delivered", "Cancelled"],
      default: "Received",
    },
    deliveredAt: { type: Date, default: null },
    cashOnDelivery: {
      status: {
        type: String,
        enum: ["unpaid", "paid"],
        default: "unpaid",
      },
      collectedAt: { type: Date, default: null },
      collectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    cancellationRequest: {
      status: {
        type: String,
        enum: ["none", "requested", "approved", "rejected"],
        default: "none",
      },
      reason: { type: String, default: "" },
      requestedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    returnRequest: {
      status: {
        type: String,
        enum: ["none", "requested", "approved", "rejected"],
        default: "none",
      },
      reason: { type: String, default: "" },
      requestedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["Cash on delivery", "Razorpay"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed", "cancelled"],
      required: true,
    },
    paymentDetails: {
      provider: { type: String, default: "" },
      transactionId: { type: String, default: "" },
      method: { type: String, default: "" },
      amount: { type: Number, min: 0, default: 0 },
      currency: { type: String, default: "INR" },
      status: {
        type: String,
        enum: ["unpaid", "pending", "paid", "failed", "cancelled"],
        default: "unpaid",
      },
      refundStatus: {
        type: String,
        enum: ["not_required", "pending", "refunded"],
        default: "not_required",
      },
      refundNote: { type: String, default: "" },
      paidAt: { type: Date, default: null },
    },
    orderStatus: {
      type: String,
      enum: ["Awaiting payment", "Received", "Crafting", "Shipped", "Out for delivery", "Delivered", "Cancelled", "Payment failed"],
      required: true,
    },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    cancellationRequestedBy: {
      type: String,
      enum: ["customer", "vendor", null],
      default: null,
    },
  },
  { timestamps: true },
);

orderSchema.index({ "items.vendorId": 1, createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
