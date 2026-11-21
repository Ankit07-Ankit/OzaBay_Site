import app from "./src/app.js";
import connectDB from "./src/config/database.js";

// Do not accept requests until MongoDB (including GridFS) is ready.
await connectDB();

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
