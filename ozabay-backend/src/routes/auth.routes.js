import { Router } from "express";
import {
  registerValidation,
  loginValidation,
  verifyEmailValidation,
  profileValidation,
  requestPasswordResetValidation,
  resetPasswordValidation,
} from "../middleware/auth.validation.js";
import requireAuth from "../middleware/auth.middleware.js";
import {
  login,
  register,
  getMe,
  refreshToken,
  logOut,
  logOutAll,
  verifyEmail,
  updateProfile,
  requestPasswordReset,
  resetPassword,
} from "../controllers/auth.controller.js";

const authRouter = Router();

// Define your authentication routes here
/**
 * Post /api/auth/login
 * @desc Authenticate user and return token
 * @access Public
 */

authRouter.post("/login", loginValidation, login);

/**
 * Post /api/auth/register
 * @desc Register a new user
 * @access Public
 */
authRouter.post("/register", registerValidation, register);

/**
 * Get /api/auth/me
 * @desc Get current user's profile
 * @access Private
 */
authRouter.get("/me", getMe);

/**
 * Get /api/auth/refresh-token
 * @desc Refresh access token using refresh token
 * @access Public
 */
authRouter.get("/refresh-token", refreshToken);

/**
 * Get /api/auth/logout
 * @desc Logout user and clear refresh token
 * @access Public
 */
authRouter.get("/logout", logOut);

/**
 * Get /api/auth/logout-all
 * @desc Logout user from all sessions and clear refresh tokens
 * @access Public
 */
authRouter.get("/logout-all", logOutAll);

/**
 * Post /api/auth/verify-email
 * @desc Verify user's email
 * @access Public
 */
authRouter.post("/verify-email", verifyEmailValidation, verifyEmail);

authRouter.post("/forgot-password", requestPasswordResetValidation, requestPasswordReset);
authRouter.post("/reset-password", resetPasswordValidation, resetPassword);

/**
 * Patch /api/auth/profile
 * @desc Update the authenticated user's profile and delivery location
 * @access Private
 */
authRouter.patch("/profile", requireAuth, profileValidation, updateProfile);

export default authRouter;
