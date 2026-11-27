import app from "./src/app.js";
import connectDB from "./src/config/database.js";
import { pathToFileURL } from "node:url";

// Do not accept requests until MongoDB (including GridFS) is ready.
await connectDB();

export default app;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
