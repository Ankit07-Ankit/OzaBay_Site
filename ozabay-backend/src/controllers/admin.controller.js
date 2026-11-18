import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Joi from "joi";
import mongoose from "mongoose";
import config from "../config/config.js";
import AdminSession from "../models/admin-session.model.js";
import Order from "../models/order.model.js";
import OTP from "../models/otp.model.js";
import Session from "../models/session.model.js";
import User from "../models/user.model.js";
import UserProduct from "../models/user-product.model.js";
import VendorProduct from "../models/vendor-product.model.js";
import { removeVendorProduct } from "./vendor-product.controller.js";

const adminLoginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(1).max(200).required(),
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  search: Joi.string().trim().max(100).allow("").default(""),
  type: Joi.string().valid("all", "user", "vendor").default("all"),
  sort: Joi.string().valid("newest", "price_desc", "price_asc").default("newest"),
});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getPagination = (query) => paginationSchema.validate(query, {
  abortEarly: true,
  convert: true,
});

const setAdminCookie = (res, token) => {
  res.cookie("adminToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 1000,
  });
};

const adminLogin = async (req, res, next) => {
  const { error, value } = adminLoginSchema.validate(req.body, {
    abortEarly: true,
    convert: true,
  });
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD_HASH) {
    return res.status(503).json({ message: "Admin login has not been configured" });
  }

  try {
    const passwordMatches = await bcrypt.compare(
      value.password,
      config.ADMIN_PASSWORD_HASH,
    );
    if (
      value.email.toLowerCase() !== config.ADMIN_EMAIL
      || !passwordMatches
    ) {
      return res.status(401).json({ message: "Invalid admin email or password" });
    }

    const session = await AdminSession.create({
      email: config.ADMIN_EMAIL,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const token = jwt.sign(
      {
        admin: true,
        email: session.email,
        adminSessionId: session._id,
      },
      config.JWT_SECRET,
      { expiresIn: "1h" },
    );

    setAdminCookie(res, token);
    return res.status(200).json({
      message: "Admin signed in successfully",
      admin: { email: session.email },
    });
  } catch (loginError) {
    return next(loginError);
  }
};

const adminLogout = async (req, res, next) => {
  try {
    await AdminSession.updateOne(
      { _id: req.adminSessionId, revoked: false },
      { $set: { revoked: true } },
    );
    res.clearCookie("adminToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    return res.status(200).json({ message: "Admin signed out successfully" });
  } catch (error) {
    return next(error);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const [users, vendors, blockedAccounts, products, orders, paidOrders] = await Promise.all([
      User.countDocuments({ accountType: "user" }),
      User.countDocuments({ accountType: "vendor" }),
      User.countDocuments({ isBlocked: true }),
      VendorProduct.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);
    return res.status(200).json({
      summary: {
        users,
        vendors,
        blockedAccounts,
        products,
        orders,
        paidRevenue: paidOrders[0]?.total || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listAccounts = async (req, res, next) => {
  const { error, value } = getPagination(req.query);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const filter = value.type === "all" ? {} : { accountType: value.type };
    if (value.search) {
      const matcher = new RegExp(escapeRegex(value.search), "i");
      filter.$or = [{ name: matcher }, { email: matcher }];
    }
    const [accounts, total] = await Promise.all([
      User.find(filter)
        .select("name email accountType verified isBlocked moderationNote createdAt")
        .sort({ createdAt: -1 })
        .skip((value.page - 1) * value.limit)
        .limit(value.limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    return res.status(200).json({
      accounts,
      pagination: {
        page: value.page,
        limit: value.limit,
        total,
        pages: Math.ceil(total / value.limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listProducts = async (req, res, next) => {
  const { error, value } = getPagination(req.query);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const filter = value.search
      ? {
          $or: ["name", "category", "description"].map((field) => ({
            [field]: new RegExp(escapeRegex(value.search), "i"),
          })),
        }
      : {};
    const [products, total] = await Promise.all([
      VendorProduct.find(filter)
        .select("name description category price discountPercent offer images vendorId createdAt")
        .populate("vendorId", "name email accountType isBlocked")
        .sort(
          value.sort === "price_desc"
            ? { price: -1 }
            : value.sort === "price_asc"
              ? { price: 1 }
              : { createdAt: -1 },
        )
        .skip((value.page - 1) * value.limit)
        .limit(value.limit)
        .lean(),
      VendorProduct.countDocuments(filter),
    ]);
    return res.status(200).json({
      products,
      pagination: {
        page: value.page,
        limit: value.limit,
        total,
        pages: Math.ceil(total / value.limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listOrders = async (req, res, next) => {
  const { error, value } = getPagination(req.query);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const filter = {};
    if (value.search) {
      const matcher = new RegExp(escapeRegex(value.search), "i");
      filter.$or = [
        { "customer.name": matcher },
        { "customer.email": matcher },
        { "customer.phone": matcher },
        { "items.name": matcher },
        { paymentMethod: matcher },
        { "paymentDetails.transactionId": matcher },
        { razorpayOrderId: matcher },
        { razorpayPaymentId: matcher },
      ];
      if (mongoose.Types.ObjectId.isValid(value.search)) {
        filter.$or.push({ _id: new mongoose.Types.ObjectId(value.search) });
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((value.page - 1) * value.limit)
        .limit(value.limit)
        .lean(),
      Order.countDocuments(filter),
    ]);
    return res.status(200).json({
      orders,
      pagination: {
        page: value.page,
        limit: value.limit,
        total,
        pages: Math.ceil(total / value.limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const updateAccountStatus = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.accountId)) {
    return res.status(400).json({ message: "Invalid account identifier" });
  }
  const schema = Joi.object({
    blocked: Joi.boolean().required(),
    reason: Joi.string().trim().max(500).allow("").default(""),
  });
  const { error, value } = schema.validate(req.body, { abortEarly: true });
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const account = await User.findById(req.params.accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    account.isBlocked = value.blocked;
    account.moderationNote = value.blocked ? value.reason : "";
    await account.save();
    if (value.blocked) {
      await Session.updateMany(
        { userId: account._id, revoked: false },
        { $set: { revoked: true } },
      );
    }
    return res.status(200).json({
      message: value.blocked ? "Account blocked" : "Account access restored",
      account: {
        id: account._id,
        isBlocked: account.isBlocked,
        moderationNote: account.moderationNote,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.accountId)) {
    return res.status(400).json({ message: "Invalid account identifier" });
  }

  try {
    const account = await User.findById(req.params.accountId).select("_id accountType");
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    account.isBlocked = true;
    await account.save();
    await Session.updateMany(
      { userId: account._id, revoked: false },
      { $set: { revoked: true } },
    );
    if (account.accountType === "vendor") {
      const products = await VendorProduct.find({ vendorId: account._id });
      for (const product of products) {
        await removeVendorProduct(product._id);
      }
    }
    await Promise.all([
      UserProduct.deleteMany({ userId: account._id }),
      Session.deleteMany({ userId: account._id }),
      OTP.deleteMany({ userId: account._id }),
    ]);
    await User.findByIdAndDelete(account._id);
    return res.status(200).json({ message: "Account removed" });
  } catch (error) {
    return next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.productId)) {
    return res.status(400).json({ message: "Invalid product identifier" });
  }

  try {
    const product = await removeVendorProduct(req.params.productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json({ message: "Product removed from the marketplace" });
  } catch (error) {
    return next(error);
  }
};

export {
  adminLogin,
  adminLogout,
  deleteAccount,
  deleteProduct,
  getSummary,
  listAccounts,
  listOrders,
  listProducts,
  updateAccountStatus,
};
