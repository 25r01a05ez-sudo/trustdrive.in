const express = require("express");
const bcrypt = require("bcryptjs");
const store = require("../lib/store");
const { signToken, requireAuth } = require("../middleware/auth");
const { secondsUntilUnlocked, recordFailedLogin, clearFailures } = require("../lib/loginThrottle");
const { createOtp, verifyOtp: checkOtp } = require("../lib/otpStore");
const { sendOtpEmail } = require("../lib/mailer");

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pending signup payloads waiting for OTP confirmation.
 * Key: email (lowercase). Value: { name, email, phone, passwordHash, role }
 * Cleared once the OTP is verified and the user is created.
 */
const pendingSignups = new Map();

function sanitize(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// ─── Existing endpoints (unchanged) ──────────────────────────────────────────

// POST /api/auth/signup  { name, email, phone, password, role }
router.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, password, role = "buyer" } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }
    const existing = await store.findUserByEmail(email);
    if (existing) return res.status(409).json({ error: "An account with this email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await store.createUser({
      role: ["buyer", "dealer"].includes(role) ? role : "buyer",
      name,
      email,
      phone,
      passwordHash,
    });
    const token = signToken(user);
    res.status(201).json({ token, user: sanitize(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// POST /api/auth/login  { email, password }
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const retryAfter = secondsUntilUnlocked(email, req.ip);
    if (retryAfter > 0) {
      const minutes = Math.ceil(retryAfter / 60);
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      });
    }

    const user = await store.findUserByEmail(email);
    if (!user) {
      recordFailedLogin(email, req.ip);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isDemoSeed = user.passwordHash === null || user.passwordHash === undefined;
    const valid = isDemoSeed
      ? password === "password123"
      : await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      recordFailedLogin(email, req.ip);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    clearFailures(email, req.ip);
    const token = signToken(user);
    res.json({ token, user: sanitize(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  const user = await store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: sanitize(user) });
});

// ─── OTP endpoints ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/send-otp
 *
 * For LOGIN:          { mode: "login", email } (Passwordless OTP login)
 * For RESET-PASSWORD: { mode: "reset-password", email }
 * For SIGNUP:         { mode: "signup", name, email, phone, password, role }
 *
 * On success: validates user presence / stages signup, generates OTP,
 * emails it, and returns { message: "OTP sent", email }.
 */
router.post("/send-otp", async (req, res) => {
  try {
    let { mode = "login", email, password, name, phone, role = "buyer" } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }
    email = String(email).trim().toLowerCase();

    if (!["login", "signup", "reset-password"].includes(mode)) {
      return res.status(400).json({ error: "mode must be 'login', 'signup', or 'reset-password'" });
    }

    if (mode === "reset-password") {
      // ── Password Reset requires an existing account ────────────────────
      const user = await store.findUserByEmail(email);
      if (!user) {
        return res.status(404).json({
          error: "No account found with this email address. Please register a new account.",
        });
      }
    } else if (mode === "signup") {
      // ── Signup — validate & stage the new account ──────────────────────
      if (!name) {
        return res.status(400).json({ error: "name is required for signup" });
      }
      if (!password) {
        return res.status(400).json({ error: "password is required for signup" });
      }
      const existing = await store.findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      pendingSignups.set(email, {
        name,
        email,
        phone,
        passwordHash,
        role: ["buyer", "dealer"].includes(role) ? role : "buyer",
      });
    }

    // ── Generate & send OTP ────────────────────────────────────────────────
    const otp = createOtp(email);
    await sendOtpEmail(email, otp);

    res.json({
      message: "OTP sent",
      email,
    });
  } catch (err) {
    console.error("[send-otp error]", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

/**
 * POST /api/auth/verify-otp
 *
 * { mode: "login" | "signup", email, otp, signupPayload }
 *
 * On success: creates account (signup) or looks up existing user (login),
 * returns { token, user }.
 */
router.post("/verify-otp", async (req, res) => {
  try {
    let { mode = "login", email, otp, signupPayload } = req.body || {};

    if (!email || !otp) {
      return res.status(400).json({ error: "email and otp are required" });
    }
    email = String(email).trim().toLowerCase();
    otp = String(otp).trim();

    // ── Verify OTP ─────────────────────────────────────────────────────────
    const result = checkOtp(email, otp);
    if (!result.ok) {
      return res.status(401).json({ error: result.reason });
    }

    let user = await store.findUserByEmail(email);

    if (mode === "signup") {
      // ── Create the account now that OTP is confirmed ────────────────────
      if (!user) {
        let pending = pendingSignups.get(email);
        
        // Fallback: If in-memory pending map was cleared, recover from signupPayload
        if (!pending && signupPayload && signupPayload.password) {
          const passwordHash = await bcrypt.hash(signupPayload.password, 10);
          pending = {
            name: signupPayload.name || email.split("@")[0],
            email,
            phone: signupPayload.phone || "",
            passwordHash,
            role: ["buyer", "dealer"].includes(signupPayload.role) ? signupPayload.role : "buyer",
          };
        }

        if (pending) {
          pendingSignups.delete(email);
          user = await store.createUser(pending);
        } else {
          return res.status(400).json({
            error: "Signup session expired. Please return to the signup page.",
          });
        }
      }
    } else {
      // ── Login — fetch existing user or auto-create for passwordless ───
      if (!user) {
        const randomPass = Math.random().toString(36).slice(-10);
        const passwordHash = await bcrypt.hash(randomPass, 10);
        user = await store.createUser({
          name: email.split("@")[0],
          email,
          phone: "",
          passwordHash,
          role: "buyer",
        });
      }
    }

    const token = signToken(user);
    res.json({ token, user: sanitize(user) });
  } catch (err) {
    console.error("[verify-otp error]", err);
    res.status(500).json({ error: "OTP verification failed: " + err.message });
  }
});

/**
 * POST /api/auth/reset-password
 *
 * { email, otp, newPassword }
 *
 * Verifies OTP, updates the password in DB, and returns new token & user session.
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "email, otp, and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    const user = await store.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "No account found with this email" });
    }

    // Verify OTP
    const result = checkOtp(email, otp);
    if (!result.ok) {
      return res.status(401).json({ error: result.reason });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updatedUser = await store.updateUser(user.id, { passwordHash });

    clearFailures(email, req.ip);

    const token = signToken(updatedUser || user);
    res.json({
      token,
      user: sanitize(updatedUser || user),
      message: "Password reset successfully.",
    });
  } catch (err) {
    console.error("[reset-password error]", err);
    res.status(500).json({ error: "Password reset failed: " + err.message });
  }
});

module.exports = router;
