import { Link } from "react-router-dom";
import VehicleCard from "../VehicleCard";

export default function MicrositeView({ site, dealer, vehicles = [], reviews = [], preview = false }) {
  const { theme, hero, about, highlights, contact } = site;
  const fontClass = theme.font === "serif" ? "font-display" : "font-body";
  const waLink = dealer.whatsapp
    ? `https://wa.me/${dealer.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(`Hi, I found your dealership on your website — I'm interested in your inventory.`)}`
    : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section style={{ background: theme.primaryColor }} className="px-6 py-20 text-center">
        <h1 className={`${fontClass} mx-auto max-w-2xl text-4xl font-semibold leading-tight text-white md:text-5xl`}>
          {hero.headline}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/80">{hero.subheadline}</p>
        {waLink && !preview && (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            style={{ background: theme.accentColor }}
            className="mt-8 inline-block rounded-full px-6 py-3 text-sm font-semibold text-ink"
          >
            {contact.ctaText}
          </a>
        )}
        {preview && (
          <span style={{ background: theme.accentColor }} className="mt-8 inline-block rounded-full px-6 py-3 text-sm font-semibold text-ink">
            {contact.ctaText}
          </span>
        )}
      </section>

      {/* About */}
      <section className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h2 className={`${fontClass} text-2xl font-semibold`} style={{ color: theme.primaryColor }}>
          {about.heading}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">{about.body}</p>
      </section>

      {/* Highlights */}
      {highlights.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-14">
          <div className="grid gap-5 sm:grid-cols-3">
            {highlights.map((h) => (
              <div key={h.title} className="rounded-2xl border border-gray-200 p-5">
                <h3 className={`${fontClass} text-base font-semibold`} style={{ color: theme.primaryColor }}>{h.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-600">{h.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Live inventory -- always real data, never AI-generated */}
      <section className="mx-auto max-w-5xl px-6 pb-14">
        <h2 className={`${fontClass} text-xl font-semibold`} style={{ color: theme.primaryColor }}>Our inventory</h2>
        {vehicles.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No active listings right now — check back soon.</p>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => <VehicleCard key={v.id} vehicle={{ ...v, dealer }} />)}
          </div>
        )}
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 pb-14">
          <h2 className={`${fontClass} text-xl font-semibold`} style={{ color: theme.primaryColor }}>What buyers say</h2>
          <div className="mt-4 space-y-3">
            {reviews.slice(0, 4).map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r.buyerName}</span>
                  <span className="font-mono text-xs" style={{ color: theme.accentColor }}>{"★".repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="mt-1 text-sm text-gray-600">{r.comment}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section style={{ background: "#F6F4EE" }} className="px-6 py-12 text-center">
        <h2 className={`${fontClass} text-xl font-semibold text-ink`}>Visit or contact us</h2>
        <p className="mt-2 text-sm text-gray-600">{dealer.address}, {dealer.city}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {dealer.whatsapp && !preview && (
            <a href={`tel:${dealer.whatsapp.replace(/[^\d+]/g, "")}`} className="rounded-full border border-gray-300 px-5 py-2 text-sm">
              Call {dealer.whatsapp}
            </a>
          )}
          {dealer.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dealer.address}, ${dealer.city}`)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-gray-300 px-5 py-2 text-sm"
            >
              Get directions
            </a>
          )}
        </div>
      </section>

      {/* Powered-by footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        {preview ? (
          <span>Powered by TrustDrive India</span>
        ) : (
          <Link to="/" className="hover:underline">Powered by TrustDrive India — verified used cars</Link>
        )}
      </footer>
    </div>
  );
}
