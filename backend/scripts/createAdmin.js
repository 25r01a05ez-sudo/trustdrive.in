#!/usr/bin/env node
/**
 * Creates (or promotes) a real admin account. This is a CLI script, not an
 * HTTP endpoint -- there is deliberately no way to become an admin through
 * the website itself, since that would let anyone who found the endpoint
 * grant themselves admin access.
 *
 * REQUIRES DATABASE_URL to be set (real Postgres/Supabase). This won't do
 * anything useful against the in-memory demo store, because this script
 * runs as its own separate process -- any admin it "creates" would live in
 * this process's memory, not your actual running server's, and would
 * vanish the moment the script exits.
 *
 * Usage (interactive):
 *   npm run create-admin
 *
 * Usage (non-interactive, e.g. from a deploy script or your host's
 * one-off command feature):
 *   ADMIN_NAME="Your Name" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="..." npm run create-admin
 */
require("dotenv").config();
const readline = require("readline");
const bcrypt = require("bcryptjs");

if (!process.env.DATABASE_URL) {
  console.error(
    "\nDATABASE_URL is not set. This script creates a real, persistent admin\n" +
    "account and needs real Postgres to do that -- it can't work against the\n" +
    "in-memory demo store, since this script and your running server would\n" +
    "each have their own separate copy of the data.\n\n" +
    "Set DATABASE_URL (and DIRECT_URL) in backend/.env first -- see the\n" +
    "README's \"Using Supabase\" section -- then run this again.\n"
  );
  process.exit(1);
}

const MIN_PASSWORD_LENGTH = 12;

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (!hidden) {
      rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
      return;
    }
    // Minimal masked input for the password prompt.
    const stdin = process.stdin;
    process.stdout.write(question);
    let input = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (char) => {
      if (char === "\n" || char === "\r" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        rl.close();
        resolve(input.trim());
      } else if (char === "\u0003") {
        process.exit(1);
      } else if (char === "\u007f") {
        input = input.slice(0, -1);
      } else {
        input += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  console.log("\n== TrustDrive: create a real admin account ==\n");

  const name = process.env.ADMIN_NAME || (await prompt("Name: "));
  const email = (process.env.ADMIN_EMAIL || (await prompt("Email: "))).toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || (await prompt("Password (min 12 characters): ", { hidden: true }));

  // Validate everything BEFORE touching the store, so a typo doesn't
  // require a working database connection just to be told about it.
  if (!name || !email || !password) {
    console.error("\nName, email, and password are all required.");
    process.exit(1);
  }
  if (password === "password123") {
    console.error("\nThat's the demo password -- pick a real one.");
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`\nPassword must be at least ${MIN_PASSWORD_LENGTH} characters -- this account can approve/reject dealers and edit any listing.`);
    process.exit(1);
  }

  // Only require the store now that input is valid -- this is what
  // actually connects to Postgres (via Prisma), so we don't want a bad
  // password to fail with a confusing database error instead of a clear
  // validation message.
  const store = require("../lib/store");

  const existing = await store.findUserByEmail(email);
  if (existing) {
    if (existing.role === "admin") {
      console.log(`\n${email} is already an admin. Nothing to do.`);
      process.exit(0);
    }
    console.log(`\nAn account with this email already exists (role: ${existing.role}). Promoting it to admin...`);
    await store.updateUser(existing.id, { role: "admin" });
    console.log(`\nDone -- ${email} is now an admin.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await store.createUser({ role: "admin", name, email, phone: null, passwordHash });
  console.log(`\nDone -- admin account created for ${email} (id: ${user.id}).`);
  console.log("Sign in at /login with this email and the password you just set.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nFailed to create admin account:", err.message);
  process.exit(1);
});
