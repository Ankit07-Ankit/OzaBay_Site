import userModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import Session from "../models/session.model.js";
import {
  createAdminSession,
  isAdminLoginConfigured,
  verifyAdminPassword,
} from "../services/admin-auth.service.js";
import sendEmail from "../services/email.service.js";
import { generateOTP, otpHtmlTemplate } from "../utils/otp.utils.js";
import OTP from "../models/otp.model.js";
import crypto, {
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import dotenv from "dotenv";
dotenv.config();

const googleKeysUrl = "https://www.googleapis.com/oauth2/v3/certs";
let googlePublicKeys;
let googlePublicKeysExpireAt = 0;

class GoogleKeyFetchError extends Error {}

const getGooglePublicKeys = async (refresh = false) => {
  if (!refresh && googlePublicKeys && Date.now() < googlePublicKeysExpireAt) {
    return googlePublicKeys;
  }

  let response;
  try {
    response = await fetch(googleKeysUrl, { signal: AbortSignal.timeout(5000) });
  } catch (error) {
    throw new GoogleKeyFetchError("Unable to retrieve Google signing keys", { cause: error });
  }
  if (!response.ok) {
    throw new GoogleKeyFetchError(
      `Unable to retrieve Google signing keys (${response.status})`,
    );
  }

  const keySet = await response.json();
  if (!Array.isArray(keySet.keys)) {
    throw new GoogleKeyFetchError("Google returned an invalid signing key set");
  }
  const maxAge = response.headers.get("cache-control")?.match(/max-age=(\d+)/i)?.[1];
  googlePublicKeys = new Map(keySet.keys.map((key) => [key.kid, key]));
  googlePublicKeysExpireAt = Date.now() + (Number(maxAge) || 300) * 1000;
  return googlePublicKeys;
};

const verifyGoogleCredential = async (credential) => {
  const [headerPart, payloadPart, signaturePart, extraPart] = credential.split(".");
  if (!headerPart || !payloadPart || !signaturePart || extraPart !== undefined) {
    throw new Error("Malformed Google ID token");
  }

  const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Unsupported Google ID token signature");
  }

  let keys = await getGooglePublicKeys();
  if (!keys.has(header.kid)) {
    keys = await getGooglePublicKeys(true);
  }
  const jwk = keys.get(header.kid);
  if (!jwk) {
    throw new Error("Unknown Google ID token signing key");
  }

  const verified = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${headerPart}.${payloadPart}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(signaturePart, "base64url"),
  );
  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (
    !verified
    || !audience.includes(config.GOOGLE_CLIENT_ID)
    || (payload.azp && payload.azp !== config.GOOGLE_CLIENT_ID)
    || !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)
    || !Number.isFinite(payload.exp)
    || payload.exp <= now
    || !Number.isFinite(payload.iat)
    || payload.iat > now + 60
  ) {
    throw new Error("Invalid or expired Google ID token");
  }
  return payload;
};

const createAuthenticatedSession = async (user, req, res) => {
  const refreshToken = jwt.sign(
    { userId: user._id },
    config.JWT_REFRESH_SECRET,
    { expiresIn: "7d" },
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
    { expiresIn: "1h" },
  );
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      accountType: user.accountType,
      deliveryLocation: user.deliveryLocation,
      deliveryLocations: user.deliveryLocations,
      shopLocations: user.shopLocations || [],
    },
    accessToken,
  };
};

