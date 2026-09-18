/**
 * Coupons route — TrustDrive India
 *
 * Admin-managed discount coupons for dealers to use at listing payment.
 *
 * Rules (enforced server-side):
 *  - Coupons are dealer-only (authenticated dealer required to validate/use)
 *  - Each coupon has a usageLimit (default 1 = one-time use)
 *  - Once usedCount >= usageLimit, coupon is rejected
 *  - Validation does NOT mark as used; marking happens in payments.js on success
 */
const express = require("express");
const store = require("../lib/store");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/coupons  (admin: list all coupons)
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const coupons = await store.listCoupons();
    res.json({ coupons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/coupons  (admin: create coupon)
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { code, discountType, discountValue, expiresAt, active, usageLimit } = req.body || {};
    if (!code || !discountType || discountValue === undefined) {
      return res.status(400).json({ error: "code, discountType, and discountValue are required" });
    }
    if (!["percent", "fixed"].includes(discountType)) {
      return res.status(400).json({ error: "discountType must be 'percent' or 'fixed'" });
    }
    if (discountValue <= 0) {
      return res.status(400).json({ error: "discountValue must be positive" });
    }
    if (discountType === "percent" && discountValue > 100) {
      return res.status(400).json({ error: "Percentage discount cannot exceed 100" });
    }

    // Check for duplicate code
    const existing = await store.findCouponByCode(code.trim().toUpperCase());
    if (existing) return res.status(409).json({ error: "A coupon with this code already exists" });

    const coupon = await store.createCoupon({
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: active !== false,
      usageLimit: Number(usageLimit || 1),
    });

    res.status(201).json({ coupon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/coupons/:id  (admin: update coupon)
router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const coupon = await store.findCouponById(req.params.id);
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });

    const allowed = ["discountType", "discountValue", "expiresAt", "active", "usageLimit"];
    const patch = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    });
    if (patch.expiresAt) patch.expiresAt = new Date(patch.expiresAt);

    const updated = await store.updateCoupon(req.params.id, patch);
    res.json({ coupon: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/coupons/:id  (admin)
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const coupon = await store.findCouponById(req.params.id);
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });
    await store.deleteCoupon(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/coupons/validate  (dealer: validate a coupon code before payment)
 *
 * Does NOT mark the coupon as used — that happens in payments.js.
 * Returns the discount details so the frontend can show the discounted price.
 */
router.post("/validate", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: "code is required" });

    const INDIVIDUAL_PRICE = 1999;
    const coupon = await store.findCouponByCode(code.trim().toUpperCase());

    if (!coupon) return res.status(404).json({ valid: false, error: "Coupon not found" });
    if (!coupon.active) return res.status(400).json({ valid: false, error: "This coupon is not active" });
    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ valid: false, error: "This coupon has already been used" });
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({ valid: false, error: "This coupon has expired" });
    }

    const discount =
      coupon.discountType === "percent"
        ? Math.round((INDIVIDUAL_PRICE * coupon.discountValue) / 100)
        : Math.min(coupon.discountValue, INDIVIDUAL_PRICE);

    const finalPrice = Math.max(0, INDIVIDUAL_PRICE - discount);

    res.json({
      valid: true,
      coupon: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue },
      discount,
      originalPrice: INDIVIDUAL_PRICE,
      finalPrice,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
