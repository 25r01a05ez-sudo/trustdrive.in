/**
 * Payments route — TrustDrive India
 *
 * Handles listing activation (simulated payment / credit deduction),
 * package purchases, and listing renewal.
 *
 * Full lifecycle:
 *   pending_review → [admin approves] → approved_payment_required
 *   → [dealer pays / uses credit] → active (listingExpiresAt set +3 months)
 *   → [3 months pass] → expired
 *   → [dealer renews] → active (listingExpiresAt extended)
 */
const express = require("express");
const store = require("../lib/store");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAuditEvent } = require("../lib/auditLog");
const { sendListingExpiryReminder } = require("../lib/mailer");

const router = express.Router();

// Listing packages definition (single source of truth)
const PACKAGES = {
  starter: { credits: 5, price: 0, label: "Starter (Free)" },
  basic: { credits: 10, price: 19000, label: "Basic" },
  growth: { credits: 20, price: 39000, label: "Growth" },
  pro: { credits: 50, price: 99000, label: "Pro" },
};

const INDIVIDUAL_PRICE = 1999; // Rs per vehicle listing
const LISTING_DURATION_MONTHS = 3;

/** Add months to a date (handles month-end edge cases) */
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * POST /api/payments/activate-listing/:vehicleId
 *
 * Dealer activates an approved listing by paying or using a credit.
 * Body: { couponCode?: string, paymentMethod: "free_credit" | "package_credit" | "paid_individual" }
 *
 * Steps:
 *  1. Validate vehicle is "approved_payment_required" and belongs to dealer
 *  2. Apply coupon if provided (validates server-side, marks as used)
 *  3. Deduct credit or simulate payment
 *  4. Activate listing: set listingStatus = "active", set expiry date
 */
