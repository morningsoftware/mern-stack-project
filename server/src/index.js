import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./app.js";
import { connectDatabase } from "./db.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config();

const uri = process.env.MONGODB_URI;
const port = Number(process.env.PORT || 4000);

if (!uri) {
  console.error("MONGODB_URI is missing. Set your Mongo connection string first.");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing.");
  process.exit(1);
}

const { db } = await connectDatabase(uri);
const app = createApp(db);
app.listen(port, "0.0.0.0", () => {
  console.log(`API listening on ${port}`);
});
