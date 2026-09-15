const express = require("express");
const store = require("../lib/store");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// POST /api/leads  { vehicleId, buyerName, buyerPhone, channel } - public (no login needed to enquire)
router.post("/", async (req, res) => {
  const { vehicleId, buyerName, buyerPhone, channel = "whatsapp", message } = req.body || {};
  const vehicle = await store.findVehicleById(vehicleId);
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
  if (!buyerName || !buyerPhone) {
    return res.status(400).json({ error: "buyerName and buyerPhone are required" });
  }
  const lead = await store.createLead({
    vehicleId,
    dealerId: vehicle.dealerId,
    buyerName,
    buyerPhone,
    channel,
    message: message || "",
  });

  // Simulate the Notification Service fan-out (SMS/Email/Push) referenced in the diagram
  await store.createNotification({
    dealerId: vehicle.dealerId,
    type: "new_lead",
    text: `New ${channel} enquiry for ${vehicle.brand} ${vehicle.model} from ${buyerName}`,
  });

  const dealer = await store.findDealerById(vehicle.dealerId);
  const waLink = dealer?.whatsapp
    ? `https://wa.me/${dealer.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
        `Hi, I'm interested in the ${vehicle.brand} ${vehicle.model} (${vehicle.registrationNumber}) listed on TrustDrive.`
      )}`
    : null;

  res.status(201).json({ lead, whatsappLink: waLink });
});

// GET /api/leads  (dealer views their leads)
router.get("/", requireAuth, requireRole("dealer", "admin"), async (req, res) => {
  let leads;
  if (req.user.role === "dealer") {
    leads = await store.listLeadsByDealer(req.user.dealerId);
  } else {
    leads = await store.listAllLeads();
  }
  // memoryStore doesn't embed vehicle; attach it if missing
  const withVehicle = await Promise.all(
    leads.map(async (l) => (l.vehicle ? l : { ...l, vehicle: await store.findVehicleById(l.vehicleId) }))
  );
  res.json({ leads: withVehicle });
});

// PATCH /api/leads/:id  { status }
router.patch("/:id", requireAuth, requireRole("dealer", "admin"), async (req, res) => {
  const lead = await store.findLeadById(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  if (req.user.role === "dealer" && lead.dealerId !== req.user.dealerId) {
    return res.status(403).json({ error: "You can only manage your own leads" });
  }
  const { status } = req.body || {};
  if (!["new", "contacted", "closed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const updated = await store.updateLead(lead.id, { status });
  res.json({ lead: updated });
});

module.exports = router;