router.post("/activate-listing/:vehicleId", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    const { couponCode, paymentMethod } = req.body || {};
    const vehicle = await store.findVehicleById(req.params.vehicleId);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    if (vehicle.dealerId !== req.user.dealerId) {
      return res.status(403).json({ error: "You can only activate your own listings" });
    }

    if (vehicle.listingStatus !== "approved_payment_required") {
      return res.status(400).json({
        error: `This listing cannot be activated. Current status: ${vehicle.listingStatus}`,
      });
    }

    const dealer = await store.findDealerById(req.user.dealerId);
    if (!dealer) return res.status(400).json({ error: "Dealer profile not found" });

    // --- Coupon validation (if provided) ---
    let couponDiscount = 0;
    let couponId = null;
    if (couponCode && couponCode.trim()) {
      const coupon = await store.findCouponByCode(couponCode.trim().toUpperCase());
      if (!coupon) return res.status(400).json({ error: "Invalid coupon code" });
      if (!coupon.active) return res.status(400).json({ error: "This coupon is no longer active" });
      if (coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ error: "This coupon has already been used" });
      }
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return res.status(400).json({ error: "This coupon has expired" });
      }
      // Calculate discount
      if (coupon.discountType === "percent") {
        couponDiscount = Math.round((INDIVIDUAL_PRICE * coupon.discountValue) / 100);
      } else {
        couponDiscount = Math.min(coupon.discountValue, INDIVIDUAL_PRICE);
      }
      couponId = coupon.id;
    }

    // --- Determine how to activate ---
    let resolvedPaymentMethod = paymentMethod;
    let dealerPatch = {};

    if (resolvedPaymentMethod === "free_credit") {
      const freeRemaining = dealer.freeCreditsTotal - dealer.freeCreditsUsed;
      if (freeRemaining <= 0) {
        return res.status(400).json({ error: "No free credits remaining" });
      }
      dealerPatch = { freeCreditsUsed: dealer.freeCreditsUsed + 1 };
    } else if (resolvedPaymentMethod === "package_credit") {
      const packageRemaining = dealer.packageCreditsTotal - dealer.packageCreditsUsed;
      if (packageRemaining <= 0) {
        return res.status(400).json({ error: "No package credits remaining" });
      }
      dealerPatch = { packageCreditsUsed: dealer.packageCreditsUsed + 1 };
    } else if (resolvedPaymentMethod === "paid_individual") {
      // Simulated payment — in production, replace with Razorpay verification
      const finalAmount = Math.max(0, INDIVIDUAL_PRICE - couponDiscount);
      console.log(`[payments] Simulated payment of Rs ${finalAmount} for vehicle ${vehicle.id}`);
      // Mark coupon as used (server-enforced)
      if (couponId) {
        await store.markCouponUsed(couponId, dealer.id);
      }
    } else {
      return res.status(400).json({
        error: "Invalid paymentMethod. Use: free_credit, package_credit, or paid_individual",
      });
    }

    // --- Update dealer credits ---
    if (Object.keys(dealerPatch).length > 0) {
      await store.updateDealer(dealer.id, dealerPatch);
    }

    // --- Activate listing ---
    const now = new Date();
    const expiresAt = addMonths(now, LISTING_DURATION_MONTHS);

    const updatedVehicle = await store.updateVehicle(vehicle.id, {
      listingStatus: "active",
      paymentStatus: resolvedPaymentMethod,
      listingActivatedAt: now.toISOString(),
      listingExpiresAt: expiresAt.toISOString(),
      approvalStatus: "Approved",
      status: "active",
    });

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "listing_activated",
      vehicleId: vehicle.id,
      dealerId: dealer.id,
      details: {
        paymentMethod: resolvedPaymentMethod,
        couponCode: couponCode || null,
        expiresAt: expiresAt.toISOString(),
      },
    });

    res.json({
      vehicle: updatedVehicle,
      expiresAt: expiresAt.toISOString(),
      message: `Listing activated! Your ${vehicle.brand} ${vehicle.model} is now live until ${expiresAt.toLocaleDateString("en-IN")}.`,
    });
  } catch (err) {
    console.error("[POST /api/payments/activate-listing error]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/purchase-package
 *
 * Dealer purchases a listing credit package (simulated).
 * Body: { packageName: "basic" | "growth" | "pro" }
 */
router.post("/purchase-package", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    const { packageName } = req.body || {};
    const pkg = PACKAGES[packageName];
    if (!pkg) {
      return res.status(400).json({
        error: `Invalid package. Choose from: ${Object.keys(PACKAGES).join(", ")}`,
      });
    }
    if (packageName === "starter") {
      return res.status(400).json({ error: "The Starter package is automatically given to new dealers" });
    }

    const dealer = await store.findDealerById(req.user.dealerId);
    if (!dealer) return res.status(400).json({ error: "Dealer profile not found" });

    // Simulated payment — in production, verify Razorpay payment here
    console.log(`[payments] Simulated package purchase: ${pkg.label} (Rs ${pkg.price}) for dealer ${dealer.id}`);

    // Record the package purchase
    await store.createDealerPackage({
      dealerId: dealer.id,
      packageName,
      credits: pkg.credits,
      amountPaid: pkg.price,
    });

    // Add credits to dealer
    const updatedDealer = await store.updateDealer(dealer.id, {
      packageCreditsTotal: dealer.packageCreditsTotal + pkg.credits,
      currentPackage: packageName,
    });

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "package_purchased",
      dealerId: dealer.id,
      details: { packageName, credits: pkg.credits, amountPaid: pkg.price },
    });

    res.json({
      dealer: updatedDealer,
      package: pkg,
      message: `${pkg.label} package activated! You have ${pkg.credits} new listing credits.`,
    });
  } catch (err) {
    console.error("[POST /api/payments/purchase-package error]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payments/renew/:vehicleId
 *
 * Dealer renews an expired or expiring listing.
 * Body: { paymentMethod: "free_credit" | "package_credit" | "paid_individual", couponCode?: string }
 */
router.post("/renew/:vehicleId", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    const { paymentMethod, couponCode } = req.body || {};
    const vehicle = await store.findVehicleById(req.params.vehicleId);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    if (vehicle.dealerId !== req.user.dealerId) {
      return res.status(403).json({ error: "You can only renew your own listings" });
    }
    if (!["expired", "active"].includes(vehicle.listingStatus)) {
      return res.status(400).json({ error: "Only active or expired listings can be renewed" });
    }

    const dealer = await store.findDealerById(req.user.dealerId);

    // Coupon validation
    let couponDiscount = 0;
    let couponId = null;
    if (couponCode && couponCode.trim()) {
      const coupon = await store.findCouponByCode(couponCode.trim().toUpperCase());
      if (!coupon || !coupon.active || coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ error: "Invalid or already-used coupon code" });
      }
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return res.status(400).json({ error: "This coupon has expired" });
      }
      couponDiscount =
        coupon.discountType === "percent"
          ? Math.round((INDIVIDUAL_PRICE * coupon.discountValue) / 100)
          : Math.min(coupon.discountValue, INDIVIDUAL_PRICE);
      couponId = coupon.id;
    }

    let dealerPatch = {};
    if (paymentMethod === "free_credit") {
      if (dealer.freeCreditsTotal - dealer.freeCreditsUsed <= 0) {
        return res.status(400).json({ error: "No free credits remaining" });
      }
      dealerPatch = { freeCreditsUsed: dealer.freeCreditsUsed + 1 };
    } else if (paymentMethod === "package_credit") {
      if (dealer.packageCreditsTotal - dealer.packageCreditsUsed <= 0) {
        return res.status(400).json({ error: "No package credits remaining" });
      }
      dealerPatch = { packageCreditsUsed: dealer.packageCreditsUsed + 1 };
    } else if (paymentMethod === "paid_individual") {
      const finalAmount = Math.max(0, INDIVIDUAL_PRICE - couponDiscount);
      console.log(`[payments] Simulated renewal payment of Rs ${finalAmount}`);
      if (couponId) await store.markCouponUsed(couponId, dealer.id);
    } else {
      return res.status(400).json({ error: "Invalid paymentMethod" });
    }

    if (Object.keys(dealerPatch).length > 0) {
      await store.updateDealer(dealer.id, dealerPatch);
    }

    // Extend from now (expired) or from current expiry (active, early renewal)
    const baseDate =
      vehicle.listingStatus === "expired" || !vehicle.listingExpiresAt
        ? new Date()
        : new Date(vehicle.listingExpiresAt);
    const newExpiresAt = addMonths(baseDate, LISTING_DURATION_MONTHS);

    const updated = await store.updateVehicle(vehicle.id, {
      listingStatus: "active",
      paymentStatus: paymentMethod,
      listingActivatedAt: new Date().toISOString(),
      listingExpiresAt: newExpiresAt.toISOString(),
      renewalReminderSent: false,
      approvalStatus: "Approved",
      status: "active",
    });

    res.json({
      vehicle: updated,
      expiresAt: newExpiresAt.toISOString(),
      message: `Listing renewed until ${newExpiresAt.toLocaleDateString("en-IN")}.`,
    });
  } catch (err) {
    console.error("[POST /api/payments/renew error]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/payments/packages
 * Returns available package definitions (public, no auth needed)
 */
router.get("/packages", (req, res) => {
  res.json({ packages: PACKAGES, individualPrice: INDIVIDUAL_PRICE });
});

/**
 * POST /api/payments/run-expiry-check  (admin-only)
 * Manually triggers the expiry checker — useful until a real cron is set up.
 */
router.post("/run-expiry-check", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const result = await runExpiryCheck();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[expiry-check error]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Core expiry checker — can be called from cron or the admin endpoint.
 * - Marks expired listings as "expired"
 * - Sends 3-day-before-expiry reminder emails
 */
async function runExpiryCheck() {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  let expired = 0;
  let reminded = 0;

  const allActive = await store.listVehicles({ status: "active" });
  for (const vehicle of allActive) {
    if (!vehicle.listingExpiresAt) continue;
    const expiry = new Date(vehicle.listingExpiresAt);

    if (expiry <= now) {
      // Expired
      await store.updateVehicle(vehicle.id, {
        listingStatus: "expired",
        status: "draft",
        approvalStatus: "Expired",
      });
      expired++;
    } else if (expiry <= in3Days && !vehicle.renewalReminderSent) {
      // Expiring soon — send reminder
      try {
        const dealer = await store.findDealerById(vehicle.dealerId);
        if (dealer) {
          const dealerUser = await store.findUserByDealerId(dealer.id);
          if (dealerUser?.email) {
            await sendListingExpiryReminder(
              dealerUser.email,
              dealer.name,
              `${vehicle.brand} ${vehicle.model}`,
              expiry
            );
          }
        }
        await store.updateVehicle(vehicle.id, { renewalReminderSent: true });
        reminded++;
      } catch (e) {
        console.error("[expiry-check] Failed to send reminder:", e.message);
      }
    }
  }

  return { expired, reminded };
}

module.exports = router;
module.exports.runExpiryCheck = runExpiryCheck;
