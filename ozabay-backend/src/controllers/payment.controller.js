import Razorpay from "razorpay";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const standardKeyId = process.env.RAZORPAY_KEY_ID?.trim();
const standardKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
const legacyKeyId = process.env.RAZORPAY_API_KEY?.trim();
const legacyKeySecret = process.env.RAZORPAY_SECRET_KEY?.trim();
const [razorpayKeyId, razorpayKeySecret] =
  standardKeyId && standardKeySecret
    ? [standardKeyId, standardKeySecret]
    : legacyKeyId && legacyKeySecret
      ? [legacyKeyId, legacyKeySecret]
      : [null, null];

if (!razorpayKeyId || !razorpayKeySecret) {
  console.warn(
    "Razorpay credentials are missing. Set RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET (or RAZORPAY_API_KEY/RAZORPAY_SECRET_KEY) in ozabay-backend/.env.",
  );
}

const razorpayInstance =
  razorpayKeyId && razorpayKeySecret
    ? new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret,
      })
    : null;

export {
  razorpayInstance,
  razorpayKeyId,
  razorpayKeySecret,
  razorpayWebhookSecret,
};
