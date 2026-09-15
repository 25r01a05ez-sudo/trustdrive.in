const express = require("express");
const store = require("../lib/store");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/analytics/dealer  (dealer's own inventory + lead insights)
router.get("/dealer", requireAuth, requireRole("dealer"), async (req, res) => {
  res.json(await store.dealerAnalytics(req.user.dealerId));
});

// GET /api/analytics/platform  (admin-wide platform analytics)
router.get("/platform", requireAuth, requireRole("admin"), async (req, res) => {
  res.json(await store.platformAnalytics());
});

module.exports = router;
