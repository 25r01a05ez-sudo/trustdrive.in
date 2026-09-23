/**
 * TrustDrive API Gateway
 * -----------------------------------------------------------------------
 * This file plays the role of the "API Gateway" box in the architecture
 * diagram: it terminates HTTPS/REST from the buyer app + dealer/admin
 * dashboards, applies basic rate limiting, and routes requests to the
 * individual services (Auth, Dealer, Vehicle, Search, Verification,
 * Lead Management, Review, Analytics). Each service lives in its own
 * routes/*.js file so it can be split into a real microservice later
 * without changing the frontend contract.
 */
require("dotenv").config();

// ── GLOBAL IPv4 ENFORCEMENT ─────────────────────────────────────────────
// Render's infrastructure does not support outbound IPv6. Node.js and
// Nodemailer default to IPv6 when available, causing ENETUNREACH errors.
// This patches dns.lookup at the lowest level so that EVERY outbound
// connection in this process (including Nodemailer's internal sockets)
// is forced to resolve and connect over IPv4 only. No library can bypass
// this because it operates at the Node.js core level.
const dns = require("dns");
const _originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = { family: 4 };
  } else if (typeof options === "number") {
    options = { family: 4 };
  } else {
    options = Object.assign({}, options, { family: 4 });
  }
  return _originalLookup.call(this, hostname, options, callback);
};
// ─────────────────────────────────────────────────────────────────────────
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 4000;

// Ensure upload directories exist for inspection videos and docs
const uploadsDir = path.join(__dirname, "uploads");
const videosDir = path.join(uploadsDir, "videos");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

// Serve uploaded videos and files with byte-range (206 partial content) streaming support
app.use("/uploads", express.static(uploadsDir));

// Touch the store on boot so the "in-memory vs Postgres" mode logs immediately.
require("./lib/store");

app.use(cors());
// Dealer verification submissions now embed real document content
// (base64), not just filenames — up to ~7 PDFs at 5MB each plus photos can
// add up. 60mb gives headroom; move to real object storage (S3, or
// Supabase Storage) before real dealer volume, per the README.
app.use(express.json({ limit: "60mb" }));
app.use(morgan("dev"));

// --- very small in-memory rate limiter (per IP) -------------------------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 120;
const hits = new Map();
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const bucket = hits.get(ip) || [];
  const fresh = bucket.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  fresh.push(now);
  hits.set(ip, fresh);
  if (fresh.length > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too many requests, please slow down" });
  }
  next();
});

// --- service routing -----------------------------------------------------
app.use("/api/auth", require("./routes/auth"));
app.use("/api/dealers", require("./routes/dealers"));
app.use("/api/vehicles", require("./routes/vehicles"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/coupons", require("./routes/coupons"));
app.use("/api/search", require("./routes/search"));
app.use("/api/verification", require("./routes/verification"));
app.use("/api/leads", require("./routes/leads"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/dealer-sites", require("./routes/dealerSites"));

app.get("/", (req, res) => {
  res.json({
    name: "TrustDrive API Gateway",
    status: "online",
    frontendUrl: "http://localhost:5173",
    healthCheck: "/api/health",
    message: "TrustDrive API backend is active. Open http://localhost:5173 to view the website interface."
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "trustdrive-api-gateway", time: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error("[server error]", err);
  res.status(500).json({ error: "Internal server error" });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Unhandled Rejection]:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Uncaught Exception]:", error);
});

app.listen(PORT, () => {
  console.log(`TrustDrive API Gateway listening on http://localhost:${PORT}`);
  console.log(`Try: GET http://localhost:${PORT}/api/health`);
});
