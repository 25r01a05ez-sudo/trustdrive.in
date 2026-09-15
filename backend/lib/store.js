/**
 * TrustDrive data-access layer.
 *
 * Every route imports `store` from here instead of touching a database
 * client directly. Two implementations satisfy the same interface:
 *
 *  - memoryStore  → the original in-memory db.js, zero config, resets on restart
 *  - prismaStore  → real Postgres via Prisma, used automatically once
 *                   DATABASE_URL is set in the environment
 *
 * This keeps `npm run dev` working instantly for anyone cloning the repo,
 * while giving a real persistence path for production without touching
 * route logic.
 */
const USE_DB = Boolean(process.env.DATABASE_URL);

let store;

if (USE_DB) {
  store = require("./prismaStore");
  console.log("[store] Using Postgres via Prisma (DATABASE_URL detected)");
} else {
  store = require("./memoryStore");
  console.log("[store] Using in-memory demo store (set DATABASE_URL to use Postgres)");
}

module.exports = store;
