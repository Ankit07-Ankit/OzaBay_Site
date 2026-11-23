import mongoose from "mongoose";
import config from "./config.js";

const connectDB = async () => {
  try {
    await mongoose.connect(config.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1); // Exit process with failure
  }
};

export default connectDB;
