import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listAllReviews().then((d) => setReviews(d.reviews)).finally(() => setLoading(false));
  }, []);

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink">Customer reviews</h1>
      <p className="mt-2 text-sm text-muted">What buyers say after working with dealers on TrustDrive.</p>

      {avg && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border hairline bg-white p-5">
          <span className="font-display text-3xl font-semibold text-ink">{avg}</span>
          <div>
            <p className="font-mono text-sm text-gold-dark">{"★".repeat(Math.round(avg))}</p>
            <p className="text-xs text-muted">Across {reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {loading && <p className="text-sm text-muted">Loading reviews…</p>}
        {!loading && reviews.length === 0 && (
          <p className="text-sm text-muted">No reviews yet — be the first to leave one after a purchase.</p>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="rounded-xl border hairline bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">{r.buyerName}</span>
              <span className="font-mono text-xs text-gold-dark">{"★".repeat(r.rating)}</span>
            </div>
            {r.comment && <p className="mt-1.5 text-sm text-muted">{r.comment}</p>}
            <Link to={`/dealer/${r.dealerId}`} className="focus-ring mt-2 inline-block text-xs font-medium text-primary hover:underline">
              {r.dealerName || "View dealer"} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
