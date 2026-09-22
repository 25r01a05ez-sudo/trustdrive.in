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

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(d) {
  if (!d) return null;
  const diff = new Date(d) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
  inspectionVideoUrl: "",
  description: "",
  images: [],
};

export default function DealerDashboard() {
  const { getToken, user } = useAuth();
  const [tab, setTab] = useState("listings");
  const [vehicles, setVehicles] = useState([]);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [packages, setPackages] = useState(null);
  const [form, setForm] = useState(emptyVehicle);
  const [message, setMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [stickerVehicle, setStickerVehicle] = useState(null);
  const [dealerInfo, setDealerInfo] = useState(null);

  // Pay-to-activate modal state
  const [activatingVehicle, setActivatingVehicle] = useState(null);
  const [activatePayMethod, setActivatePayMethod] = useState("free_credit");
  const [activateCouponCode, setActivateCouponCode] = useState("");
  const [couponValidation, setCouponValidation] = useState(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [activating, setActivating] = useState(false);
  const INDIVIDUAL_PRICE = 1999;

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
    api.getPackages().then((d) => setPackages(d)).catch(() => {});
    if (user?.dealerId) {
      api.getDealer(user.dealerId, token).then((d) => setDealerInfo(d.dealer)).catch(() => {});
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
        panNumber: dealerData.panNumber,
        udyamNumber: dealerData.udyamNumber,
        gstNumber: dealerData.gstNumber || null,
        city: dealerData.city,
        address: dealerData.address,
        whatsapp: dealerData.whatsapp,
        verification: {
          ...dealerData,
          ownerName: dealerData.ownerName,
          ownerMobile: dealerData.whatsapp,
        },
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
        <h1 className="font-display text-3xl font-bold text-ink">Register Your Dealership</h1>
        <p className="mt-1 text-sm text-muted">
          Complete your showroom profile. Documents will be reviewed by the TrustDrive India team within 24–48 hours.
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
    if (!form.inspectionVideoUrl?.trim()) {
      setSubmitError("Inspection video URL is required.");
      setSubmitting(false);
      return;
    }
    try {
      const token = await getToken();
      await api.createVehicle(form, token);
      setForm(emptyVehicle);
      setMessage("Vehicle submitted for admin review. Once approved, you'll need to activate it.");
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

  // --- Credit & Listing Helpers ---
  const freeRemaining = dealerInfo ? dealerInfo.freeCreditsTotal - dealerInfo.freeCreditsUsed : 0;
  const packageRemaining = dealerInfo ? dealerInfo.packageCreditsTotal - dealerInfo.packageCreditsUsed : 0;
  const totalCredits = freeRemaining + packageRemaining;

  const handleValidateCoupon = async () => {
    if (!activateCouponCode.trim()) return;
    setCouponChecking(true);
    setCouponValidation(null);
    try {
      const token = await getToken();
      const res = await api.validateCoupon(activateCouponCode.trim(), token);
      setCouponValidation(res);
    } catch (err) {
      setCouponValidation({ valid: false, error: err.message });
    } finally {
      setCouponChecking(false);
    }
  };

  const handleActivateListing = async () => {
    if (!activatingVehicle) return;
    setActivating(true);
    try {
      const token = await getToken();
      await api.activateListing(
        activatingVehicle.id,
        {
          paymentMethod: activatePayMethod,
          couponCode: activatePayMethod === "paid_individual" ? activateCouponCode : undefined,
        },
        token
      );
      setActivatingVehicle(null);
      setActivateCouponCode("");
      setCouponValidation(null);
      setMessage(`✅ ${activatingVehicle.brand} ${activatingVehicle.model} is now LIVE on TrustDrive India!`);
      refresh();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setActivating(false);
    }
  };

  const handleRenewListing = async (v, payMethod) => {
    try {
      const token = await getToken();
      await api.renewListing(v.id, { paymentMethod: payMethod }, token);
      setMessage(`✅ ${v.brand} ${v.model} renewed for 3 more months!`);
      refresh();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const handlePurchasePackage = async (pkgName) => {
    try {
      const token = await getToken();
      const res = await api.purchasePackage({ packageName: pkgName }, token);
      setMessage(res.message);
      refresh();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Header */}
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

      {/* Verification status + Credits bar */}
      {dealerInfo && (
        <div className="mt-4 flex flex-wrap gap-3">
          {dealerInfo.verificationStatus === "verified" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Verified Dealer
            </span>
          ) : dealerInfo.verificationStatus === "rejected" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
              <span className="h-2 w-2 rounded-full bg-red-500"></span>
              Verification Rejected
              {dealerInfo.rejectionReason && (
                <span className="ml-1 font-normal">— {dealerInfo.rejectionReason}</span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
              Pending Admin Approval
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-800">
            🪙 {totalCredits} Credit{totalCredits !== 1 ? "s" : ""} Available
            <span className="font-normal text-blue-600">
              ({freeRemaining} free · {packageRemaining} package)
            </span>
          </span>
        </div>
      )}

      {message && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="text-xs font-semibold hover:underline">Dismiss</button>
        </div>
      )}
      {submitError && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          <span>{submitError}</span>
          <button onClick={() => setSubmitError("")} className="text-xs font-semibold hover:underline">Dismiss</button>
        </div>
      )}

      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {[
            ["Active (Live)", vehicles.filter((v) => v.listingStatus === "active").length],
            ["Pending Review", vehicles.filter((v) => v.listingStatus === "pending_review").length],
            ["Awaiting Payment", vehicles.filter((v) => v.listingStatus === "approved_payment_required").length],
            ["New Leads", stats.newLeads],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border hairline bg-white p-4 shadow-sm">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex gap-2 border-b hairline overflow-x-auto">
        {[
          { id: "listings", label: `My Vehicles (${vehicles.length})` },
          { id: "add", label: "+ Register New Vehicle" },
          { id: "leads", label: `Buyer Leads (${leads.length})` },
          { id: "packages", label: "🪙 Packages" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`focus-ring -mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
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
        <div className="mt-6 space-y-2">
          {vehicles.map((v) => {
            const days = daysUntil(v.listingExpiresAt);
            const isExpiringSoon = days !== null && days >= 0 && days <= 3;
            const isExpired = v.listingStatus === "expired";
            const isPaymentRequired = v.listingStatus === "approved_payment_required";
            const isLive = v.listingStatus === "active";

            return (
              <div
                key={v.id}
                className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${
                  isExpiringSoon ? "border-amber-300" : isExpired ? "border-red-200" : "hairline"
                }`}
              >
                {/* Expiry warning banner */}
                {isExpiringSoon && !isExpired && (
                  <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs font-semibold text-amber-800">
                    ⚠️ This listing expires in {days} day{days !== 1 ? "s" : ""} on {formatDate(v.listingExpiresAt)}. Renew now to keep it live.
                  </div>
                )}
                {isExpired && (
                  <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs font-semibold text-red-800">
                    🔴 This listing has expired and is no longer visible to buyers.
                  </div>
                )}
                {isPaymentRequired && (
                  <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-xs font-semibold text-blue-800">
                    ✅ Approved by admin! Activate this listing to make it live on TrustDrive India.
                  </div>
                )}

                <div className="flex items-center gap-4 p-4">
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border hairline bg-paper">
                    <VehicleImage vehicle={v} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink">
                      {v.brand} {v.model} <span className="text-xs text-muted font-normal">({v.year})</span>
                    </p>
                    <p className="text-xs text-muted mt-0.5">₹{formatINR(v.price)}</p>
                    {isLive && v.listingExpiresAt && (
                      <p className="text-[11px] text-muted mt-0.5">
                        Live until <strong>{formatDate(v.listingExpiresAt)}</strong>
                        {days !== null && <span className="ml-1">({days} days left)</span>}
                      </p>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {v.listingStatus === "pending_review" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Pending Review
                      </span>
                    ) : isPaymentRequired ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                        ✅ Activate to Go Live
                      </span>
                    ) : isLive ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        🟢 Live
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                        Expired
                      </span>
                    ) : v.approvalStatus === "Rejected" ? (
                      <div className="text-right">
                        <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                          ✕ Rejected
                        </span>
                        {v.rejectionReason && (
                          <p className="mt-0.5 text-[10px] text-danger max-w-xs text-right">{v.rejectionReason}</p>
                        )}
                      </div>
                    ) : v.status === "sold" ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Sold</span>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex gap-2 flex-wrap justify-end">
                    {isPaymentRequired && (
                      <button
                        type="button"
                        onClick={() => {
                          setActivatingVehicle(v);
                          setActivatePayMethod(freeRemaining > 0 ? "free_credit" : packageRemaining > 0 ? "package_credit" : "paid_individual");
                          setActivateCouponCode("");
                          setCouponValidation(null);
                        }}
                        className="focus-ring rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-paper hover:bg-primary-light"
                      >
                        💳 Activate Listing
                      </button>
                    )}
                    {(isExpired || (isLive && isExpiringSoon)) && (
                      <button
                        type="button"
                        onClick={() => handleRenewListing(v, freeRemaining > 0 ? "free_credit" : packageRemaining > 0 ? "package_credit" : "paid_individual")}
                        className="focus-ring rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
                      >
                        🔄 Renew
                      </button>
                    )}
                    {isLive && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleSpotlight(v)}
                          title="Boost to top of search results"
                          className={`focus-ring rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                            v.featured
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "border hairline hover:border-amber-400 text-muted hover:text-amber-700"
                          }`}
                        >
                          {v.featured ? "⭐ Spotlighted" : "⭐ Spotlight"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStickerVehicle(v)}
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
                    {!v.rcVerified && isLive && (
                      <button
                        onClick={() => runVerification(v.id)}
                        className="focus-ring rounded-full border hairline px-3 py-1 text-xs hover:border-primary hover:text-primary"
                      >
                        RC Check
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {vehicles.length === 0 && (
            <p className="rounded-2xl border hairline bg-white p-12 text-center text-muted text-sm">
              No vehicles registered yet. Click <strong>+ Register New Vehicle</strong> to submit your first car.
            </p>
          )}
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

      {/* TAB 4: PACKAGES */}
      {tab === "packages" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border hairline bg-white p-6 shadow-sm">
            <h3 className="font-display text-lg font-bold text-ink">🪙 Listing Credits &amp; Packages</h3>
            <p className="mt-1 text-sm text-muted">
              Each approved vehicle needs 1 credit to go live. Your first 5 listings are free.
              After that, purchase a package or pay ₹1,999 per listing.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { name: "basic", label: "Basic", credits: 10, price: 19000, color: "blue" },
                { name: "growth", label: "Growth", credits: 20, price: 39000, color: "violet" },
                { name: "pro", label: "Pro", credits: 50, price: 99000, color: "amber" },
              ].map((pkg) => (
                <div key={pkg.name} className="rounded-2xl border-2 border-slate-200 p-5 space-y-3 hover:border-primary transition-colors">
                  <p className="font-bold text-ink">{pkg.label} Package</p>
                  <p className="text-3xl font-display font-bold text-ink">{pkg.credits} <span className="text-base font-normal text-muted">credits</span></p>
                  <p className="text-sm text-muted">₹{formatINR(pkg.price)}</p>
                  <p className="text-xs text-muted">₹{formatINR(Math.round(pkg.price / pkg.credits))} / listing</p>
                  <button
                    type="button"
                    onClick={() => handlePurchasePackage(pkg.name)}
                    className="focus-ring w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-paper hover:bg-primary-light"
                  >
                    Buy Package
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pay-to-Activate Modal */}
      {activatingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-ink">Activate Listing</h2>
              <button
                onClick={() => setActivatingVehicle(null)}
                className="text-muted hover:text-ink text-xl"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-muted">
              <strong className="text-ink">{activatingVehicle.brand} {activatingVehicle.model}</strong> is approved.
              Choose how to activate it:
            </p>

            {/* Payment method */}
            <div className="space-y-2">
              {freeRemaining > 0 && (
                <label className="flex items-center gap-3 cursor-pointer rounded-xl border hairline p-3 hover:border-primary">
                  <input
                    type="radio"
                    name="payMethod"
                    value="free_credit"
                    checked={activatePayMethod === "free_credit"}
                    onChange={() => setActivatePayMethod("free_credit")}
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink">Use 1 Free Credit</p>
                    <p className="text-xs text-muted">{freeRemaining} free credits remaining</p>
                  </div>
                </label>
              )}
              {packageRemaining > 0 && (
                <label className="flex items-center gap-3 cursor-pointer rounded-xl border hairline p-3 hover:border-primary">
                  <input
                    type="radio"
                    name="payMethod"
                    value="package_credit"
                    checked={activatePayMethod === "package_credit"}
                    onChange={() => setActivatePayMethod("package_credit")}
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink">Use 1 Package Credit</p>
                    <p className="text-xs text-muted">{packageRemaining} package credits remaining</p>
                  </div>
                </label>
              )}
              <label className="flex items-center gap-3 cursor-pointer rounded-xl border hairline p-3 hover:border-primary">
                <input
                  type="radio"
                  name="payMethod"
                  value="paid_individual"
                  checked={activatePayMethod === "paid_individual"}
                  onChange={() => setActivatePayMethod("paid_individual")}
                />
                <div>
                  <p className="text-sm font-semibold text-ink">Pay ₹{formatINR(INDIVIDUAL_PRICE)}</p>
                  <p className="text-xs text-muted">One-time payment for this listing</p>
                </div>
              </label>
            </div>

            {/* Coupon (only for paid_individual) */}
            {activatePayMethod === "paid_individual" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink">Dealer Discount Coupon (optional)</label>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Dealer Exclusive
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter dealer coupon code (e.g. DEALER20)"
                    value={activateCouponCode}
                    onChange={(e) => {
                      setActivateCouponCode(e.target.value.toUpperCase());
                      setCouponValidation(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleValidateCoupon();
                      }
                    }}
                    className="focus-ring flex-1 rounded-xl border hairline px-3 py-2 text-sm font-mono uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleValidateCoupon}
                    disabled={couponChecking || !activateCouponCode.trim()}
                    className="focus-ring rounded-xl border hairline px-3 py-2 text-xs font-semibold hover:border-primary disabled:opacity-50"
                  >
                    {couponChecking ? "Checking…" : "Apply"}
                  </button>
                </div>
                {couponValidation && (
                  <div className={`rounded-xl p-3 text-xs font-semibold ${
                    couponValidation.valid
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}>
                    {couponValidation.valid
                      ? `✓ Coupon applied! Pay ₹${formatINR(couponValidation.finalPrice)} (saved ₹${formatINR(couponValidation.discount)})`
                      : `✕ ${couponValidation.error}`
                    }
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={activating}
              onClick={handleActivateListing}
              className="focus-ring w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-paper shadow-md hover:bg-primary-light disabled:opacity-60"
            >
              {activating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper border-t-transparent"></span>
                  Activating…
                </span>
              ) : (
                activatePayMethod === "paid_individual"
                  ? `Pay & Activate → ₹${formatINR(couponValidation?.valid ? couponValidation.finalPrice : INDIVIDUAL_PRICE)}`
                  : "Activate Listing →"
              )}
            </button>
          </div>
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
