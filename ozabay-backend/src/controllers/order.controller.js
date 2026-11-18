import crypto from "node:crypto";
import Joi from "joi";
import mongoose from "mongoose";
import {
  razorpayInstance,
  razorpayKeyId,
  razorpayKeySecret,
} from "./payment.controller.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import VendorProduct from "../models/vendor-product.model.js";

const checkoutSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string()
          .pattern(/^vendor-[a-fA-F0-9]{24}$/)
          .required(),
        quantity: Joi.number().integer().min(1).max(50).required(),
      }).required(),
    )
    .unique("productId")
    .min(1)
    .max(50)
    .required(),
  customer: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().trim().email().max(254).required(),
    phone: Joi.string().trim().pattern(/^[+\d][\d\s()-]{6,19}$/).required(),
    address: Joi.string().trim().min(5).max(300).required(),
    city: Joi.string().trim().min(2).max(100).required(),
    pincode: Joi.string().trim().pattern(/^\d{6}$/).required(),
  }).required(),
  paymentMethod: Joi.string()
    .valid("Cash on delivery", "Razorpay")
    .required(),
});

const verifyPaymentSchema = Joi.object({
  orderId: Joi.string().pattern(/^[a-fA-F0-9]{24}$/).required(),
  razorpay_order_id: Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
  razorpay_signature: Joi.string().pattern(/^[a-fA-F0-9]{64}$/).required(),
});

const vendorFulfillmentSchema = Joi.object({
  status: Joi.string().valid("Received", "Crafting", "Shipped", "Delivered", "Cancelled").required(),
});

const returnRequestSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow("").default(""),
});

const vendorReturnDecisionSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
});

const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const updateCustomerDeliveryDetails = async (customerId, details) => {
  const result = await User.updateOne(
    { _id: customerId, accountType: "user" },
    {
      $set: {
        "deliveryLocation.fullName": details.name,
        "deliveryLocation.mobile": details.phone,
        "deliveryLocation.address": details.address,
        "deliveryLocation.city": details.city,
        "deliveryLocation.pincode": details.pincode,
      },
    },
  );
  if (result.matchedCount !== 1) {
    throw new Error("Customer account could not be updated.");
  }
};

