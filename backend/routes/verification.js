const express = require("express");
const store = require("../lib/store");
const { verifyRC } = require("../lib/rcVerification");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// POST /api/verification/vehicle/:id  -> runs RC/VIN check against VAHAN (or
// the mock, if no API key is configured), and gates whether the car is
// visible to buyers: verified -> goes live, declined -> hidden, pending ->
// awaiting recheck.
router.post("/vehicle/:id", requireAuth, requireRole("dealer", "admin"), async (req, res) => {
  const vehicle = await store.findVehicleById(req.params.id);
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

  const result = await verifyRC(vehicle.registrationNumber, vehicle.chassisNumber);

  // The mock doesn't know the vehicle's own brand/model/year/fuel -- fill
  // those in from what the dealer entered, so the admin/dealer see a
  // complete VAHAN-style record either way.
  if (result.fields && result.source.startsWith("mock")) {
    result.fields.makeModel = `${vehicle.brand} ${vehicle.model}`;
    result.fields.registrationDate = `${vehicle.year}-01-01`;
    result.fields.fuelType = (vehicle.fuel || "").toUpperCase();
  }

  const updated = await store.updateVehicle(vehicle.id, {
    rcVerified: result.status === "verified",
    verificationStatus: result.status,
    verificationDetails: result,
  });
  res.json({ vehicle: updated, verification: result });
});

// POST /api/verification/dealer/:id  -> admin approves/rejects dealer KYC
router.post("/dealer/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const dealer = await store.findDealerById(req.params.id);
  if (!dealer) return res.status(404).json({ error: "Dealer not found" });
  const { decision } = req.body || {}; // "approve" | "reject"
  if (!["approve", "reject"].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
  }

  const patch = {
    verificationStatus: decision === "approve" ? "verified" : "rejected",
    verifiedAt: decision === "approve" ? new Date().toISOString() : null,
  };

  // Data retention: once an application is rejected, there's no reason to
  // keep holding their PAN/Aadhaar/bank details -- purge the encrypted
  // payload immediately. kycDocs (just filenames, for the audit trail) and
  // the dealer record itself are kept so the rejection is still visible in
  // the admin dashboard.
  if (decision === "reject") {
    patch.verification = null;
  }

  const updated = await store.updateDealer(dealer.id, patch);
  res.json({ dealer: updated });
});

// GET /api/verification/pending  -> admin queue
router.get("/pending", requireAuth, requireRole("admin"), async (req, res) => {
  res.json({ dealers: await store.listPendingDealers() });
});

module.exports = router;
