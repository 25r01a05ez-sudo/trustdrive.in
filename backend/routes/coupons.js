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
const { logAuditEvent } = require("../lib/auditLog");

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

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "coupon_created",
      details: {
        couponId: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        usageLimit: coupon.usageLimit,
      },
    }).catch(() => {});

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

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "coupon_updated",
      details: { couponId: req.params.id, patch },
    }).catch(() => {});

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

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "coupon_deleted",
      details: { couponId: req.params.id, code: coupon.code },
    }).catch(() => {});

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
    if (!req.user.dealerId) {
      return res.status(403).json({ valid: false, error: "Only registered dealership accounts can use coupons." });
    }
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

/**
 * POST /api/coupons/redeem  (dealer: redeem coupon directly)
 *
 * Body: { code: string, vehicleId?: string }
 */
router.post("/redeem", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    if (!req.user.dealerId) {
      return res.status(403).json({ error: "Only registered dealership accounts can redeem coupons." });
    }
    const { code, vehicleId } = req.body || {};
    if (!code || !code.trim()) {
      return res.status(400).json({ error: "Coupon code is required." });
    }

    const cleanCode = code.trim().toUpperCase();
    const coupon = await store.findCouponByCode(cleanCode);

    if (!coupon) return res.status(404).json({ error: "Coupon code not found." });
    if (!coupon.active) return res.status(400).json({ error: "This coupon is currently paused or inactive." });
    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ error: "This coupon has reached its maximum usage limit." });
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({ error: "This coupon has expired." });
    }

    const dealer = await store.findDealerById(req.user.dealerId);
    if (!dealer) return res.status(404).json({ error: "Dealer profile not found." });

    const INDIVIDUAL_PRICE = 1999;
    const discount =
      coupon.discountType === "percent"
        ? Math.round((INDIVIDUAL_PRICE * coupon.discountValue) / 100)
        : Math.min(coupon.discountValue, INDIVIDUAL_PRICE);

    // If vehicleId is provided, activate vehicle listing directly
    if (vehicleId) {
      const vehicle = await store.findVehicleById(vehicleId);
      if (!vehicle) return res.status(404).json({ error: "Vehicle not found." });
      if (vehicle.dealerId !== dealer.id) {
        return res.status(403).json({ error: "You can only activate your own listings." });
      }

      const listingActivatedAt = new Date();
      const listingExpiresAt = new Date();
      listingExpiresAt.setMonth(listingExpiresAt.getMonth() + 3);

      const updatedVehicle = await store.updateVehicle(vehicle.id, {
        listingStatus: "active",
        paymentStatus: coupon.discountType === "percent" && coupon.discountValue === 100 ? "free_credit" : "paid_individual",
        listingActivatedAt,
        listingExpiresAt,
      });

      await store.markCouponUsed(coupon.id, dealer.id);

      await logAuditEvent({
        userId: req.user.id,
        userRole: req.user.role,
        action: "vehicle_activated_via_coupon",
        vehicleId: vehicle.id,
        dealerId: dealer.id,
        details: { couponCode: coupon.code, discount, finalPrice: Math.max(0, INDIVIDUAL_PRICE - discount) },
      }).catch(() => {});

      return res.json({
        success: true,
        message: `🎉 Listing "${vehicle.brand} ${vehicle.model}" activated using coupon ${coupon.code}!`,
        vehicle: updatedVehicle,
        dealer,
      });
    }

    // Direct account redemption: Add listing credits to dealer account
    const creditsToAdd = coupon.discountType === "percent" && coupon.discountValue === 100
      ? 1
      : Math.max(1, Math.floor(discount / 1000));

    const updatedDealer = await store.updateDealer(dealer.id, {
      packageCreditsTotal: (dealer.packageCreditsTotal || 0) + creditsToAdd,
    });

    await store.markCouponUsed(coupon.id, dealer.id);

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "coupon_redeemed_credits",
      dealerId: dealer.id,
      details: { couponCode: coupon.code, creditsAdded: creditsToAdd },
    }).catch(() => {});

    return res.json({
      success: true,
      message: `🎉 Coupon "${coupon.code}" redeemed! ${creditsToAdd} Listing Credit${creditsToAdd > 1 ? "s" : ""} added to your account balance.`,
      creditsAdded: creditsToAdd,
      dealer: updatedDealer,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
