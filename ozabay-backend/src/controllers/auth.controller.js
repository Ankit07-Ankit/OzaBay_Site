import userModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import Session from "../models/session.model.js";
import sendEmail from "../services/email.service.js";
import { generateOTP, otpHtmlTemplate } from "../utils/otp.utils.js";
import OTP from "../models/otp.model.js";
import crypto from "node:crypto";
import dotenv from "dotenv";
dotenv.config();

const register = async (req, res) => {
  const { name, password, accountType = "user" } = req.body;
  const email = req.body.email.trim().toLowerCase();

  try {
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
      accountType,
    });

    await newUser.save();

    const otp = generateOTP();

    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const newOTP = new OTP({
      userId: newUser._id,
      email: newUser.email,
      otpHash,
      expiresAt: otpExpiry,
      purpose: "email_verification",
    });

    await newOTP.save();

    const emailSubject = "Verify your email";
    const emailText = `Your OTP for email verification is: ${otp}. It will expire in 10 minutes.`;
    const emailHtml = otpHtmlTemplate(otp);

    await sendEmail(newUser.email, emailSubject, emailText, emailHtml);

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        accountType: newUser.accountType,
        verified: newUser.verified,
      },
    });
  } catch (error) {
    console.error("Error registering user:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  const { password } = req.body;
  const email = req.body.email.trim().toLowerCase();

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!user.verified) {
      return res.status(403).json({ message: "Email is not verified" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const refreshToken = jwt.sign(
      { userId: user._id },
      config.JWT_REFRESH_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const session = new Session({
      userId: user._id,
      refreshTokenHash,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await session.save();

    const accessToken = jwt.sign(
      { userId: user._id, sessionId: session._id },
      config.JWT_SECRET,
      {
        expiresIn: "1h",
      },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Set to true in production
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      message: "User Logged in successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
        deliveryLocation: user.deliveryLocation,
        deliveryLocations: user.deliveryLocations,
      },
      accessToken,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getMe = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Assuming the token is sent in the Authorization header as "Bearer <token>"
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const decoded = jwt.verify(token, config.JWT_SECRET);

  console.log("Decoded token:", decoded);

  const user = await userModel.findById(decoded.userId).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.status(200).json({
    message: "User fetched successfully",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      accountType: user.accountType,
      deliveryLocation: user.deliveryLocation,
      deliveryLocations: user.deliveryLocations,
    },
  });
};

const refreshToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);

    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const newRefreshToken = jwt.sign(
      { userId: decoded.userId },
      config.JWT_REFRESH_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const newRefreshTokenHash = crypto
      .createHash("sha256")
      .update(newRefreshToken)
      .digest("hex");

    const session = await Session.findOneAndUpdate(
      {
        userId: decoded.userId,
        refreshTokenHash,
        revoked: false,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          refreshTokenHash: newRefreshTokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      { returnDocument: "after" },
    );

    if (!session) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      return res.status(401).json({
        message: "Your session has expired. Please sign in again.",
      });
    }

    const accessToken = jwt.sign(
      { userId: decoded.userId, sessionId: session._id },
      config.JWT_SECRET,
      {
        expiresIn: "1h",
      },
    );

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      message: "Access token refreshed successfully",
      accessToken,
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      return res.status(401).json({
        message: "Your session has expired. Please sign in again.",
      });
    }

    console.error("Error refreshing access token:", error);
    return res.status(500).json({ message: "Unable to refresh your session" });
  }
};

const logOut = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ message: "No refresh token provided" });
    }

    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const session = await Session.findOne({
      refreshTokenHash,
      revoked: false,
    });
    if (!session) {
      return res.status(400).json({ message: "Invalid refresh token" });
    }

    session.revoked = true;
    await session.save();

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    console.error("Error logging out:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const logOutAll = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ message: "No refresh token provided" });
    }

    // const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);

    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const session = await Session.findOne({
      refreshTokenHash,
      revoked: false,
    });
    if (!session) {
      return res.status(400).json({ message: "Invalid refresh token" });
    }

    await Session.updateMany(
      { userId: session.userId, revoked: false },
      { $set: { revoked: true } },
    );

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      message: "User logged out from all sessions successfully",
    });
  } catch (error) {
    console.error("Error logging out from all sessions:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const verifyEmail = async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const { otp } = req.body;
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  try {
    const otpRecord = await OTP.findOne({
      email,
      otpHash,
      $or: [{ purpose: "email_verification" }, { purpose: { $exists: false } }],
    });
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    const user = await userModel.findById(otpRecord.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.verified = true;
    await user.save();

    await OTP.deleteMany({ email }); // Remove all OTP records for this email

    return res.status(200).json({
      message: "Email verified successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
      },
    });
  } catch (error) {
    console.error("Error verifying email:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const requestPasswordReset = async (req, res) => {
  const email = req.body.email.trim().toLowerCase();

  try {
    const user = await userModel.findOne({ email, verified: true });
    if (user) {
      const recentRequest = await OTP.findOne({
        userId: user._id,
        purpose: "password_reset",
        createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
      });
      if (recentRequest) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((recentRequest.createdAt.getTime() + 60 * 1000 - Date.now()) / 1000),
        );
        return res.status(429).json({
          message: `A reset code was sent recently. Check your inbox or request another in ${retryAfterSeconds} seconds.`,
          retryAfterSeconds,
        });
      }

      await OTP.deleteMany({ userId: user._id, purpose: "password_reset" });

      const otp = generateOTP();
      const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
      const otpRecord = await OTP.create({
        userId: user._id,
        email: user.email,
        otpHash,
        purpose: "password_reset",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      try {
        await sendEmail(
          user.email,
          "Reset your OzaBay password",
          `Your password reset code is: ${otp}. It will expire in 10 minutes.`,
          otpHtmlTemplate(otp, "password reset"),
        );
      } catch (error) {
        try {
          await OTP.deleteOne({ _id: otpRecord._id });
        } catch (cleanupError) {
          console.error("Unable to remove an unsent password reset code:", cleanupError);
        }
        throw error;
      }
    }

    return res.status(200).json({
      message: "If a verified account exists for that email, a reset code has been sent.",
    });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    if (error.message === "Failed to send email") {
      return res.status(502).json({
        message: "Unable to send the reset code right now. Please try again shortly.",
      });
    }
    return res.status(500).json({ message: "Unable to process your password reset request" });
  }
};

const resetPassword = async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const submittedHash = crypto.createHash("sha256").update(req.body.otp).digest("hex");

  try {
    const otpRecord = await OTP.findOne({ email, purpose: "password_reset" })
      .sort({ createdAt: -1 });
    if (!otpRecord || otpRecord.expiresAt < new Date() || otpRecord.attempts >= 5) {
      return res.status(400).json({ message: "The reset code is invalid or expired. Request a new one." });
    }

    const expected = Buffer.from(otpRecord.otpHash, "hex");
    const submitted = Buffer.from(submittedHash, "hex");
    if (
      expected.length !== submitted.length
      || !crypto.timingSafeEqual(expected, submitted)
    ) {
      await OTP.updateOne(
        {
          _id: otpRecord._id,
          attempts: { $lt: 5 },
          expiresAt: { $gt: new Date() },
        },
        { $inc: { attempts: 1 } },
      );
      return res.status(400).json({ message: "The reset code is invalid or expired. Request a new one." });
    }

    const claimedOTP = await OTP.findOneAndDelete({
      _id: otpRecord._id,
      otpHash: submittedHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    });
    if (!claimedOTP) {
      return res.status(400).json({ message: "The reset code is invalid or expired. Request a new one." });
    }

    const user = await userModel.findById(claimedOTP.userId);
    if (!user || !user.verified) {
      return res.status(400).json({ message: "The reset code is invalid or expired. Request a new one." });
    }

    user.password = await bcrypt.hash(req.body.password, 10);
    await user.save();
    await Promise.all([
      OTP.deleteMany({ userId: user._id, purpose: "password_reset" }),
      Session.updateMany({ userId: user._id, revoked: false }, { $set: { revoked: true } }),
    ]);

    return res.status(200).json({ message: "Password reset successfully. Sign in with your new password." });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ message: "Unable to reset your password" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await userModel.findById(req.authUserId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      name,
      email,
      currentPassword,
      password,
      deliveryLocation,
      deliveryLocations,
      activeLocationIndex,
    } = req.body;

    const emailChanged = email !== undefined && email.trim().toLowerCase() !== user.email;
    if ((password || emailChanged) && !currentPassword) {
      return res.status(400).json({
        message: "Enter your current password to update your email or password",
      });
    }

    if (password || emailChanged) {
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Your current password is incorrect" });
      }
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email.trim().toLowerCase();
    if (deliveryLocations !== undefined) {
      user.deliveryLocations = deliveryLocations;
      if (activeLocationIndex === null) {
        user.deliveryLocation = null;
      } else if (activeLocationIndex !== undefined) {
        user.deliveryLocation = user.deliveryLocations[activeLocationIndex];
      }
    } else if (deliveryLocation !== undefined) {
      user.deliveryLocation = deliveryLocation;
      user.deliveryLocations = deliveryLocation ? [deliveryLocation] : [];
    }

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
        deliveryLocation: user.deliveryLocation,
        deliveryLocations: user.deliveryLocations,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account already uses that email address" });
    }
    console.error("Error updating profile:", error);
    return res.status(500).json({ message: "Unable to update your profile" });
  }
};

export {
  register,
  login,
  getMe,
  refreshToken,
  logOut,
  logOutAll,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  updateProfile,
};
