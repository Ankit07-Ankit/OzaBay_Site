import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import AdminSession from "../models/admin-session.model.js";

const isAdminLoginConfigured = () =>
  Boolean(config.ADMIN_EMAIL && config.ADMIN_PASSWORD_HASH);

const verifyAdminPassword = (password) =>
  bcrypt.compare(password, config.ADMIN_PASSWORD_HASH);

const createAdminSession = async (req, res) => {
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

  res.cookie("adminToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    maxAge: 60 * 60 * 1000,
  });
  return { email: session.email };
};

export {
  createAdminSession,
  isAdminLoginConfigured,
  verifyAdminPassword,
};
