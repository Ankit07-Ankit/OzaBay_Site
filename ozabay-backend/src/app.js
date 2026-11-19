import express from "express";
import morgan from "morgan";
import authRouter from "./routes/auth.routes.js";
import orderRouter from "./routes/order.routes.js";
import vendorRouter from "./routes/vendor.routes.js";
import productRouter from "./routes/product.routes.js";
import userProductRouter from "./routes/user-product.routes.js";
import geocodeRouter from "./routes/geocode.routes.js";
import adminRouter from "./routes/admin.routes.js";
import supportRouter from "./routes/support.routes.js";
import cookieParser from "cookie-parser";
import { getVendorProductUploadDirectory } from "./middleware/vendor-product-upload.js";

const app = express();
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

app.use("/api/auth", authRouter);
app.use("/api/orders", orderRouter);
app.use("/api/products", productRouter);
app.use("/api/me/products", userProductRouter);
app.use("/api/vendor", vendorRouter);
app.use("/api/geocode", geocodeRouter);
app.use("/api/admin", adminRouter);
app.use("/api/support", supportRouter);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

export default app;