const buildOrderItems = async (requestedItems) => {
  const quantities = new Map(
    requestedItems.map(({ productId, quantity }) => [
      productId.slice("vendor-".length),
      quantity,
    ]),
  );
  const productIds = [...quantities.keys()].map(
    (id) => new mongoose.Types.ObjectId(id),
  );
  const products = await VendorProduct.find({ _id: { $in: productIds } })
    .select("name price discountPercent images vendorId")
    .lean();

  if (products.length !== quantities.size) {
    return null;
  }

  const items = products.map((product) => {
    const quantity = quantities.get(String(product._id));
    const unitPricePaise = Math.round(
      product.price * (1 - (product.discountPercent || 0) / 100) * 100,
    );
    return {
      productId: product._id,
      vendorId: product.vendorId,
      name: product.name,
      image: product.images[0] || "",
      quantity,
      unitPrice: unitPricePaise / 100,
      lineTotal: (unitPricePaise * quantity) / 100,
      fulfillmentStatus: "Received",
    };
  });

  return {
    items,
    total: items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
};

const createOrder = async (req, res, next) => {
  try {
    const { error, value } = checkoutSchema.validate(req.body, {
      abortEarly: true,
      convert: true,
    });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    if (value.paymentMethod === "Razorpay" && !razorpayInstance) {
      return res.status(503).json({ message: "Online payment is not configured." });
    }

    const customer = await User.findOne({
      _id: req.authUserId,
      accountType: "user",
    }).select("_id");
    if (!customer) {
      return res.status(404).json({ message: "Customer account was not found." });
    }

    const checkout = await buildOrderItems(value.items);
    if (!checkout) {
      return res.status(400).json({
        message: "A product in your cart is no longer available.",
      });
    }

    await updateCustomerDeliveryDetails(req.authUserId, value.customer);
    const order = new Order({
      customerId: req.authUserId,
      customer: value.customer,
      items: checkout.items,
      total: checkout.total,
      paymentMethod: value.paymentMethod,
      paymentStatus:
        value.paymentMethod === "Razorpay" ? "pending" : "unpaid",
      paymentDetails: {
        provider: value.paymentMethod,
        method: value.paymentMethod === "Cash on delivery"
          ? "Cash on delivery"
          : "",
        amount: checkout.total,
        currency: "INR",
        status: value.paymentMethod === "Razorpay" ? "pending" : "unpaid",
      },
      orderStatus:
        value.paymentMethod === "Razorpay" ? "Awaiting payment" : "Received",
    });

    if (value.paymentMethod === "Razorpay") {
      let gatewayOrder;
      try {
        gatewayOrder = await razorpayInstance.orders.create({
          amount: Math.round(checkout.total * 100),
          currency: "INR",
          receipt: `oz_${String(order._id).slice(-12)}_${Date.now().toString().slice(-6)}`,
          notes: {
            orderId: String(order._id),
            customerId: String(req.authUserId),
          },
        });
      } catch (gatewayError) {
        const authenticationFailed =
          gatewayError.statusCode === 401 ||
          (gatewayError.error?.code === "BAD_REQUEST_ERROR" &&
            gatewayError.error?.description === "Authentication failed");
        console.error("Razorpay order creation failed:", {
          message: gatewayError.message || gatewayError.error?.description,
          description: gatewayError.error?.description,
          code: gatewayError.error?.code,
          statusCode: gatewayError.statusCode,
        });
        order.paymentStatus = "failed";
        order.paymentDetails.status = "failed";
        order.orderStatus = "Payment failed";
        await order.save();
        const message = authenticationFailed
          ? "Razorpay authentication failed. Check that the key ID and secret are a matching pair in ozabay-backend/.env, then restart the backend."
          : gatewayError.error?.description ||
            "Unable to start online payment. Please try again or choose Cash on delivery.";
        return res.status(authenticationFailed ? 503 : 502).json({ message });
      }

      order.razorpayOrderId = gatewayOrder.id;
      await order.save();
      return res.status(201).json({
        order: order.toObject(),
        razorpay: {
          keyId: razorpayKeyId,
          orderId: gatewayOrder.id,
          amount: gatewayOrder.amount,
          currency: gatewayOrder.currency,
        },
      });
    }

    await order.save();
    return res.status(201).json({ order: order.toObject() });
  } catch (error) {
    return next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    if (!razorpayInstance || !razorpayKeySecret) {
      return res.status(503).json({ message: "Online payment is not configured." });
    }

    const { error, value } = verifyPaymentSchema.validate(req.body, {
      abortEarly: true,
    });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const order = await Order.findOne({
      _id: value.orderId,
      customerId: req.authUserId,
      paymentMethod: "Razorpay",
      razorpayOrderId: value.razorpay_order_id,
    });
    if (!order) {
      return res.status(404).json({ message: "Payment order was not found." });
    }
    if (order.paymentStatus === "paid") {
      if (order.razorpayPaymentId !== value.razorpay_payment_id) {
        return res.status(409).json({ message: "This order has already been paid." });
      }
      return res.status(200).json({ order });
    }

    const expectedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${value.razorpay_order_id}|${value.razorpay_payment_id}`)
      .digest();
    const receivedSignature = Buffer.from(value.razorpay_signature, "hex");
    if (
      receivedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return res.status(400).json({ message: "Payment verification failed." });
    }

    const payment = await razorpayInstance.payments.fetch(
      value.razorpay_payment_id,
    );
    if (
      payment.order_id !== order.razorpayOrderId ||
      payment.amount !== Math.round(order.total * 100) ||
      payment.currency !== "INR" ||
      payment.status !== "captured"
    ) {
      return res.status(400).json({
        message: "The payment has not been captured for this order.",
      });
    }

    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        customerId: req.authUserId,
        paymentStatus: { $ne: "paid" },
        orderStatus: { $ne: "Cancelled" },
      },
      {
        $set: {
          paymentStatus: "paid",
          paymentDetails: {
            provider: "Razorpay",
            transactionId: payment.id,
            method: payment.method || "Razorpay",
            amount: payment.amount / 100,
            currency: payment.currency,
            status: "paid",
            paidAt: Number.isFinite(payment.created_at)
              ? new Date(payment.created_at * 1000)
              : new Date(),
          },
          orderStatus: "Received",
          razorpayPaymentId: value.razorpay_payment_id,
        },
      },
      { new: true, runValidators: true },
    );
    if (!updatedOrder) {
      return res.status(409).json({
        message: "This order was cancelled before payment confirmation.",
      });
    }
    return res.status(200).json({ order: updatedOrder });
  } catch (error) {
    return next(error);
  }
};

const cancelCustomerOrder = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
      return res.status(400).json({ message: "Invalid order identifier." });
    }

    const currentOrder = await Order.findOne({
      _id: req.params.orderId,
      customerId: req.authUserId,
    }).select("orderStatus paymentStatus paymentMethod total razorpayOrderId");
    if (!currentOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (currentOrder.orderStatus === "Delivered") {
      return res.status(409).json({
        message: "This order has already been delivered and cannot be cancelled.",
      });
    }
    if (currentOrder.orderStatus === "Cancelled") {
      return res.status(200).json({
        message: "This order has already been cancelled.",
        order: await Order.findById(currentOrder._id).lean(),
      });
    }

    const now = new Date();
    let paid = currentOrder.paymentStatus === "paid";
    let capturedPayment;
    if (
      !paid
      && currentOrder.paymentStatus === "pending"
      && currentOrder.paymentMethod === "Razorpay"
      && currentOrder.razorpayOrderId
    ) {
      if (!razorpayInstance) {
        return res.status(503).json({
          message: "Unable to confirm payment status. Please try cancelling again shortly.",
        });
      }
      try {
        const gatewayPayments = await razorpayInstance.orders.fetchPayments(
          currentOrder.razorpayOrderId,
        );
        capturedPayment = gatewayPayments.items?.find(
          (payment) =>
            payment.order_id === currentOrder.razorpayOrderId
            && payment.status === "captured",
        );
        paid = Boolean(capturedPayment);
      } catch (gatewayError) {
        console.error("Unable to confirm payment before cancellation:", gatewayError);
        return res.status(503).json({
          message: "Unable to confirm payment status. Please try cancelling again shortly.",
        });
      }
    }

    const update = {
      $set: {
        orderStatus: "Cancelled",
        cancelledAt: now,
        cancellationRequestedBy: "customer",
        "items.$[item].fulfillmentStatus": "Cancelled",
      },
    };
    if (paid) {
      update.$set["paymentDetails.refundStatus"] = "pending";
      update.$set["paymentDetails.refundNote"] =
        "Manual refund required after customer cancellation.";
      if (capturedPayment) {
        update.$set.paymentStatus = "paid";
        update.$set.razorpayPaymentId = capturedPayment.id;
        update.$set["paymentDetails.provider"] = "Razorpay";
        update.$set["paymentDetails.transactionId"] = capturedPayment.id;
        update.$set["paymentDetails.method"] = capturedPayment.method || "Razorpay";
        update.$set["paymentDetails.amount"] = capturedPayment.amount / 100;
        update.$set["paymentDetails.currency"] = capturedPayment.currency;
        update.$set["paymentDetails.status"] = "paid";
        update.$set["paymentDetails.paidAt"] = Number.isFinite(capturedPayment.created_at)
          ? new Date(capturedPayment.created_at * 1000)
          : now;
      }
    } else if (currentOrder.paymentStatus === "pending") {
      update.$set.paymentStatus = "cancelled";
      update.$set["paymentDetails.status"] = "cancelled";
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: currentOrder._id,
        customerId: req.authUserId,
        paymentStatus: currentOrder.paymentStatus,
        orderStatus: { $nin: ["Delivered", "Cancelled"] },
        items: { $not: { $elemMatch: { fulfillmentStatus: "Delivered" } } },
      },
      update,
      {
        arrayFilters: [{ "item.fulfillmentStatus": { $ne: "Delivered" } }],
        new: true,
        runValidators: true,
      },
    );

    if (!order) {
      return res.status(409).json({
        message: "This order has already been delivered or its status changed. Refresh your order history.",
      });
    }

    return res.status(200).json({
      message: paid
        ? "Order cancelled. A refund has been flagged for admin follow-up."
        : "Order cancelled successfully.",
      order: formatCustomerOrder(order.toObject()),
    });
  } catch (error) {
    return next(error);
  }
};

const requestCustomerReturn = async (req, res, next) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.orderId)
      || !mongoose.Types.ObjectId.isValid(req.params.productId)
    ) {
      return res.status(400).json({ message: "Invalid order or product identifier." });
    }

    const { error, value } = returnRequestSchema.validate(req.body, {
      abortEarly: true,
      convert: true,
    });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const requestedAt = new Date();
    const windowStart = new Date(requestedAt.getTime() - RETURN_WINDOW_MS);
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        customerId: req.authUserId,
        items: {
          $elemMatch: {
            productId: new mongoose.Types.ObjectId(req.params.productId),
            fulfillmentStatus: "Delivered",
            deliveredAt: { $gt: windowStart, $lte: requestedAt },
            "returnRequest.status": { $in: ["none", "rejected", null] },
          },
        },
      },
      {
        $set: {
          "items.$[item].returnRequest.status": "requested",
          "items.$[item].returnRequest.reason": value.reason,
          "items.$[item].returnRequest.requestedAt": requestedAt,
        },
      },
      {
        arrayFilters: [
          {
            "item.productId": new mongoose.Types.ObjectId(req.params.productId),
            "item.fulfillmentStatus": "Delivered",
            "item.deliveredAt": { $gt: windowStart, $lte: requestedAt },
            "item.returnRequest.status": { $in: ["none", "rejected", null] },
          },
        ],
        new: true,
        runValidators: true,
      },
    );

    if (!order) {
      const currentOrder = await Order.findOne({
        _id: req.params.orderId,
        customerId: req.authUserId,
      }).select("items");
      if (!currentOrder) {
        return res.status(404).json({ message: "Order not found." });
      }
      const item = currentOrder.items.find(
        (entry) => String(entry.productId) === req.params.productId,
      );
      if (!item) {
        return res.status(404).json({ message: "Product was not found in this order." });
      }
      if (item.fulfillmentStatus !== "Delivered") {
        return res.status(409).json({
          message: "Returns are available after the vendor marks this product delivered.",
        });
      }
      if (
        !item.deliveredAt
        || item.deliveredAt.getTime() <= windowStart.getTime()
      ) {
        return res.status(409).json({ message: "The 7-day return window has ended." });
      }
      return res.status(409).json({
        message: "A return request has already been submitted or reviewed for this product.",
      });
    }

    return res.status(200).json({
      message: "Return request sent to the vendor for review.",
      order: formatCustomerOrder(order.toObject()),
    });
  } catch (error) {
    return next(error);
  }
};

const deriveOrderStatus = (items = [], fallback = "Received") => {
  const statuses = items
    .map((item) => item.fulfillmentStatus || fallback)
    .filter((status) => status && status !== "Payment failed");
  if (!statuses.length) return fallback;
  if (statuses.every((status) => status === "Delivered")) return "Delivered";
  if (statuses.every((status) => status === "Cancelled")) return "Cancelled";
  if (statuses.some((status) => status === "Shipped")) return "Shipped";
  if (statuses.some((status) => status === "Crafting")) return "Crafting";
  if (statuses.some((status) => status === "Received")) return "Received";
  return statuses[0];
};

const formatCustomerOrder = (order) => {
  const status =
    order.orderStatus === "Awaiting payment" || order.orderStatus === "Payment failed"
      ? order.orderStatus
      : deriveOrderStatus(order.items, order.orderStatus);
  return {
    ...order,
    orderStatus: status,
    items: (order.items || []).map((item) => ({
      ...item,
      fulfillmentStatus: item.fulfillmentStatus || order.orderStatus || "Received",
    })),
  };
};

const listCustomerOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ customerId: req.authUserId })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ orders: orders.map(formatCustomerOrder) });
  } catch (error) {
    return next(error);
  }
};

const listVendorOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({
      "items.vendorId": req.authUserId,
      orderStatus: { $nin: ["Awaiting payment", "Payment failed"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const vendorOrders = orders.map((order) => {
      const items = order.items.filter(
        (item) => String(item.vendorId) === String(req.authUserId),
      );
      return {
        ...order,
        items,
        total: items.reduce((sum, item) => sum + item.lineTotal, 0),
        orderStatus: deriveOrderStatus(items, order.orderStatus),
      };
    });
    return res.status(200).json({ orders: vendorOrders });
  } catch (error) {
    return next(error);
  }
};

const updateVendorOrderStatus = async (req, res, next) => {
  try {
    const { status } = await vendorFulfillmentSchema.validateAsync(req.body, {
      abortEarly: true,
    });
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        "items.vendorId": req.authUserId,
        orderStatus: { $nin: ["Awaiting payment", "Payment failed", "Cancelled"] },
        items: {
          $elemMatch: {
            vendorId: req.authUserId,
            fulfillmentStatus: { $ne: "Cancelled" },
          },
        },
      },
      {
        $set: { "items.$[item].fulfillmentStatus": status },
      },
      {
        arrayFilters: [
          {
            "item.vendorId": req.authUserId,
            "item.fulfillmentStatus": { $ne: "Cancelled" },
          },
        ],
        new: true,
      },
    );
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (status === "Delivered") {
      const deliveredAt = new Date();
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            "items.$[item].deliveredAt": deliveredAt,
          },
        },
        {
          arrayFilters: [
            {
              "item.vendorId": req.authUserId,
              "item.fulfillmentStatus": "Delivered",
              "item.deliveredAt": null,
            },
          ],
        },
      );
      for (const item of order.items) {
        if (
          String(item.vendorId) === String(req.authUserId)
          && item.fulfillmentStatus === "Delivered"
          && !item.deliveredAt
        ) {
          item.deliveredAt = deliveredAt;
        }
      }
    }

    const vendorItems = order.items.filter(
      (item) => String(item.vendorId) === String(req.authUserId),
    );
    if (!vendorItems.length) {
      return res.status(404).json({ message: "No items found for this vendor." });
    }

    const orderStatus = deriveOrderStatus(order.items, order.orderStatus);
    const statusUpdate = await Order.updateOne(
      { _id: order._id, orderStatus: { $ne: "Cancelled" } },
      { $set: { orderStatus } },
    );
    if (statusUpdate.matchedCount !== 1) {
      return res.status(409).json({
        message: "This order was cancelled while its status was being updated.",
      });
    }
    const updated = order.toObject();
    return res.status(200).json({
      message: "Order status updated.",
      order: {
        ...updated,
        items: vendorItems,
        total: vendorItems.reduce((sum, item) => sum + item.lineTotal, 0),
        orderStatus: deriveOrderStatus(vendorItems, orderStatus),
      },
    });
  } catch (error) {
    if (error?.isJoi) {
      return res.status(400).json({ message: error.details?.[0]?.message || "Invalid status." });
    }
    return next(error);
  }
};

const updateVendorOrderItemStatus = async (req, res, next) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.orderId)
      || !mongoose.Types.ObjectId.isValid(req.params.productId)
    ) {
      return res.status(400).json({ message: "Invalid order or product identifier." });
    }

    const { status } = await vendorFulfillmentSchema.validateAsync(req.body, {
      abortEarly: true,
    });
    const productId = new mongoose.Types.ObjectId(req.params.productId);
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        orderStatus: { $nin: ["Awaiting payment", "Payment failed", "Cancelled"] },
        items: {
          $elemMatch: {
            productId,
            vendorId: req.authUserId,
            fulfillmentStatus: { $ne: "Cancelled" },
          },
        },
      },
      {
        $set: { "items.$[item].fulfillmentStatus": status },
      },
      {
        arrayFilters: [
          {
            "item.productId": productId,
            "item.vendorId": req.authUserId,
            "item.fulfillmentStatus": { $ne: "Cancelled" },
          },
        ],
        new: true,
      },
    );
    if (!order) {
      return res.status(404).json({
        message: "Active product order not found for this vendor.",
      });
    }

    if (status === "Delivered") {
      const deliveredAt = new Date();
      await Order.updateOne(
        { _id: order._id },
        { $set: { "items.$[item].deliveredAt": deliveredAt } },
        {
          arrayFilters: [
            {
              "item.productId": productId,
              "item.vendorId": req.authUserId,
              "item.fulfillmentStatus": "Delivered",
              "item.deliveredAt": null,
            },
          ],
        },
      );
      const deliveredItem = order.items.find(
        (item) => String(item.productId) === String(productId),
      );
      if (deliveredItem && !deliveredItem.deliveredAt) {
        deliveredItem.deliveredAt = deliveredAt;
      }
    }

    const orderStatus = deriveOrderStatus(order.items, order.orderStatus);
    const statusUpdate = await Order.updateOne(
      { _id: order._id, orderStatus: { $ne: "Cancelled" } },
      { $set: { orderStatus } },
    );
    if (statusUpdate.matchedCount !== 1) {
      return res.status(409).json({
        message: "This order was cancelled while its status was being updated.",
      });
    }

    const vendorItems = order.items.filter(
      (item) => String(item.vendorId) === String(req.authUserId),
    );
    return res.status(200).json({
      message: `Product marked as ${status}.`,
      order: {
        ...order.toObject(),
        items: vendorItems,
        total: vendorItems.reduce((sum, item) => sum + item.lineTotal, 0),
        orderStatus: deriveOrderStatus(vendorItems, orderStatus),
      },
    });
  } catch (error) {
    if (error?.isJoi) {
      return res.status(400).json({
        message: error.details?.[0]?.message || "Invalid status.",
      });
    }
    return next(error);
  }
};

const collectVendorCashOnDelivery = async (req, res, next) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.orderId)
      || !mongoose.Types.ObjectId.isValid(req.params.productId)
    ) {
      return res.status(400).json({ message: "Invalid order or product identifier." });
    }

    const productId = new mongoose.Types.ObjectId(req.params.productId);
    const collectedAt = new Date();
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        paymentMethod: "Cash on delivery",
        orderStatus: { $nin: ["Awaiting payment", "Payment failed", "Cancelled"] },
        items: {
          $elemMatch: {
            productId,
            vendorId: req.authUserId,
            fulfillmentStatus: { $in: ["Received", "Crafting", "Shipped", "Delivered"] },
            "cashOnDelivery.status": { $ne: "paid" },
          },
        },
      },
      {
        $set: {
          "items.$[item].cashOnDelivery.status": "paid",
          "items.$[item].cashOnDelivery.collectedAt": collectedAt,
          "items.$[item].cashOnDelivery.collectedBy": req.authUserId,
        },
      },
      {
        arrayFilters: [
          {
            "item.productId": productId,
            "item.vendorId": req.authUserId,
            "item.fulfillmentStatus": {
              $in: ["Received", "Crafting", "Shipped", "Delivered"],
            },
            "item.cashOnDelivery.status": { $ne: "paid" },
          },
        ],
        new: true,
        runValidators: true,
      },
    );
    if (!order) {
      const currentOrder = await Order.findOne({
        _id: req.params.orderId,
        "items.productId": productId,
      }).select("paymentMethod items");
      if (!currentOrder) {
        return res.status(404).json({ message: "Order or product not found." });
      }
      if (currentOrder.paymentMethod !== "Cash on delivery") {
        return res.status(409).json({
          message: "This order was not placed with cash on delivery.",
        });
      }
      const item = currentOrder.items.find(
        (entry) =>
          String(entry.productId) === String(productId)
          && String(entry.vendorId) === String(req.authUserId),
      );
      if (!item) {
        return res.status(404).json({ message: "Product not found for this vendor." });
      }
      if (!["Received", "Crafting", "Shipped", "Delivered"].includes(item.fulfillmentStatus)) {
        return res.status(409).json({
          message: "Mark this product as received before recording COD collection.",
        });
      }
      return res.status(409).json({
        message: "COD payment has already been recorded for this product.",
      });
    }

    const activeItems = order.items.filter(
      (item) => item.fulfillmentStatus !== "Cancelled",
    );
    const allActiveItemsPaid =
      activeItems.length > 0
      && activeItems.every((item) => item.cashOnDelivery?.status === "paid");
    if (allActiveItemsPaid) {
      order.paymentStatus = "paid";
      order.paymentDetails.status = "paid";
      order.paymentDetails.paidAt = collectedAt;
      await order.save();
    }

    const vendorItems = order.items.filter(
      (item) => String(item.vendorId) === String(req.authUserId),
    );
    return res.status(200).json({
      message: "Cash-on-delivery payment recorded for this product.",
      order: {
        ...order.toObject(),
        items: vendorItems,
        total: vendorItems.reduce((sum, item) => sum + item.lineTotal, 0),
        orderStatus: deriveOrderStatus(vendorItems, order.orderStatus),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const reviewVendorReturnRequest = async (req, res, next) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.orderId)
      || !mongoose.Types.ObjectId.isValid(req.params.productId)
    ) {
      return res.status(400).json({ message: "Invalid order or product identifier." });
    }

    const { error, value } = vendorReturnDecisionSchema.validate(req.body, {
      abortEarly: true,
    });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        "items.vendorId": req.authUserId,
        items: {
          $elemMatch: {
            productId: new mongoose.Types.ObjectId(req.params.productId),
            vendorId: req.authUserId,
            fulfillmentStatus: "Delivered",
            "returnRequest.status": "requested",
          },
        },
      },
      {
        $set: {
          "items.$[item].returnRequest.status": value.status,
          "items.$[item].returnRequest.reviewedAt": new Date(),
          "items.$[item].returnRequest.reviewedBy": req.authUserId,
        },
      },
      {
        arrayFilters: [
          {
            "item.productId": new mongoose.Types.ObjectId(req.params.productId),
            "item.vendorId": req.authUserId,
            "item.fulfillmentStatus": "Delivered",
            "item.returnRequest.status": "requested",
          },
        ],
        new: true,
        runValidators: true,
      },
    );

    if (!order) {
      return res.status(409).json({
        message: "This product has no pending return request to review.",
      });
    }

    const vendorItems = order.items.filter(
      (item) => String(item.vendorId) === String(req.authUserId),
    );
    return res.status(200).json({
      message: `Return request ${value.status}.`,
      order: {
        ...order.toObject(),
        items: vendorItems,
        total: vendorItems.reduce((sum, item) => sum + item.lineTotal, 0),
        orderStatus: deriveOrderStatus(vendorItems, order.orderStatus),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export {
  collectVendorCashOnDelivery,
  createOrder,
  cancelCustomerOrder,
  listCustomerOrders,
  listVendorOrders,
  requestCustomerReturn,
  reviewVendorReturnRequest,
  updateVendorOrderItemStatus,
  updateVendorOrderStatus,
  verifyPayment,
};
