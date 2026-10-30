import jwt from "jsonwebtoken";
import config from "../config/config.js";
import Session from "../models/session.model.js";

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

    req.authUserId = decoded.userId;
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Your session has expired" });
    }
    return next(error);
  }
};

export default requireAuth;
