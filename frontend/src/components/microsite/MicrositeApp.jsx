import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import MicrositeView from "./MicrositeView";

export default function MicrositeApp({ subdomain }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getSiteBySubdomain(subdomain).then(setData).catch(() => setError(true));
  }, [subdomain]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-gold-dark">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink">This site isn't available.</h1>
        <p className="mt-2 text-sm text-muted">It may not be published yet, or the dealer isn't verified.</p>
        <a href="/" className="focus-ring mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-paper">
          Go to TrustDrive India
        </a>
      </div>
    );
  }

  if (!data) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading…</div>;
  }

  return <MicrositeView site={data.site} dealer={data.dealer} vehicles={data.vehicles} reviews={data.reviews} />;
}
