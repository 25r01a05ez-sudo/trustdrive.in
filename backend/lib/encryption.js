/**
 * Encrypts sensitive dealer verification data (PAN, Aadhaar, bank details,
 * document content) before it's stored, so a database leak or an
 * unauthorized query doesn't expose it in plaintext.
 *
 * Uses AES-256-GCM with a key from ENCRYPTION_KEY (32 bytes, base64 or hex).
 * If unset, a fixed development key is used and a loud warning is printed —
 * this is fine for local demo use, but you MUST set a real ENCRYPTION_KEY in
 * any deployment that will hold real dealer data. Losing the key means the
 * encrypted data becomes permanently unrecoverable, so store it somewhere
 * durable (your hosting provider's secret manager), not just in a .env file
 * on one machine.
 */
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const DEV_KEY = "trustdrive-insecure-dev-key-change-me-32b"; // 42 chars, sliced to 32 below

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (!getKey._warned) {
      console.warn(
        "[encryption] ENCRYPTION_KEY is not set -- using an insecure development key. " +
        "Set a real 32-byte ENCRYPTION_KEY in backend/.env before storing real dealer data."
      );
      getKey._warned = true;
    }
    return Buffer.from(DEV_KEY.slice(0, 32));
  }
  // Accept either a 32-byte base64 string or a 64-char hex string.
  const buf = raw.length === 64 ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes (use `openssl rand -base64 32`)");
  }
  return buf;
}

/**
 * Encrypts any JSON-serializable value. Returns a plain object
 * ({ iv, tag, data }, all base64) that is itself safe to store directly in
 * a JSON/JSONB column -- no schema changes needed.
 */
function encryptJSON(value) {
  if (value === null || value === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    __encrypted: true,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

/**
 * Decrypts a value produced by encryptJSON(). Passing through a plain
 * (non-encrypted) value returns it unchanged, so this is safe to call on
 * data that predates encryption being enabled.
 */
function decryptJSON(payload) {
  if (!payload || typeof payload !== "object" || !payload.__encrypted) return payload;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.data, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch (err) {
    console.error("[encryption] Failed to decrypt verification payload:", err.message);
    return null;
  }
}

module.exports = { encryptJSON, decryptJSON };
