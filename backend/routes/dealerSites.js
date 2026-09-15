const express = require("express");
const store = require("../lib/store");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  generateSite,
  sanitizeSiteContent,
  slugifySubdomain,
  isValidSubdomain,
} = require("../lib/aiSiteGenerator");
const { sanitizeVehicles } = require("../lib/vehicleVisibility");
const { aiRateLimiter } = require("../lib/aiThrottle");

const router = express.Router();

async function uniqueDefaultSubdomain(dealer, excludeDealerId) {
  const base = slugifySubdomain(dealer?.name || "dealer");
  let candidate = base || "dealer";
  let counter = 1;
  while (await store.isSubdomainTaken(candidate, excludeDealerId)) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }
  return candidate;
}

// GET /api/dealer-sites/mine (dealer's own site, published or not)
router.get("/mine", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    if (!req.user.dealerId) return res.status(400).json({ error: "Register your dealership first" });
    const site = await store.findDealerSiteByDealerId(req.user.dealerId);
    res.json({ site });
  } catch (err) {
    console.error("[GET /api/dealer-sites/mine error]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dealer-sites/generate { prompt }
router.post("/generate", requireAuth, requireRole("dealer"), aiRateLimiter, async (req, res) => {
  try {
    if (!req.user.dealerId) return res.status(400).json({ error: "Register your dealership first" });
    const { prompt } = req.body || {};
    if (!prompt || String(prompt).length < 3) {
      return res.status(400).json({ error: "Describe the kind of site you want (a few words is fine)" });
    }

    const dealer = await store.findDealerById(req.user.dealerId);
    const content = await generateSite(String(prompt).slice(0, 500), dealer);

    const existing = await store.findDealerSiteByDealerId(req.user.dealerId);
    const subdomain = existing?.subdomain || (await uniqueDefaultSubdomain(dealer, req.user.dealerId));

    const site = await store.upsertDealerSite(req.user.dealerId, {
      subdomain,
      lastPrompt: String(prompt).slice(0, 500),
      ...content,
    });
    res.json({ site });
  } catch (err) {
    console.error("[POST /api/dealer-sites/generate error]", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/dealer-sites/mine -- manual edits
router.patch("/mine", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    if (!req.user.dealerId) return res.status(400).json({ error: "Register your dealership first" });
    const existing = await store.findDealerSiteByDealerId(req.user.dealerId);
    if (!existing) return res.status(404).json({ error: "Generate a site first" });

    const dealer = await store.findDealerById(req.user.dealerId);
    const merged = sanitizeSiteContent(
      {
        theme: req.body.theme || existing.theme,
        hero: req.body.hero || existing.hero,
        about: req.body.about || existing.about,
        highlights: req.body.highlights || existing.highlights,
        contact: req.body.contact || existing.contact,
      },
      dealer
    );

    const site = await store.upsertDealerSite(req.user.dealerId, merged);
    res.json({ site });
  } catch (err) {
    console.error("[PATCH /api/dealer-sites/mine error]", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/dealer-sites/subdomain { subdomain }
router.put("/subdomain", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    if (!req.user.dealerId) return res.status(400).json({ error: "Register your dealership first" });
    const raw = (req.body?.subdomain || "").trim();
    const slug = slugifySubdomain(raw);
    if (!isValidSubdomain(slug)) {
      return res.status(400).json({
        error: "Subdomain must be 1-40 lowercase letters, numbers, or hyphens (cannot start/end with hyphen or be a reserved word)",
      });
    }

    const taken = await store.isSubdomainTaken(slug, req.user.dealerId);
    if (taken) return res.status(409).json({ error: "That subdomain is already taken" });

    const site = await store.upsertDealerSite(req.user.dealerId, { subdomain: slug });
    res.json({ site });
  } catch (err) {
    console.error("[PUT /api/dealer-sites/subdomain error]", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dealer-sites/check-subdomain?subdomain=xyz
router.get("/check-subdomain", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    const candidate = slugifySubdomain(req.query.subdomain || "");
    if (!isValidSubdomain(candidate)) return res.json({ available: false, reason: "invalid" });
    const taken = await store.isSubdomainTaken(candidate, req.user.dealerId);
    res.json({ available: !taken, subdomain: candidate });
  } catch (err) {
    console.error("[GET /api/dealer-sites/check-subdomain error]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dealer-sites/publish
router.post("/publish", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    if (!req.user.dealerId) return res.status(400).json({ error: "Register your dealership first" });
    const existing = await store.findDealerSiteByDealerId(req.user.dealerId);
    if (!existing) return res.status(404).json({ error: "Generate a site first" });
    const site = await store.upsertDealerSite(req.user.dealerId, { published: true });
    res.json({ site });
  } catch (err) {
    console.error("[POST /api/dealer-sites/publish error]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dealer-sites/unpublish
router.post("/unpublish", requireAuth, requireRole("dealer"), async (req, res) => {
  try {
    if (!req.user.dealerId) return res.status(400).json({ error: "Register your dealership first" });
    const site = await store.upsertDealerSite(req.user.dealerId, { published: false });
    res.json({ site });
  } catch (err) {
    console.error("[POST /api/dealer-sites/unpublish error]", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dealer-sites/by-subdomain/:subdomain (public)
router.get("/by-subdomain/:subdomain", async (req, res) => {
  try {
    const site = await store.findDealerSiteBySubdomain(req.params.subdomain.toLowerCase());
    if (!site || !site.published) return res.status(404).json({ error: "Site not found" });
    const dealer = await store.findDealerById(site.dealerId);
    if (!dealer || dealer.verificationStatus !== "verified") {
      return res.status(404).json({ error: "Site not found" });
    }
    const allVehicles = await store.listVehiclesByDealer(dealer.id);
    const vehicles = allVehicles.filter(
      (v) => v.status === "active" && (v.approvalStatus === "Approved" || !v.approvalStatus)
    );
    const reviews = await store.listReviewsByDealer(dealer.id);
    const publicVehicles = sanitizeVehicles(vehicles, null);

    res.json({
      site: {
        theme: site.theme,
        hero: site.hero,
        about: site.about,
        highlights: site.highlights,
        contact: site.contact,
      },
      dealer: {
        id: dealer.id,
        name: dealer.name,
        city: dealer.city,
        address: dealer.address,
        whatsapp: dealer.whatsapp,
        rating: dealer.rating,
        reviewCount: dealer.reviewCount,
      },
      vehicles: publicVehicles,
      reviews,
    });
  } catch (err) {
    console.error("[GET /api/dealer-sites/by-subdomain error]", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
