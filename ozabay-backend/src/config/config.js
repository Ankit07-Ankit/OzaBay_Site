import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
const googleUser = process.env.GOOGLE_USER?.trim();
const emailFrom = process.env.EMAIL_FROM?.trim() || googleUser;
const emailReplyTo = process.env.EMAIL_REPLY_TO?.trim() || "";

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is not defined in the environment variables");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in the environment variables");
}

if (!googleClientId) {
  throw new Error(
    "GOOGLE_CLIENT_ID is not defined in the environment variables",
  );
}

if (!googleClientSecret) {
  throw new Error(
    "GOOGLE_CLIENT_SECRET is not defined in the environment variables",
  );
}

if (!googleRefreshToken) {
  throw new Error(
    "GOOGLE_REFRESH_TOKEN is not defined in the environment variables",
  );
}

if (!googleUser) {
  throw new Error("GOOGLE_USER is not defined in the environment variables");
}

const config = {
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  GOOGLE_CLIENT_ID: googleClientId,
  GOOGLE_CLIENT_SECRET: googleClientSecret,
  GOOGLE_REFRESH_TOKEN: googleRefreshToken,
  GOOGLE_USER: googleUser,
  EMAIL_FROM: emailFrom,
  EMAIL_REPLY_TO: emailReplyTo,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL?.trim().toLowerCase() || "",
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || "",
};

export default config;
