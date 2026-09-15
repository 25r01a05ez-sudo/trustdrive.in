const express = require("express");
const store = require("../lib/store");

const router = express.Router();

// GET /api/reviews            -> all reviews platform-wide, with dealer name attached
// GET /api/reviews?dealerId=  -> reviews for one dealer
router.get("/", async (req, res) => {
  const { dealerId } = req.query;
  if (dealerId) {
    const reviews = await store.listReviewsByDealer(dealerId);
    return res.json({ reviews });
  }

  const reviews = await store.listAllReviews();
  // memoryStore reviews don't come with a joined dealer name -- attach one.
  const withDealerName = await Promise.all(
    reviews.map(async (r) => {
      if (r.dealer?.name) return { ...r, dealerName: r.dealer.name };
      const dealer = await store.findDealerById(r.dealerId);
      return { ...r, dealerName: dealer?.name || "TrustDrive dealer" };
    })
  );
  res.json({ reviews: withDealerName });
});

// POST /api/reviews  { dealerId, buyerName, rating, comment }
router.post("/", async (req, res) => {
  const { dealerId, buyerName, rating, comment } = req.body || {};
  const dealer = await store.findDealerById(dealerId);
  if (!dealer) return res.status(404).json({ error: "Dealer not found" });
  if (!buyerName || !rating) return res.status(400).json({ error: "buyerName and rating are required" });

  const review = await store.createReview({
    dealerId,
    buyerName,
    rating: Math.max(1, Math.min(5, Number(rating))),
    comment: comment || "",
  });
  const updatedDealer = await store.findDealerById(dealerId);

  res.status(201).json({ review, dealer: updatedDealer });
});

module.exports = router;
