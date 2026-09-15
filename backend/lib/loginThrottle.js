/**
 * Brute-force protection for login. Tracks failed attempts by BOTH the
 * email being targeted and the IP making the request, and locks out
 * whichever one hits the threshold first -- so an attacker can't get
 * around it just by trying different emails from one IP (credential
 * stuffing) or trying one email from many IPs.
 *
 * In-memory, like the general rate limiter in server.js -- fine for a
 * single-instance deployment. Move this to Redis if you ever run multiple
 * backend instances, since each instance would otherwise track attempts
 * separately and the real limit would be N-times looser than intended.
 */
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes to accumulate failures
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minute lockout once triggered

const attempts = new Map(); // key -> { count, firstAttemptAt, lockedUntil }

function getEntry(key) {
  return attempts.get(key) || { count: 0, firstAttemptAt: 0, lockedUntil: 0 };
}

function checkLocked(key) {
  const entry = getEntry(key);
  const now = Date.now();
  if (entry.lockedUntil > now) {
    return Math.ceil((entry.lockedUntil - now) / 1000);
  }
  return 0;
}

/**
 * Returns 0 if neither the email nor the IP is currently locked out, or
 * the number of seconds until the lockout clears (whichever is longer).
 */
function secondsUntilUnlocked(email, ip) {
  return Math.max(checkLocked(`email:${email.toLowerCase()}`), checkLocked(`ip:${ip}`));
}

function recordFailure(key) {
  const now = Date.now();
  const entry = getEntry(key);

  if (now - entry.firstAttemptAt > WINDOW_MS) {
    entry.count = 0;
    entry.firstAttemptAt = now;
  }
  entry.count += 1;

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  attempts.set(key, entry);
}

function recordFailedLogin(email, ip) {
  recordFailure(`email:${email.toLowerCase()}`);
  recordFailure(`ip:${ip}`);
}

function clearFailures(email, ip) {
  attempts.delete(`email:${email.toLowerCase()}`);
  attempts.delete(`ip:${ip}`);
}

// Periodic cleanup so this Map doesn't grow forever -- drop anything that's
// neither locked nor within its accumulation window anymore.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts.entries()) {
    if (entry.lockedUntil < now && now - entry.firstAttemptAt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

module.exports = { secondsUntilUnlocked, recordFailedLogin, clearFailures, MAX_ATTEMPTS };
