import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import VerifiedStamp from "../components/VerifiedStamp";

export default function Dealers() {
  const [dealers, setDealers] = useState([]);

  useEffect(() => {
    api.listDealers().then((d) => setDealers(d.dealers));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold text-ink">Dealers on TrustDrive</h1>
      <p className="mt-1 text-sm text-muted">Every dealer below has passed, or is going through, GST and KYC verification.</p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {dealers.map((d) => (
          <Link
            key={d.id}
            to={`/dealer/${d.id}`}
            className="focus-ring flex items-start justify-between gap-4 rounded-2xl border hairline bg-white p-6 hover:shadow-lg hover:shadow-primary/5"
          >
            <div>
              <div className="flex items-center gap-2">
                {d.verificationStatus === "verified" && <VerifiedStamp size="sm" />}
                <h2 className="font-display text-lg font-semibold text-ink">{d.name}</h2>
              </div>
              <p className="mt-1 text-sm text-muted">{d.address}, {d.city}</p>
              <p className="mt-2 text-xs font-mono text-muted">GST: {d.gstNumber}</p>
              <span
                className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  d.verificationStatus === "verified"
                    ? "bg-primary/10 text-primary"
                    : d.verificationStatus === "pending"
                    ? "bg-gold/15 text-gold-dark"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {d.verificationStatus}
              </span>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-ink">★ {d.rating || "—"}</p>
              <p className="text-xs text-muted">{d.reviewCount} reviews</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
