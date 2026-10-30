import mongoose from "mongoose";

const deliveryLocationSchema = new mongoose.Schema(
  {
    address: { type: String, trim: true },
    building: { type: String, trim: true },
    area: { type: String, trim: true },
    locality: { type: String, trim: true },
    fullName: { type: String, trim: true },
    mobile: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    alternateMobile: { type: String, trim: true },
    mapLink: { type: String, trim: true },
    latitude: Number,
    longitude: Number,
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    accountType: {
      type: String,
      enum: ["user", "vendor"],
      default: "user",
    },
    deliveryLocation: deliveryLocationSchema,
    deliveryLocations: { type: [deliveryLocationSchema], default: [] },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
