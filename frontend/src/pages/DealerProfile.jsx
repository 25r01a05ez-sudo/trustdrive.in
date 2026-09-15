import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import VerifiedStamp from "../components/VerifiedStamp";
import VehicleCard from "../components/VehicleCard";

export default function DealerProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getDealer(id).then(setData);
  }, [id]);

  if (!data) return <div className="mx-auto max-w-6xl px-6 py-24 text-center text-muted">Loading…</div>;
  const { dealer, vehicles, reviews } = data;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="rounded-2xl border hairline bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {dealer.verificationStatus === "verified" && <VerifiedStamp size="md" />}
              <h1 className="font-display text-2xl font-semibold text-ink">{dealer.name}</h1>
            </div>
            <p className="mt-1 text-sm text-muted">{dealer.address}, {dealer.city}</p>
            <p className="mt-1 font-mono text-xs text-muted">GST: {dealer.gstNumber}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg text-ink">★ {dealer.rating || "—"}</p>
            <p className="text-xs text-muted">{dealer.reviewCount} reviews</p>
          </div>
        </div>
        {(dealer.whatsapp || dealer.address) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t hairline pt-4">
            {dealer.whatsapp && (
              <a
                href={`tel:${dealer.whatsapp.replace(/[^\d+]/g, "")}`}
                className="focus-ring rounded-full border hairline px-4 py-1.5 text-xs font-medium text-ink hover:border-primary hover:text-primary"
              >
                Call {dealer.whatsapp}
              </a>
            )}
            {dealer.whatsapp && (
              <a
                href={`https://wa.me/${dealer.whatsapp.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="focus-ring rounded-full border hairline px-4 py-1.5 text-xs font-medium text-ink hover:border-primary hover:text-primary"
              >
                WhatsApp
              </a>
            )}
            {dealer.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dealer.address}, ${dealer.city}`)}`}
                target="_blank"
                rel="noreferrer"
                className="focus-ring rounded-full border hairline px-4 py-1.5 text-xs font-medium text-ink hover:border-primary hover:text-primary"
              >
                Get directions
              </a>
            )}
          </div>
        )}
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold text-ink">Listings from {dealer.name}</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((v) => <VehicleCard key={v.id} vehicle={{ ...v, dealer }} />)}
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold text-ink">Buyer reviews</h2>
      <div className="mt-5 space-y-3">
        {reviews.length === 0 && <p className="text-sm text-muted">No reviews yet.</p>}
        {reviews.map((r) => (
          <div key={r.id} className="rounded-xl border hairline bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">{r.buyerName}</span>
              <span className="font-mono text-xs text-gold-dark">{"★".repeat(r.rating)}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{r.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
