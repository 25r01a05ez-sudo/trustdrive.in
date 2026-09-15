const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "trustdrive-dev-secret-change-me";

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, dealerId: user.dealerId || null },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const store = require("../lib/store");
    const freshUser = await store.findUserById(payload.id);
    if (!freshUser) {
      return res.status(401).json({ error: "User session is invalid. Please log in again." });
    }
    req.user = {
      ...payload,
      role: freshUser.role,
      dealerId: freshUser.dealerId || null,
      name: freshUser.name,
      email: freshUser.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Like requireAuth, but never rejects the request. Sets req.user when a
// valid token is present, leaves it null otherwise. Used on public routes
// whose response should vary by who's asking (e.g. hiding a vehicle's
// registration number from anonymous buyers, but showing it to the
// dealer who owns that listing or to an admin).
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const store = require("../lib/store");
    const freshUser = await store.findUserById(payload.id);
    if (freshUser) {
      req.user = {
        ...payload,
        role: freshUser.role,
        dealerId: freshUser.dealerId || null,
        name: freshUser.name,
        email: freshUser.email,
      };
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, optionalAuth, requireRole, JWT_SECRET };
