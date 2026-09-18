const express = require("express");
const store = require("../lib/store");
const { requireAuth, optionalAuth, requireRole } = require("../middleware/auth");
const { notifyAdminOnWhatsApp } = require("../lib/whatsapp");
const { sanitizeVehicles } = require("../lib/vehicleVisibility");
const { encryptJSON, decryptJSON } = require("../lib/encryption");

const router = express.Router();

// GET /api/dealers  (list, buyer-facing)
router.get("/", async (req, res) => {
  const { city, verified } = req.query;
  const dealers = await store.listDealers({ city, verified: verified === "true" });
  res.json({ dealers: dealers.map(publicDealer) });
});

// GET /api/dealers/:id  (public dealer profile -- documents are NOT
// included here; anyone can hit this endpoint, and a dealer's PAN/Aadhaar/
// bank details must never be exposed to the public. See
// GET /:id/verification below for the admin-only version with documents.)
router.get("/:id", optionalAuth, async (req, res) => {
  const dealer = await store.findDealerById(req.params.id);
  if (!dealer) return res.status(404).json({ error: "Dealer not found" });
  const allVehicles = await store.listVehiclesByDealer(dealer.id);
  const vehicles = allVehicles.filter((v) => v.status === "active" && (v.approvalStatus === "Approved" || !v.approvalStatus));
  const reviews = await store.listReviewsByDealer(dealer.id);
  res.json({ dealer: publicDealer(dealer), vehicles: sanitizeVehicles(vehicles, req.user), reviews });
});

// GET /api/dealers/:id/verification  (admin-only -- full KYC payload,
// including document previews/metadata, for manual review. Decrypted here,
// only for an authenticated admin -- see lib/encryption.js.)
router.get("/:id/verification", requireAuth, requireRole("admin"), async (req, res) => {
  const dealer = await store.findDealerById(req.params.id);
  if (!dealer) return res.status(404).json({ error: "Dealer not found" });
  res.json({ dealer, verification: decryptJSON(dealer.verification) });
});

function extractDocumentList(verification) {
  if (!verification) return [];
  const names = [];
  const docs = verification.documents || {};
  ["pan", "aadhaar", "gst", "udyam", "tradeLicense"].forEach((k) => {
    if (docs[k]?.name) names.push(docs[k].name);
  });
  if (verification.addressProof?.name) names.push(verification.addressProof.name);
  if (verification.cancelledCheque?.name) names.push(verification.cancelledCheque.name);
  const photos = verification.photos || {};
  ["exterior", "interior", "signboard"].forEach((k) => {
    if (photos[k]?.name) names.push(photos[k].name);
  });
  (verification.extraPhotos || []).forEach((p) => p?.name && names.push(p.name));
  return names;
}

// Strips sensitive KYC document data before sending a dealer to the public.
function publicDealer(dealer) {
  const { verification, ...rest } = dealer;
  return rest;
}

// POST /api/dealers/register  { name, city, address, panNumber, udyamNumber, gstNumber (optional), verification }
router.post("/register", requireAuth, requireRole("dealer"), async (req, res) => {
  const { name, city, address, verification, panNumber, udyamNumber, gstNumber } = req.body || {};
  if (!name || !city) {
    return res.status(400).json({ error: "name and city are required" });
  }
  // PAN Card is mandatory
  const cleanPan = (panNumber || verification?.panNumber || "").trim().toUpperCase();
  if (!cleanPan) {
    return res.status(400).json({ error: "PAN Card number is required" });
  }
  // Udyam Registration Certificate is mandatory
  const cleanUdyam = (udyamNumber || verification?.udyamNumber || "").trim().toUpperCase();
  if (!cleanUdyam) {
    return res.status(400).json({ error: "Udyam Registration Certificate number is required" });
  }

  const kycDocs = extractDocumentList(verification);

  const dealer = await store.createDealer({
    name,
    gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : null, // optional
    panNumber: cleanPan,
    udyamNumber: cleanUdyam,
    city,
    address: address || "",
    whatsapp: (req.body.whatsapp || verification?.ownerMobile || req.user.phone || "").trim(),
    kycDocs,
    verification: encryptJSON(verification || null),
  });
  await store.setUserDealerId(req.user.id, dealer.id);

  const owner = verification
    ? `${verification.ownerName || "-"} (${verification.designation || "Owner"}), ${verification.ownerMobile || "-"}, ${verification.ownerEmail || "-"}`
    : "-";

  const text = [
    "New TrustDrive India dealer registration -- please verify manually:",
    "",
    `Dealership: ${name}`,
    `PAN: ${cleanPan}`,
    `Udyam: ${cleanUdyam}`,
    gstNumber ? `GSTIN: ${gstNumber.trim().toUpperCase()}` : null,
    `City: ${city}`,
    `Address: ${address || "-"}`,
    `Owner: ${owner}`,
    "",
    `Documents provided (${kycDocs.length}): ${kycDocs.length ? kycDocs.join(", ") : "none"}`,
    "",
    "Please review the PAN Card and Udyam Certificate, then approve/reject from the admin dashboard.",
  ].filter(Boolean).join("\n");

  const { waLink } = await notifyAdminOnWhatsApp(text);

  res.status(201).json({ dealer, whatsappLink: waLink });
});

// PATCH /api/dealers/:id
// Dealers can update a small set of their own public-facing fields.
// Admins can edit anything, including verification status, as part of
// managing the dealer directory.
router.patch("/:id", requireAuth, requireRole("dealer", "admin"), async (req, res) => {
  const dealer = await store.findDealerById(req.params.id);
  if (!dealer) return res.status(404).json({ error: "Dealer not found" });
  if (req.user.role === "dealer" && req.user.dealerId !== dealer.id) {
    return res.status(403).json({ error: "You can only edit your own dealer profile" });
  }

  const patch = {};
  if (req.user.role === "admin") {
    const editable = ["name", "city", "address", "whatsapp", "gstNumber", "panNumber", "udyamNumber", "verificationStatus", "rejectionReason"];
    editable.forEach((f) => {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    });
    if (patch.verificationStatus === "verified" && dealer.verificationStatus !== "verified") {
      patch.verifiedAt = new Date().toISOString();
      patch.rejectionReason = null; // clear any previous rejection reason
    }
    // Same data-retention rule as the dedicated approve/reject endpoint:
    // purge encrypted KYC data as soon as a dealer is marked rejected.
    if (patch.verificationStatus === "rejected") {
      patch.verification = null;
    }
  } else {
    const editable = ["address", "whatsapp"];
    editable.forEach((f) => {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    });
  }

  const updated = await store.updateDealer(dealer.id, patch);
  res.json({ dealer: updated });
});

// DELETE /api/dealers/:id  (admin-only -- removes the dealer and their
// listings, and unlinks any user account that was tied to them)
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const dealer = await store.findDealerById(req.params.id);
  if (!dealer) return res.status(404).json({ error: "Dealer not found" });
  await store.deleteVehiclesByDealer(dealer.id);
  await store.unsetUsersDealerId(dealer.id);
  await store.deleteDealer(dealer.id);
  res.json({ ok: true });
});

module.exports = router;
