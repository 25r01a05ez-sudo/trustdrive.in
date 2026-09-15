import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import VerifiedStamp from "../components/VerifiedStamp";
import VehicleImage from "../components/VehicleImage";
import WindowStickerModal from "../components/WindowStickerModal";
import DealerVerificationForm from "./DealerVerificationForm";
import { resizeImageFile } from "../lib/imageResize";

function formatINR(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0);
}

const emptyVehicle = {
  brand: "",
  model: "",
  year: "",
  price: "",
  km: "",
  fuel: "Petrol",
  transmission: "Manual",
  owners: 1,
  chassisNumber: "",
  registrationNumber: "",
  description: "",
  images: [],
};

export default function DealerDashboard() {
  const { getToken, user } = useAuth();
  const [tab, setTab] = useState("listings");
  const [vehicles, setVehicles] = useState([]);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(emptyVehicle);
  const [message, setMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [stickerVehicle, setStickerVehicle] = useState(null);
  const [dealerInfo, setDealerInfo] = useState(null);

  const toggleSpotlight = async (v) => {
    try {
      const token = await getToken();
      const res = await api.toggleFeatureVehicle(v.id, !v.featured, token);
      setVehicles((list) =>
        list.map((item) => (item.id === v.id ? { ...item, featured: res.featured } : item))
      );
      setMessage(
        res.featured
          ? `⭐ Spotlight activated for ${v.brand} ${v.model}! Ranked at top of search.`
          : `Spotlight removed for ${v.brand} ${v.model}.`
      );
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const handleGenerateDescription = async () => {
    if (!form.brand || !form.model) {
      setSubmitError("Please enter Brand and Model first before generating description.");
      return;
    }
    setSubmitError("");
    setGeneratingDesc(true);
    try {
      const token = await getToken();
      const res = await api.generateVehicleDescription(form, token);
      if (res.description) {
        setForm((f) => ({ ...f, description: res.description }));
      }
    } catch (err) {
      setSubmitError(err.message || "Failed to generate AI description.");
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 12 - form.images.length);
    if (!files.length) return;
    setUploading(true);
    setPhotoError("");
    try {
      const results = await Promise.allSettled(files.map((f) => resizeImageFile(f)));
      const succeeded = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      const failed = results.filter((r) => r.status === "rejected");

      if (succeeded.length) {
        setForm((f) => ({ ...f, images: [...f.images, ...succeeded] }));
      }
      if (failed.length) {
        const reasons = [...new Set(failed.map((r) => r.reason?.message || "Unknown error"))];
        setPhotoError(
          `${failed.length} of ${files.length} photo${files.length > 1 ? "s" : ""} couldn't be added: ${reasons.join("; ")}`
        );
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (idx) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const refresh = async () => {
    const token = await getToken();
    api.getMyVehicles(token).then((d) => setVehicles(d.vehicles || []));
    api.listLeads(token).then((d) => setLeads(d.leads || []));
    api.dealerAnalytics(token).then(setStats).catch(() => {});
    if (user?.dealerId) {
      api.getDealer(user.dealerId).then((d) => setDealerInfo(d.dealer)).catch(() => {});
    }
  };

  useEffect(() => {
    if (user?.dealerId) refresh();
  }, [user]);

  const handleRegisterDealerOnboard = async (dealerData) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const token = await getToken();
      const payload = {
        name: dealerData.businessName,
        gstNumber: dealerData.gstin,
        city: dealerData.city,
        address: dealerData.address,
        whatsapp: dealerData.whatsapp,
        verification: dealerData,
      };
      await api.registerDealer(payload, token);
      window.location.reload();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user?.dealerId) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-display text-3xl font-bold text-ink">Register Dealership</h1>
        <p className="mt-1 text-sm text-muted">
          Complete your showroom profile in under 1 minute to start listing inventory.
        </p>
        <div className="mt-6">
          <DealerVerificationForm
            onSubmit={handleRegisterDealerOnboard}
            submitting={submitting}
            error={submitError}
            initialData={{ businessName: user?.name, whatsapp: user?.phone }}
          />
        </div>
      </div>
    );
  }

  const addVehicle = async (e) => {
    e.preventDefault();
    setMessage("");
    setSubmitError("");
    setSubmitting(true);
    try {
      const token = await getToken();
      await api.createVehicle(form, token);
      setForm(emptyVehicle);
      setMessage("Vehicle registered successfully! It is now Pending Admin Approval before going live to buyers.");
      setTab("listings");
      refresh();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const runVerification = async (id) => {
    const token = await getToken();
    await api.verifyVehicle(id, token);
    refresh();
  };

  const markSold = async (id) => {
    const token = await getToken();
    await api.updateVehicle(id, { status: "sold" }, token);
    refresh();
  };

  const updateLeadStatus = async (id, status) => {
    const token = await getToken();
    await api.updateLead(id, { status }, token);
    refresh();
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Dealer Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your inventory, submit vehicles for admin approval, and track buyer leads.
          </p>
        </div>
        <Link
          to="/dealer/website"
          className="focus-ring rounded-full border hairline px-4 py-2 text-sm font-medium text-ink hover:border-primary hover:text-primary"
        >
          Build my website →
        </Link>
      </div>

      {message && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {[
            ["Active (Approved)", stats.activeListings],
            ["New Leads", stats.newLeads],
            ["Total Leads", stats.totalLeads],
            ["Inventory Value", `₹${formatINR(stats.inventoryValue)}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border hairline bg-white p-4 shadow-sm">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex gap-2 border-b hairline">
        {[
          { id: "listings", label: `My Vehicles (${vehicles.length})` },
          { id: "add", label: "+ Register New Vehicle" },
          { id: "leads", label: `Buyer Leads (${leads.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`focus-ring -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: VEHICLE LISTINGS */}
      {tab === "listings" && (
        <div className="mt-6 overflow-x-auto rounded-2xl border hairline bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b hairline bg-paper/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Registration (Masked)</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Approval Status</th>
                <th className="px-4 py-3">VAHAN Check</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b hairline last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="h-10 w-14 overflow-hidden rounded-md border hairline bg-paper">
                      <VehicleImage vehicle={v} />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">
                    {v.brand} {v.model} <span className="text-xs text-muted">({v.year})</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    <div className="flex items-center gap-1.5" title="Full registration number is encrypted and accessible only by admins">
                      <span className="text-[11px] text-emerald-700">🔒</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-ink">
                        {v.registrationNumber || "••••••••"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">₹{formatINR(v.price)}</td>
                  <td className="px-4 py-3">
                    {v.approvalStatus === "Pending Admin Approval" || v.status === "pending" ? (
                      <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          Pending Admin Approval
                        </span>
                        <p className="mt-0.5 text-[10px] text-muted">Awaiting admin review</p>
                      </div>
                    ) : v.approvalStatus === "Rejected" || v.status === "rejected" ? (
                      <div>
                        <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                          ✕ Rejected
                        </span>
                        {v.rejectionReason && (
                          <p className="mt-0.5 text-[10px] text-danger max-w-xs">
                            Reason: {v.rejectionReason}
                          </p>
                        )}
                      </div>
                    ) : v.status === "sold" ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        Sold
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        ✓ Approved (Live)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {v.rcVerified ? (
                      <VerifiedStamp size="sm" />
                    ) : (
                      <span className="text-xs text-gold-dark">
                        {v.verificationStatus === "declined" ? "Declined" : "Not verified"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {!v.rcVerified && (
                      <button
                        onClick={() => runVerification(v.id)}
                        className="focus-ring rounded-full border hairline px-3 py-1 text-xs hover:border-primary hover:text-primary"
                      >
                        RC Check
                      </button>
                    )}
                    {v.status === "active" && v.approvalStatus === "Approved" && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleSpotlight(v)}
                          title="Boost to top of search results"
                          className={`focus-ring rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                            v.featured
                              ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-sm"
                              : "border hairline hover:border-amber-400 text-muted hover:text-amber-700"
                          }`}
                        >
                          {v.featured ? "⭐ Spotlighted" : "⭐ Spotlight"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStickerVehicle(v)}
                          title="Print A4 showroom window sticker with QR code"
                          className="focus-ring rounded-full border hairline px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                        >
                          🖨️ Sticker
                        </button>
                        <button
                          type="button"
                          onClick={() => markSold(v.id)}
                          className="focus-ring rounded-full border hairline px-2.5 py-1 text-xs hover:border-primary hover:text-primary"
                        >
                          Mark sold
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    No vehicles registered yet. Click <strong>+ Register New Vehicle</strong> to submit your first car.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: REGISTER VEHICLE FORM */}
      {tab === "add" && (
        <form onSubmit={addVehicle} className="mt-6 max-w-2xl space-y-4 rounded-2xl border hairline bg-white p-6 shadow-sm">
          {/* Security Notice */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-start gap-2.5">
              <span className="text-lg">🔒</span>
              <div className="text-xs text-emerald-900 leading-relaxed">
                <strong className="font-semibold">Privacy & Approval Policy:</strong>
                <p className="mt-0.5">
                  When you register a vehicle, it is submitted with status{" "}
                  <strong className="underline">Pending Admin Approval</strong>. Complete Registration Numbers and
                  Chassis/VIN Numbers are strictly encrypted and accessible only to platform administrators for verification.
                  Sensitive identifiers will never be visible to buyers, other dealers, or non-admin users.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink">Brand</label>
              <input
                required
                placeholder="e.g. Maruti Suzuki, Hyundai"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink">Model & Variant</label>
              <input
                required
                placeholder="e.g. Swift VXI, Creta SX"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink">Manufacturing Year</label>
              <input
                required
                type="number"
                min="1990"
                max={new Date().getFullYear() + 1}
                placeholder="e.g. 2021"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink">Selling Price (₹)</label>
              <input
                required
                type="number"
                min="10000"
                placeholder="e.g. 650000"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink">Kilometers Driven</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 28000"
                value={form.km}
                onChange={(e) => setForm((f) => ({ ...f, km: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink">Number of Owners</label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.owners}
                onChange={(e) => setForm((f) => ({ ...f, owners: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink">Fuel Type</label>
              <select
                value={form.fuel}
                onChange={(e) => setForm((f) => ({ ...f, fuel: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              >
                <option>Petrol</option>
                <option>Diesel</option>
                <option>CNG</option>
                <option>Electric</option>
                <option>Hybrid</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink">Transmission</label>
              <select
                value={form.transmission}
                onChange={(e) => setForm((f) => ({ ...f, transmission: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              >
                <option>Manual</option>
                <option>Automatic</option>
                <option>CVT</option>
              </select>
            </div>

            {/* SENSITIVE FIELDS */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-ink flex items-center gap-1">
                  <span>🔒</span> Vehicle Registration Number
                </label>
                <span className="text-[11px] text-muted">Admin-restricted after submission</span>
              </div>
              <input
                required
                placeholder="e.g. TS09EA1234, DL01AB1234"
                value={form.registrationNumber}
                onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm font-mono uppercase"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-ink flex items-center gap-1">
                  <span>🔒</span> Chassis Number (VIN)
                </label>
                <span className="text-[11px] text-muted">Admin-restricted after submission</span>
              </div>
              <input
                required
                placeholder="e.g. MA3ERLF1SXXXXXXXX"
                value={form.chassisNumber}
                onChange={(e) => setForm((f) => ({ ...f, chassisNumber: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink">Listing Description</label>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={generatingDesc || !form.brand || !form.model}
                className="text-xs font-semibold text-primary hover:text-primary-light disabled:opacity-40 transition-colors flex items-center gap-1 bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/20"
              >
                {generatingDesc ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent"></span>
                    <span>Writing with AI…</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Generate Description with AI</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              placeholder="Key condition highlights, service history, accessory details (or click 'Generate Description with AI')..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-ink">Vehicle Photos (up to 12)</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {form.images.map((img, i) => (
                <div key={img.slice(-24) + i} className="relative h-20 w-28 overflow-hidden rounded-lg border hairline shadow-sm">
                  <img src={img} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="focus-ring absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-xs text-paper hover:bg-danger"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              {form.images.length < 12 && (
                <label className="focus-ring flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed hairline text-xs text-muted hover:border-primary hover:text-primary">
                  {uploading ? "Uploading…" : "+ Add Photo"}
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                </label>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted">Photos are automatically optimized before uploading.</p>
            {photoError && <p className="mt-1.5 text-xs font-medium text-danger">{photoError}</p>}
          </div>

          {submitError && <p className="text-sm font-medium text-danger">{submitError}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="focus-ring w-full sm:w-auto rounded-full bg-primary px-8 py-2.5 text-sm font-medium text-paper hover:bg-primary-light disabled:opacity-60"
            >
              {submitting ? "Submitting for Approval..." : "Submit Vehicle for Admin Approval"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: LEADS */}
      {tab === "leads" && (
        <div className="mt-6 space-y-3">
          {leads.length === 0 && (
            <p className="rounded-xl border hairline bg-white p-8 text-center text-sm text-muted">
              No buyer enquiries yet.
            </p>
          )}
          {leads.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-xl border hairline bg-white p-4 shadow-sm">
              <div>
                <p className="text-sm font-medium text-ink">
                  {l.buyerName} <span className="text-muted">· {l.buyerPhone}</span>
                </p>
                <p className="text-xs text-muted">
                  {l.vehicle?.brand} {l.vehicle?.model} · via {l.channel} · {new Date(l.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <select
                value={l.status}
                onChange={(e) => updateLeadStatus(l.id, e.target.value)}
                className="focus-ring rounded-full border hairline px-3 py-1 text-xs capitalize"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {stickerVehicle && (
        <WindowStickerModal
          vehicle={stickerVehicle}
          dealer={dealerInfo}
          onClose={() => setStickerVehicle(null)}
        />
      )}
    </div>
  );
}
