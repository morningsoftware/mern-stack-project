/**
 * Upserts the MongoDB login the API uses.
 *
 * When authorization is already enabled, this must be run by a connection that
 * is allowed to create users (the localhost exception, or MONGODB_ADMIN_URI).
 * The app user receives readWrite and dbAdmin on the `mern` database, which
 * covers queries and createIndexes.
 *
 *   MONGODB_ADMIN_URI=mongodb://127.0.0.1:27017 \
 *   MONGODB_APP_USER=mernapp \
 *   MONGODB_APP_PASSWORD=... \
 *   node database/migrateMongoUser.js
 */
require("dotenv").config();

const { MongoClient } = require("mongodb");

const adminUri = process.env.MONGODB_ADMIN_URI || "mongodb://127.0.0.1:27017";
const username = process.env.MONGODB_APP_USER || "mernapp";
const password = process.env.MONGODB_APP_PASSWORD;
const databaseName = "mern";

const roles = [
  { role: "readWrite", db: databaseName },
  { role: "dbAdmin", db: databaseName },
];

async function migrate() {
  if (!password) {
    throw new Error("Set MONGODB_APP_PASSWORD before running this migration.");
  }

  const client = new MongoClient(adminUri);
  await client.connect();
  try {
    const admin = client.db("admin");
    const info = await admin.command({ usersInfo: username });
    const exists = Array.isArray(info.users) && info.users.length > 0;
    if (exists) {
      await admin.command({ updateUser: username, pwd: password, roles });
      console.log(`Updated MongoDB user ${username}`);
    } else {
      await admin.command({ createUser: username, pwd: password, roles });
      console.log(`Created MongoDB user ${username}`);
    }
  } finally {
    await client.close();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
