const express = require("express");
const store = require("../lib/store");
const { optionalAuth } = require("../middleware/auth");
const { sanitizeVehicles } = require("../lib/vehicleVisibility");

const router = express.Router();

// GET /api/search/facets - Returns available filter options (cities, areas, fuels, brands)
router.get("/facets", async (req, res) => {
  try {
    const [vehicles, dealers] = await Promise.all([
      store.listVehicles({ status: "active" }),
      store.listDealers({ verified: true }),
    ]);

    const activeVehicles = vehicles.filter(
      (v) => v.status === "active" && (v.approvalStatus === "Approved" || !v.approvalStatus)
    );

    const brands = [...new Set(activeVehicles.map((v) => v.brand).filter(Boolean))].sort();
    const fuels = ["Petrol", "Diesel", "Electric", "CNG", "Hybrid"];
    const cities = [...new Set(dealers.map((d) => d.city).filter(Boolean))].sort();

    // Extract area/locality names from dealer addresses
    const areas = [...new Set(
      dealers
        .map((d) => d.address)
        .filter(Boolean)
        .map((addr) => {
          const parts = addr.split(",").map((s) => s.trim());
          return parts[0] || addr;
        })
    )].sort();

    res.json({
      brands,
      fuels,
      cities,
      areas,
      totalCount: activeVehicles.length,
    });
  } catch (err) {
    console.error("[GET /api/search/facets error]", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search?q=&brand=&city=&area=&minPrice=&maxPrice=&fuel=&transmission=&verifiedOnly=&sort=
router.get("/", optionalAuth, async (req, res) => {
  try {
    const {
      q,
      brand,
      city,
      area,
      minPrice,
      maxPrice,
      fuel,
      transmission,
      verifiedOnly,
      sort = "newest",
    } = req.query;

    const [vehicles, dealers] = await Promise.all([
      store.listVehicles({ status: "active" }),
      store.listDealers(),
    ]);
    const dealerById = new Map(dealers.map((d) => [d.id, d]));

    // A vehicle goes live to buyers ONLY if:
    // 1. The vehicle has been approved by an admin
    // 2. The dealer itself is verified
    let results = vehicles.filter(
      (v) =>
        v.status === "active" &&
        (v.approvalStatus === "Approved" || !v.approvalStatus) &&
        dealerById.get(v.dealerId)?.verificationStatus === "verified"
    );

    if (q) {
      const needle = String(q).toLowerCase();
      results = results.filter(
        (v) =>
          v.brand.toLowerCase().includes(needle) ||
          v.model.toLowerCase().includes(needle) ||
          dealerById.get(v.dealerId)?.city?.toLowerCase().includes(needle) ||
          dealerById.get(v.dealerId)?.address?.toLowerCase().includes(needle)
      );
    }

    if (brand) {
      results = results.filter((v) => v.brand.toLowerCase() === String(brand).toLowerCase());
    }

    if (fuel) {
      const fuelLower = String(fuel).toLowerCase();
      results = results.filter((v) => (v.fuel || "").toLowerCase() === fuelLower);
    }

    if (transmission) {
      const transLower = String(transmission).toLowerCase();
      results = results.filter((v) => (v.transmission || "").toLowerCase() === transLower);
    }

    if (minPrice) results = results.filter((v) => v.price >= Number(minPrice));
    if (maxPrice) results = results.filter((v) => v.price <= Number(maxPrice));

    if (city) {
      const cityLower = String(city).toLowerCase();
      results = results.filter(
        (v) => (dealerById.get(v.dealerId)?.city || "").toLowerCase() === cityLower
      );
    }

    if (area) {
      const areaLower = String(area).toLowerCase();
      results = results.filter((v) =>
        (dealerById.get(v.dealerId)?.address || "").toLowerCase().includes(areaLower)
      );
    }

    if (verifiedOnly === "true") {
      results = results.filter((v) => dealerById.get(v.dealerId)?.verificationStatus === "verified");
    }

    switch (sort) {
      case "price_asc":
        results = [...results].sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        results = [...results].sort((a, b) => b.price - a.price);
        break;
      case "km_asc":
        results = [...results].sort((a, b) => a.km - b.km);
        break;
      case "km_desc":
        results = [...results].sort((a, b) => b.km - a.km);
        break;
      default:
        // Default: Spotlight / Featured cars ranked first, then newest
        results = [...results].sort((a, b) => {
          if (Boolean(b.featured) !== Boolean(a.featured)) {
            return b.featured ? 1 : -1;
          }
          return new Date(b.listedAt) - new Date(a.listedAt);
        });
    }

    const withDealer = sanitizeVehicles(results, req.user).map((v) => ({
      ...v,
      dealer: dealerById.get(v.dealerId),
    }));

    res.json({ count: withDealer.length, results: withDealer });
  } catch (err) {
    console.error("[GET /api/search error]", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search/recommendations/:vehicleId
router.get("/recommendations/:vehicleId", async (req, res) => {
  try {
    const base = await store.findVehicleById(req.params.vehicleId);
    if (!base) return res.status(404).json({ error: "Vehicle not found" });
    const allVehicles = await store.listVehicles({ status: "active" });
    const recs = allVehicles
      .filter((v) => v.status === "active" && (v.approvalStatus === "Approved" || !v.approvalStatus))
      .filter((v) => v.id !== base.id)
      .filter((v) => v.brand === base.brand || Math.abs(v.price - base.price) < 300000)
      .slice(0, 4);
    res.json({ recommendations: sanitizeVehicles(recs, null) });
  } catch (err) {
    console.error("[GET /api/search/recommendations error]", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
