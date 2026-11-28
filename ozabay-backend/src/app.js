import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRouter from "./routes/auth.routes.js";
import orderRouter from "./routes/order.routes.js";
import { handleRazorpayWebhook } from "./controllers/order.controller.js";
import vendorRouter from "./routes/vendor.routes.js";
import productRouter from "./routes/product.routes.js";
import userProductRouter from "./routes/user-product.routes.js";
import geocodeRouter from "./routes/geocode.routes.js";
import adminRouter from "./routes/admin.routes.js";
import supportRouter from "./routes/support.routes.js";
import cookieParser from "cookie-parser";
import { getVendorProductUploadDirectory } from "./middleware/vendor-product-upload.js";

import { createStudioBrief, receiveStudioBrief } from "./controllers/studio-brief.controller.js";

const app = express();
const frontendOrigins = [
  "https://ozabay.com",
  "https://www.ozabay.com",
  "https://oza-bay-site-iota.vercel.app",
  ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173"]),
  ...(process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
}));
app.post(
  "/api/orders/razorpay/webhook",
  express.raw({ type: "application/json" }),
  handleRazorpayWebhook,
);
app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());
app.use(
  "/uploads/vendor-products",
  express.static(getVendorProductUploadDirectory(), {
    dotfiles: "deny",
    index: false,
    maxAge: "1d",
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  }),
);

app.post("/api/studio-briefs", receiveStudioBrief, createStudioBrief);
app.use("/api/auth", authRouter);
app.use("/api/orders", orderRouter);
app.use("/api/products", productRouter);
app.use("/api/me/products", userProductRouter);
app.use("/api/vendor", vendorRouter);
app.use("/api/geocode", geocodeRouter);
app.use("/api/admin", adminRouter);
app.use("/api/support", supportRouter);

app.get("/favicon.ico", (req, res) => {
  res.type("image/svg+xml").send(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#071a36"/><path d="M32 10 54 32 32 54 10 32 32 10Z" fill="none" stroke="#d7b578" stroke-width="2"/><text x="32" y="41" fill="#fff" font-family="Georgia,serif" font-size="29" text-anchor="middle">O</text></svg>',
  );
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

export default app;
