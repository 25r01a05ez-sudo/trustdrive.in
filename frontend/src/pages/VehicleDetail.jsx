import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../lib/useWishlist";
import VerifiedStamp from "../components/VerifiedStamp";
import VehicleCard from "../components/VehicleCard";
import VehicleImage from "../components/VehicleImage";
import WindowStickerModal from "../components/WindowStickerModal";

import { formatINR } from "../lib/formatters";

export default function VehicleDetail() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [dealer, setDealer] = useState(null);
  const [recs, setRecs] = useState([]);
  const [form, setForm] = useState({ buyerName: "", buyerPhone: "", channel: "whatsapp" });
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [waLink, setWaLink] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [showSticker, setShowSticker] = useState(false);
  const { getToken, user } = useAuth();
  const { isSaved, toggleWishlist } = useWishlist();

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const d = await api.getVehicle(id, token);
      setVehicle(d.vehicle);
      setDealer(d.dealer);
    })();
    api.recommendations(id).then((d) => setRecs(d.recommendations)).catch(() => {});
  }, [id]);

  const submitLead = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const { whatsappLink } = await api.createLead({ vehicleId: id, ...form });
      setStatus("sent");
      setWaLink(whatsappLink);
    } catch {
      setStatus("error");
    }
  };

  if (!vehicle) return <div className="mx-auto max-w-6xl px-6 py-24 text-center text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link to="/listings" className="focus-ring text-sm text-muted hover:text-primary">← Back to listings</Link>

      <div className="mt-4 grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="h-64 overflow-hidden rounded-2xl border hairline md:h-96">
            <VehicleImage
              vehicle={{ ...vehicle, images: vehicle.images?.length ? [vehicle.images[activePhoto]] : [] }}
            />
          </div>
          {vehicle.images?.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {vehicle.images.map((img, i) => (
                <button
                  key={img.slice(-24) + i}
                  onClick={() => setActivePhoto(i)}
                  className={`focus-ring h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    activePhoto === i ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img src={img} alt={`${vehicle.brand} ${vehicle.model} photo ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {vehicle.featured && (
                  <span className="rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-bold text-white shadow-sm flex items-center gap-1">
                    <span>⭐</span>
                    <span>Spotlight Featured Listing</span>
                  </span>
                )}
                {vehicle.owners === 1 && (
                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-semibold">
                    👤 Single Owner (1st Owner)
                  </span>
                )}
                {Number(vehicle.km) < 30000 && (
                  <span className="rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs font-semibold">
                    ⚡ Low Mileage (&lt; 30,000 km)
                  </span>
                )}
                {vehicle.rcVerified && (
                  <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                    🛡️ VAHAN RC Verified
                  </span>
                )}
                {dealer?.city && (
                  <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-medium">
                    📍 {dealer.address ? `${dealer.address.split(",")[0]}, ` : ""}{dealer.city}
                  </span>
                )}
              </div>
              <h1 className="font-display text-3xl font-bold text-ink">{vehicle.brand} {vehicle.model}</h1>
              <p className="mt-1 text-sm text-muted">{vehicle.year} · {formatINR(vehicle.km)} km · {vehicle.fuel} · {vehicle.transmission}</p>
            </div>
            <div className="text-right">
              <p className="whitespace-nowrap font-mono text-3xl font-bold text-primary">₹{formatINR(vehicle.price)}</p>
              <p className="text-[11px] text-muted font-mono mt-0.5">Estimated EMI: ~₹{formatINR(Math.round((vehicle.price * 0.8 * 0.09) / 12 + (vehicle.price * 0.8) / 60))}/mo</p>
              
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => toggleWishlist(vehicle.id)}
                  className={`focus-ring inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                    isSaved(vehicle.id)
                      ? "bg-rose-50 border border-rose-200 text-rose-700"
                      : "bg-white border hairline text-slate-700 hover:border-rose-300"
                  }`}
                >
                  <span>{isSaved(vehicle.id) ? "❤️" : "🤍"}</span>
                  <span>{isSaved(vehicle.id) ? "Saved" : "Save Car"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSticker(true)}
                  className="focus-ring inline-flex items-center gap-1 rounded-full border hairline bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-primary hover:text-primary transition-all"
                >
                  <span>🖨️</span>
                  <span>Print Sticker</span>
                </button>
              </div>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-700 bg-slate-50/60 p-4 rounded-xl border hairline">{vehicle.description}</p>

          {/* Document verification card */}
          <div className="mt-8 rounded-2xl border hairline bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">Document verification</h2>
              {vehicle.rcVerified ? (
                <span className="flex items-center gap-2 text-sm font-medium text-primary">
                  <VerifiedStamp size="sm" /> Cross-checked with VAHAN
                </span>
              ) : (
                <span className="text-sm font-medium text-gold-dark">Verification in progress</span>
              )}
            </div>
            <dl className="mt-4 grid gap-3 font-mono text-xs sm:grid-cols-2">
              <div className="flex justify-between rounded-lg bg-paper px-3 py-2">
                <dt className="text-muted">Registration No.</dt>
                <dd className="text-ink">
                  {vehicle.registrationNumber ? (
                    <span className="flex items-center gap-1">
                      {vehicle.isMasked && <span className="text-[10px] text-emerald-700">🔒</span>}
                      {vehicle.registrationNumber}
                    </span>
                  ) : (
                    <span className="text-muted">🔒 Encrypted / Verified</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between rounded-lg bg-paper px-3 py-2">
                <dt className="text-muted">Chassis No. (VIN)</dt>
                <dd className="text-ink">
                  {vehicle.chassisNumber ? (
                    <span className="flex items-center gap-1">
                      {vehicle.isMasked && <span className="text-[10px] text-emerald-700">🔒</span>}
                      {vehicle.chassisNumber}
                    </span>
                  ) : (
                    <span className="text-muted">🔒 Encrypted / Verified</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between rounded-lg bg-paper px-3 py-2"><dt className="text-muted">Owners</dt><dd className="text-ink">{vehicle.owners}</dd></div>
              <div className="flex justify-between rounded-lg bg-paper px-3 py-2"><dt className="text-muted">Listed</dt><dd className="text-ink">{new Date(vehicle.listedAt).toLocaleDateString("en-IN")}</dd></div>
            </dl>

            {vehicle.verificationDetails?.fields && (
              <div className="mt-4 border-t hairline pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">VAHAN registry record</p>
                <dl className="mt-3 grid gap-2.5 font-mono text-xs sm:grid-cols-2">
                  {[
                    ["Registration status", vehicle.verificationDetails.fields.registrationStatus],
                    ["Make / model", vehicle.verificationDetails.fields.makeModel],
                    ["Registration date", vehicle.verificationDetails.fields.registrationDate],
                    ["Engine number", vehicle.verificationDetails.fields.engineNumber],
                    ["Fuel type", vehicle.verificationDetails.fields.fuelType],
                    ["Financier / hypothecation", vehicle.verificationDetails.fields.financier],
                    ["Insurance", vehicle.verificationDetails.fields.insurance
                      ? `${vehicle.verificationDetails.fields.insurance.status}${vehicle.verificationDetails.fields.insurance.validTill ? ` — valid till ${vehicle.verificationDetails.fields.insurance.validTill}` : ""}`
                      : null],
                    ["PUC", vehicle.verificationDetails.fields.puc
                      ? `${vehicle.verificationDetails.fields.puc.status}${vehicle.verificationDetails.fields.puc.validTill ? ` — valid till ${vehicle.verificationDetails.fields.puc.validTill}` : ""}`
                      : null],
                    ["RTO", vehicle.verificationDetails.fields.rto],
                  ]
                    .filter(([, val]) => val)
                    .map(([label, val]) => (
                      <div key={label} className="flex justify-between gap-3 rounded-lg bg-primary/5 px-3 py-2">
                        <dt className="text-muted">{label}</dt>
                        <dd className="text-right text-ink">{val}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}
          </div>

          {/* Dealer card */}
          {dealer && (
            <div className="mt-6 rounded-2xl border hairline bg-white p-6">
              <div className="flex items-center gap-3">
                {dealer.verificationStatus === "verified" && <VerifiedStamp size="sm" />}
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">{dealer.name}</h2>
                  <p className="text-xs text-muted">{dealer.address}, {dealer.city}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="font-mono text-sm text-ink">★ {dealer.rating || "—"}</p>
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
          )}
        </div>

        {/* Contact / lead form */}
        <aside className="h-fit rounded-2xl border hairline bg-white p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-ink">Contact Dealer</h2>
          <p className="mt-1 text-xs text-muted">
            Directly connect with {dealer?.name || "the seller"} without middlemen.
          </p>

          {/* Direct One-Click WhatsApp Action */}
          {dealer?.whatsapp && (
            <div className="mt-4 pb-4 border-b hairline">
              <a
                href={`https://wa.me/${dealer.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                  `Hi ${dealer.name || "Dealer"}, I found your ${vehicle?.year} ${vehicle?.brand} ${vehicle?.model} (₹${formatINR(
                    vehicle?.price
                  )}) on TrustDrive (${window.location.href}). Is it still available for a test drive?`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-all"
              >
                <span>💬</span>
                <span>Chat Instantly on WhatsApp</span>
              </a>
              <p className="mt-1.5 text-center text-[11px] text-muted">Usually responds within a few minutes</p>
            </div>
          )}

          {status === "sent" ? (
            <div className="mt-5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
              <p className="font-semibold">✓ Enquiry submitted successfully!</p>
              <p className="mt-1 text-xs">The dealer has received your contact details and will get in touch shortly.</p>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring mt-3 inline-block rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Continue on WhatsApp →
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={submitLead} className="mt-4 space-y-3">
              <p className="text-xs font-semibold text-ink">Or request a callback:</p>
              <input
                required
                placeholder="Your name"
                value={form.buyerName}
                onChange={(e) => setForm((f) => ({ ...f, buyerName: e.target.value }))}
                className="focus-ring w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Your phone number"
                value={form.buyerPhone}
                onChange={(e) => setForm((f) => ({ ...f, buyerPhone: e.target.value }))}
                className="focus-ring w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
              <select
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                className="focus-ring w-full rounded-lg border hairline px-3 py-2 text-sm bg-white"
              >
                <option value="whatsapp">Prefer WhatsApp</option>
                <option value="call">Prefer Phone Call</option>
                <option value="email">Prefer Email</option>
              </select>
              <button
                disabled={status === "sending"}
                className="focus-ring w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-paper hover:bg-primary-light disabled:opacity-60 transition-colors shadow-sm"
              >
                {status === "sending" ? "Submitting…" : "Request Callback"}
              </button>
              {status === "error" && <p className="text-xs text-danger">Something went wrong — try again.</p>}
            </form>
          )}
        </aside>
      </div>

      {recs.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl font-semibold text-ink">Similar cars</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recs.map((v) => <VehicleCard key={v.id} vehicle={{ ...v, dealer }} />)}
          </div>
        </section>
      )}

      {showSticker && (
        <WindowStickerModal
          vehicle={vehicle}
          dealer={dealer}
          onClose={() => setShowSticker(false)}
        />
      )}
    </div>
  );
}
