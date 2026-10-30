import User from "../models/user.model.js";

const requireVendor = async (req, res, next) => {
  try {
    const user = await User.findById(req.authUserId).select("accountType");
    if (!user) {
      return res.status(401).json({ message: "Your account could not be found" });
    }
    if (user.accountType !== "vendor") {
      return res.status(403).json({ message: "A vendor account is required" });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

export default requireVendor;
