import jwt from "jsonwebtoken";
import config from "../config/config.js";
import AdminSession from "../models/admin-session.model.js";

const requireAdmin = async (req, res, next) => {
  const token = req.cookies?.adminToken;
  if (!token) {
    return res.status(401).json({ message: "Admin authentication is required" });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    if (decoded.admin !== true || !decoded.adminSessionId) {
      return res.status(403).json({ message: "Administrator access is required" });
    }

    const session = await AdminSession.findOne({
      _id: decoded.adminSessionId,
      email: decoded.email,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });
    if (!session) {
      return res.status(401).json({ message: "Your admin session has expired" });
    }

    req.adminEmail = session.email;
    req.adminSessionId = session._id;
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Your admin session has expired" });
    }
    return next(error);
  }
};

export default requireAdmin;
