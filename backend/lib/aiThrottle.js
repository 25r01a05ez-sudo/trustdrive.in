/**
 * Rate limiter for AI endpoints to prevent quota exhaustion and API spam.
 * Limit: 5 requests per 10 minutes per dealer/user.
 */
const MAX_AI_REQUESTS = 5;
const AI_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const aiUsage = new Map(); // key -> [timestamps]

function checkAiRateLimit(key) {
  const now = Date.now();
  const history = aiUsage.get(key) || [];
  const fresh = history.filter((t) => now - t < AI_WINDOW_MS);

  if (fresh.length >= MAX_AI_REQUESTS) {
    const oldest = fresh[0];
    const waitSeconds = Math.ceil((oldest + AI_WINDOW_MS - now) / 1000);
    const waitMinutes = Math.ceil(waitSeconds / 60);
    return {
      allowed: false,
      waitMinutes,
      waitSeconds,
      count: fresh.length,
    };
  }

  fresh.push(now);
  aiUsage.set(key, fresh);
  return { allowed: true, count: fresh.length };
}

function aiRateLimiter(req, res, next) {
  const identifier = req.user?.id || req.user?.dealerId || req.ip;
  const status = checkAiRateLimit(`ai:${identifier}`);

  if (!status.allowed) {
    return res.status(429).json({
      error: `AI generation limit reached (5 requests per 10 minutes). Please wait ${status.waitMinutes} minute${
        status.waitMinutes === 1 ? "" : "s"
      } before generating again.`,
      retryAfterSeconds: status.waitSeconds,
    });
  }

  next();
}

module.exports = { aiRateLimiter, checkAiRateLimit };
