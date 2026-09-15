/**
 * OTP Store — in-memory, auto-expiring.
 *
 * Each record: { otp, expiresAt, attempts }
 * OTPs expire after OTP_TTL_MS (10 minutes).
 * After OTP_MAX_ATTEMPTS wrong guesses the record is deleted.
 *
 * This is intentionally simple — for production persistence use Redis or
 * a Supabase table with a TTL policy.
 */

const OTP_TTL_MS = 10 * 60 * 1000;   // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

/** @type {Map<string, { otp: string, expiresAt: number, attempts: number }>} */
const store = new Map();

/** Generate a random 6-digit numeric OTP string. */
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Create (or replace) an OTP for the given email.
 * Returns the plaintext OTP so the caller can email it.
 * @param {string} email
 * @returns {string} otp
 */
function createOtp(email) {
  const otp = generateOtp();
  store.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
  return otp;
}

/**
 * Verify a submitted OTP against the stored one.
 * @param {string} email
 * @param {string} submittedOtp
 * @returns {{ ok: boolean, reason?: string }}
 */
function verifyOtp(email, submittedOtp) {
  const key = email.toLowerCase();
  const record = store.get(key);

  if (!record) {
    return { ok: false, reason: "No OTP found for this email. Please request a new one." };
  }
  if (Date.now() > record.expiresAt) {
    store.delete(key);
    return { ok: false, reason: "OTP has expired. Please request a new one." };
  }

  record.attempts += 1;

  if (record.otp !== String(submittedOtp).trim()) {
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      store.delete(key);
      return { ok: false, reason: "Too many incorrect attempts. Please request a new OTP." };
    }
    const remaining = OTP_MAX_ATTEMPTS - record.attempts;
    return { ok: false, reason: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` };
  }

  // ✅ Correct OTP — consume it immediately (one-time use)
  store.delete(key);
  return { ok: true };
}

/**
 * Delete any stored OTP for an email (e.g. on explicit logout or re-send).
 * @param {string} email
 */
function clearOtp(email) {
  store.delete(email.toLowerCase());
}

// Passive cleanup: sweep expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.expiresAt) store.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = { createOtp, verifyOtp, clearOtp, OTP_TTL_MS };