const register = async (req, res) => {
  const { name, password, accountType = "user" } = req.body;
  const email = req.body.email.trim().toLowerCase();

  try {
    const existingUser = await userModel.findOne({ email });
    if (existingUser?.verified) {
      return res.status(400).json({ message: "User already exists" });
    }

    // A previous registration may have created the account before Gmail failed.
    // Let the same account owner retry using their password and send a fresh code.
    if (existingUser && !(await bcrypt.compare(password, existingUser.password || ""))) {
      return res.status(400).json({ message: "User already exists" });
    }

    const isNewUser = !existingUser;
    let newUser = existingUser;
    if (isNewUser) {
      const hashedPassword = await bcrypt.hash(password, 10);
      newUser = new userModel({ name, email, password: hashedPassword, accountType });
      await newUser.save();
    }

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

    try {
      await sendEmail(newUser.email, emailSubject, emailText, emailHtml);
    } catch (error) {
      const cleanup = await Promise.allSettled([
        OTP.deleteOne({ _id: newOTP._id }),
        ...(isNewUser ? [userModel.deleteOne({ _id: newUser._id, verified: false })] : []),
      ]);
      cleanup.forEach((result) => {
        if (result.status === "rejected") {
          console.error("Unable to clean up a failed email verification attempt:", result.reason);
        }
      });
      throw error;
    }

    // Keep only the code that was just delivered.
    await OTP.deleteMany({
      userId: newUser._id,
      purpose: "email_verification",
      _id: { $ne: newOTP._id },
    });

    return res.status(isNewUser ? 201 : 200).json({
      message: isNewUser ? "User registered successfully" : "Verification email sent",
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
    if (error.message === "Failed to send email") {
      return res.status(502).json({
        message: "We couldn't send the verification email. Check the email service settings or try again later.",
      });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  const { password } = req.body;
  const email = req.body.email.trim().toLowerCase();

  try {
    if (isAdminLoginConfigured() && email === config.ADMIN_EMAIL) {
      if (!(await verifyAdminPassword(password))) {
        return res.status(400).json({ message: "Invalid email or password" });
      }
      const adminSession = await createAdminSession(req, res);
      return res.status(200).json({
        message: "Admin signed in successfully",
        admin: { email: adminSession.email },
        adminToken: adminSession.token,
      });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!user.verified) {
      return res.status(403).json({ message: "Email is not verified" });
    }

    const isPasswordValid = user.password
      ? await bcrypt.compare(password, user.password)
      : false;
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: "This account has been blocked" });
    }

    const session = await createAuthenticatedSession(user, req, res);
    return res.status(200).json({
      message: "User Logged in successful",
      ...session,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const googleLogin = async (req, res) => {
  let payload;
  try {
    payload = await verifyGoogleCredential(req.body.credential);
  } catch (error) {
    if (error instanceof GoogleKeyFetchError) {
      console.error("Google sign-in verification service is unavailable:", error);
      return res.status(503).json({
        message: "Google sign-in is temporarily unavailable. Please try again.",
      });
    }
    console.warn("Google ID token verification failed:", error.message);
    return res.status(401).json({ message: "Google sign-in failed. Please try again." });
  }

  if (
    typeof payload?.email !== "string"
    || payload.email_verified !== true
  ) {
    return res.status(401).json({
      message: "Google must provide a verified email address to sign in.",
    });
  }

  try {
    const email = payload.email.trim().toLowerCase();
    let user;
    try {
      user = await userModel.findOneAndUpdate(
        { email },
        {
          $setOnInsert: {
            name: (typeof payload.name === "string" && payload.name.trim())
              || email.split("@")[0],
            email,
            accountType: "user",
            verified: true,
          },
        },
        {
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
          upsert: true,
        },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      user = await userModel.findOne({ email });
    }

    if (!user) {
      throw new Error("Unable to find or create the Google account");
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: "This account has been blocked" });
    }
    if (!user.verified) {
      user.verified = true;
      await user.save();
    }

    const session = await createAuthenticatedSession(user, req, res);
    return res.status(200).json({
      message: "Google sign-in successful",
      ...session,
    });
  } catch (error) {
    console.error("Error signing in with Google:", error);
    return res.status(500).json({ message: "Unable to complete Google sign-in" });
  }
};

const getGoogleClientId = (req, res) => {
  return res.status(200).json({ clientId: config.GOOGLE_CLIENT_ID });
};

const getMe = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Assuming the token is sent in the Authorization header as "Bearer <token>"
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const decoded = jwt.verify(token, config.JWT_SECRET);

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
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
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
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
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
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
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
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
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
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
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
      deliveryLocation,
      deliveryLocations,
      activeLocationIndex,
    } = req.body;

    const emailChanged = email !== undefined && email.trim().toLowerCase() !== user.email;
    if (emailChanged && !currentPassword) {
      return res.status(400).json({
        message: "Enter your current password to update your email address",
      });
    }

    if (emailChanged) {
      const isPasswordValid = user.password
        ? await bcrypt.compare(currentPassword, user.password)
        : false;
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Your current password is incorrect" });
      }
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
        shopLocations: user.shopLocations || [],
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

const requestPasswordChange = async (req, res) => {
  try {
    const user = await userModel.findById(req.authUserId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = user.password
      ? await bcrypt.compare(req.body.password, user.password)
      : false;
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Your current password is incorrect" });
    }

    const recentRequest = await OTP.findOne({
      userId: user._id,
      purpose: "password_change",
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    });
    if (recentRequest) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((recentRequest.createdAt.getTime() + 60 * 1000 - Date.now()) / 1000),
      );
      return res.status(429).json({
        message: `A verification code was sent recently. Check your inbox or request another in ${retryAfterSeconds} seconds.`,
        retryAfterSeconds,
      });
    }

    await OTP.deleteMany({ userId: user._id, purpose: "password_change" });

    const otp = generateOTP();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const otpRecord = await OTP.create({
      userId: user._id,
      email: user.email,
      otpHash,
      purpose: "password_change",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    try {
      await sendEmail(
        user.email,
        "Confirm your OzaBay password change",
        `Your password change code is: ${otp}. It will expire in 10 minutes.`,
        otpHtmlTemplate(otp, "password change"),
      );
    } catch (error) {
      try {
        await OTP.deleteOne({ _id: otpRecord._id });
      } catch (cleanupError) {
        console.error("Unable to remove an unsent password change code:", cleanupError);
      }
      throw error;
    }

    return res.status(200).json({
      message: "We sent a verification code to your registered email address.",
      email: user.email,
    });
  } catch (error) {
    console.error("Error requesting password change:", error);
    if (error.message === "Failed to send email") {
      return res.status(502).json({
        message: "Unable to send the verification code right now. Please try again shortly.",
      });
    }
    return res.status(500).json({ message: "Unable to start password change verification" });
  }
};

const confirmPasswordChange = async (req, res) => {
  const submittedHash = crypto.createHash("sha256").update(req.body.otp).digest("hex");

  try {
    const otpRecord = await OTP.findOne({
      userId: req.authUserId,
      purpose: "password_change",
    }).sort({ createdAt: -1 });

    if (!otpRecord || otpRecord.expiresAt < new Date() || otpRecord.attempts >= 5) {
      return res.status(400).json({ message: "The verification code is invalid or expired. Request a new one." });
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
      return res.status(400).json({ message: "The verification code is invalid or expired. Request a new one." });
    }

    const claimedOTP = await OTP.findOneAndDelete({
      _id: otpRecord._id,
      otpHash: submittedHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    });
    if (!claimedOTP) {
      return res.status(400).json({ message: "The verification code is invalid or expired. Request a new one." });
    }

    const user = await userModel.findById(req.authUserId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = await bcrypt.hash(req.body.password, 10);
    await user.save();
    await Promise.all([
      OTP.deleteMany({ userId: user._id, purpose: "password_change" }),
      Session.updateMany(
        { userId: user._id, revoked: false, _id: { $ne: req.authSessionId } },
        { $set: { revoked: true } },
      ),
    ]);

    return res.status(200).json({
      message: "Password changed successfully. Your other sessions were signed out.",
    });
  } catch (error) {
    console.error("Error confirming password change:", error);
    return res.status(500).json({ message: "Unable to change your password" });
  }
};

export {
  register,
  login,
  googleLogin,
  getGoogleClientId,
  getMe,
  refreshToken,
  logOut,
  logOutAll,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  requestPasswordChange,
  confirmPasswordChange,
  updateProfile,
};
