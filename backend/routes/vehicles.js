const express = require("express");
const store = require("../lib/store");
const { requireAuth, optionalAuth, requireRole } = require("../middleware/auth");
const { sanitizeVehicle, sanitizeVehicles } = require("../lib/vehicleVisibility");
const { logAuditEvent } = require("../lib/auditLog");
const { aiRateLimiter } = require("../lib/aiThrottle");
const { notifyDealerOnVehicleDecision } = require("../lib/whatsapp");

const router = express.Router();

// GET /api/vehicles (admin-only -- every vehicle regardless of status)
// Logs audit event when admin views full vehicle directory with unmasked data.
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const [vehicles, dealers] = await Promise.all([
      store.listVehicles({ status: null }),
      store.listDealers(),
    ]);
    const dealerById = new Map(dealers.map((d) => [d.id, d]));

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "vehicle_viewed_by_admin",
      details: { totalVehiclesCount: vehicles.length },
    });

    // Admin gets unmasked complete registration and chassis numbers
    res.json({
      vehicles: vehicles.map((v) => ({ ...v, dealer: dealerById.get(v.dealerId) })),
    });
  } catch (err) {
    console.error("[GET /api/vehicles error]", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vehicles/mine (dealer's own listings)
// Returns the dealer's listings with masked registration and chassis numbers
router.get("/mine", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    if (!req.user.dealerId) return res.json({ vehicles: [] });
    const vehicles = await store.listVehiclesByDealer(req.user.dealerId);
    res.json({ vehicles: sanitizeVehicles(vehicles, req.user) });
  } catch (err) {
    console.error("[GET /api/vehicles/mine error]", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vehicles/audit-logs (admin-only audit trail)
router.get("/audit-logs", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const logs = await store.listAuditLogs({ limit: 200 });
    res.json({ logs });
  } catch (err) {
    console.error("[GET /api/vehicles/audit-logs error]", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vehicles/:id
// Non-admin / Public can only view approved active vehicles.
// Masking and privacy rules strictly enforced server-side.
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const vehicle = await store.findVehicleById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const isOwner = Boolean(req.user?.role === "dealer" && req.user.dealerId === vehicle.dealerId);
    const isAdmin = Boolean(req.user?.role === "admin");

    // If vehicle is pending or rejected, only Admin or Owning Dealer can view it
    if (!isAdmin && !isOwner) {
      if (vehicle.status !== "active" || vehicle.approvalStatus !== "Approved") {
        return res.status(404).json({ error: "Vehicle not found or pending approval" });
      }
    }

    const dealer = await store.findDealerById(vehicle.dealerId);
    res.json({ vehicle: sanitizeVehicle(vehicle, req.user), dealer });
  } catch (err) {
    console.error("[GET /api/vehicles/:id error]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vehicles (dealer registers a new vehicle)
// Initial status is strictly set to "Pending Admin Approval" (status: "pending").
router.post("/", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    const dealerId = req.user.dealerId;
    if (!dealerId) return res.status(400).json({ error: "Register your dealership before listing vehicles" });

    const existingDealer = await store.findDealerById(dealerId);
    if (!existingDealer) {
      return res.status(400).json({ error: "Associated dealership not found in the database. Please complete dealer registration first." });
    }

    const body = req.body || {};
    const required = ["brand", "model", "year", "price", "chassisNumber", "registrationNumber"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });

    const cleanReg = String(body.registrationNumber).trim().toUpperCase();
    const cleanChassis = String(body.chassisNumber).trim().toUpperCase();

    // Check for duplicate active/pending vehicle
    const duplicate = await store.findVehicleByChassisOrReg(cleanChassis, cleanReg);
    if (duplicate) {
      const matchType = String(duplicate.registrationNumber).toUpperCase() === cleanReg ? "Registration Number" : "Chassis Number";
      return res.status(409).json({
        error: `A vehicle with this ${matchType} (${matchType === "Registration Number" ? cleanReg : cleanChassis}) is already registered on TrustDrive.`,
      });
    }

    const vehicle = await store.createVehicle({
      dealerId,
      brand: body.brand,
      model: body.model,
      year: Number(body.year),
      price: Number(body.price),
      km: Number(body.km || 0),
      fuel: body.fuel || "Petrol",
      transmission: body.transmission || "Manual",
      owners: Number(body.owners || 1),
      chassisNumber: cleanChassis,
      registrationNumber: cleanReg,
      images: body.images || [],
      description: body.description || "",
      // Strict Gated Lifecycle
      approvalStatus: "Pending Admin Approval",
      status: "pending",
      rejectionReason: null,
      submittedAt: new Date().toISOString(),
    });

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "vehicle_registered",
      vehicleId: vehicle.id,
      dealerId,
      details: {
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        price: vehicle.price,
      },
    });

    // Return sanitized vehicle so dealer never sees unmasked raw record in response
    res.status(201).json({
      vehicle: sanitizeVehicle(vehicle, req.user),
      message: "Vehicle registered successfully. It is now Pending Admin Approval.",
    });
  } catch (err) {
    console.error("[POST /api/vehicles error]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vehicles/:id/approve (Admin-only: Approves vehicle)
router.post("/:id/approve", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const vehicle = await store.findVehicleById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const approved = await store.approveVehicle(vehicle.id, req.user.id);
    const dealer = await store.findDealerById(vehicle.dealerId);

    // Automated WhatsApp alert to dealer
    notifyDealerOnVehicleDecision(dealer, approved, "Approved").catch((e) =>
      console.error("[whatsapp alert error]", e.message)
    );

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "vehicle_approved",
      vehicleId: vehicle.id,
      dealerId: vehicle.dealerId,
      details: { approvedAt: approved?.approvedAt },
    });

    res.json({ vehicle: approved, message: "Vehicle approved and active." });
  } catch (err) {
    console.error("[POST /api/vehicles/:id/approve error]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vehicles/:id/reject (Admin-only: Rejects vehicle with reason)
router.post("/:id/reject", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const vehicle = await store.findVehicleById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const { reason } = req.body || {};
    const rejected = await store.rejectVehicle(vehicle.id, reason, req.user.id);
    const dealer = await store.findDealerById(vehicle.dealerId);

    // Automated WhatsApp alert to dealer
    notifyDealerOnVehicleDecision(dealer, rejected, "Rejected", reason).catch((e) =>
      console.error("[whatsapp alert error]", e.message)
    );

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "vehicle_rejected",
      vehicleId: vehicle.id,
      dealerId: vehicle.dealerId,
      details: { reason: rejected?.rejectionReason },
    });

    res.json({ vehicle: rejected, message: "Vehicle rejected." });
  } catch (err) {
    console.error("[POST /api/vehicles/:id/reject error]", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/vehicles/:id/feature (Dealer or Admin: Toggles Spotlight / Featured status)
router.patch("/:id/feature", requireAuth, requireRole("dealer", "admin"), async (req, res) => {
  try {
    const vehicle = await store.findVehicleById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    if (req.user.role === "dealer" && vehicle.dealerId !== req.user.dealerId) {
      return res.status(403).json({ error: "You can only spotlight your own listings" });
    }

    const nextFeatured = req.body.featured !== undefined ? Boolean(req.body.featured) : !vehicle.featured;
    const updated = await store.updateVehicle(vehicle.id, { featured: nextFeatured });

    res.json({ vehicle: sanitizeVehicle(updated, req.user), featured: nextFeatured });
  } catch (err) {
    console.error("[PATCH /api/vehicles/:id/feature error]", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/vehicles/:id (dealer edits / marks sold)
router.patch("/:id", requireAuth, requireRole("dealer", "admin"), async (req, res) => {
  try {
    const vehicle = await store.findVehicleById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    if (req.user.role === "dealer" && vehicle.dealerId !== req.user.dealerId) {
      return res.status(403).json({ error: "You can only edit your own listings" });
    }

    const patch = {};
    if (req.user.role === "admin") {
      const editableAdmin = [
        "price",
        "km",
        "description",
        "status",
        "approvalStatus",
        "rejectionReason",
        "images",
      ];
      editableAdmin.forEach((f) => {
        if (req.body[f] !== undefined) patch[f] = req.body[f];
      });
    } else {
      // Dealer can only edit safe fields (cannot alter registrationNumber, chassisNumber, or self-approve)
      const editableDealer = ["price", "km", "description", "images"];
      editableDealer.forEach((f) => {
        if (req.body[f] !== undefined) patch[f] = req.body[f];
      });

      // Dealer can mark a previously approved vehicle as "sold"
      if (req.body.status === "sold" && vehicle.approvalStatus === "Approved") {
        patch.status = "sold";
      }

      // If an item was rejected and dealer edits, reset to Pending Admin Approval
      if (vehicle.approvalStatus === "Rejected" && Object.keys(patch).length > 0) {
        patch.approvalStatus = "Pending Admin Approval";
        patch.status = "pending";
        patch.rejectionReason = null;
      }
    }

    const updated = await store.updateVehicle(vehicle.id, patch);

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "vehicle_modified",
      vehicleId: vehicle.id,
      dealerId: vehicle.dealerId,
      details: { modifiedFields: Object.keys(patch) },
    });

    res.json({ vehicle: sanitizeVehicle(updated, req.user) });
  } catch (err) {
    console.error("[PATCH /api/vehicles/:id error]", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/vehicles/:id
router.delete("/:id", requireAuth, requireRole("dealer", "admin"), async (req, res) => {
  try {
    const vehicle = await store.findVehicleById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    if (req.user.role === "dealer" && vehicle.dealerId !== req.user.dealerId) {
      return res.status(403).json({ error: "You can only delete your own listings" });
    }

    await store.deleteVehicle(vehicle.id);

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: "vehicle_deleted",
      vehicleId: vehicle.id,
      dealerId: vehicle.dealerId,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/vehicles/:id error]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vehicles/generate-description (AI writes listing description for dealer)
router.post("/generate-description", requireAuth, requireRole("dealer", "admin"), aiRateLimiter, async (req, res) => {
  try {
    const { brand, model, year, km, fuel, transmission, owners, price, highlights } = req.body || {};
    if (!brand || !model) {
      return res.status(400).json({ error: "Brand and model are required to generate description" });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const prompt = `Write an attractive, honest, and professional 3-4 sentence listing description for a used car on TrustDrive India.
Details:
- Vehicle: ${year || 2022} ${brand} ${model}
- Mileage: ${km ? `${km} km` : "Low mileage"}
- Fuel: ${fuel || "Petrol"} | Transmission: ${transmission || "Manual"}
- Ownership: ${owners ? `${owners} Owner` : "Single owner"}
- Price: ₹${price ? Number(price).toLocaleString("en-IN") : ""}
- Additional dealer notes: ${highlights || "Excellent condition, showroom maintained"}

Include key selling points (reliability, maintenance, document clearance, and driving comfort). Return ONLY the description text, no extra commentary or markdown quotes.`;

    let generatedText = "";
    if (geminiKey) {
      const models = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest"];
      for (const m of models) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
          const gRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 250 },
            }),
          });
          if (gRes.ok) {
            const data = await gRes.json();
            generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            if (generatedText) break;
          }
        } catch (e) {
          // continue to next model
        }
      }
    }

    if (!generatedText) {
      // Deterministic fallback
      generatedText = `Well-maintained ${year || 2022} ${brand} ${model} in pristine condition. Driven ${km ? `${Number(km).toLocaleString("en-IN")} km` : "gently"}, single-owner vehicle with complete service history and verified ownership records. Fully checked against VAHAN and legally clear for immediate transfer. Contact us directly to arrange an inspection and test drive.`;
    }

    res.json({ description: generatedText });
  } catch (err) {
    console.error("[POST /api/vehicles/generate-description error]", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
