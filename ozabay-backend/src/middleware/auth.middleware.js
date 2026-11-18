import jwt from "jsonwebtoken";
import config from "../config/config.js";
import Session from "../models/session.model.js";
import User from "../models/user.model.js";

const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Authentication is required" });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const session = await Session.findOne({
      _id: decoded.sessionId,
      userId: decoded.userId,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return res.status(401).json({ message: "Your session has expired" });
    }

    const user = await User.findById(decoded.userId).select("isBlocked");
    if (!user) {
      return res.status(401).json({ message: "Your account is no longer available" });
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: "This account has been blocked" });
    }

    req.authUserId = decoded.userId;
    req.authSessionId = decoded.sessionId;
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Your session has expired" });
    }
    return next(error);
  }
};

export default requireAuth;
