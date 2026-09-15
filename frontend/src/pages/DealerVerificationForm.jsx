import { useState } from "react";
import DocumentUploadField from "../components/DocumentUploadField";

const POPULAR_CITIES = ["Hyderabad", "Secunderabad", "Bengaluru", "Mumbai", "Delhi NCR", "Chennai", "Pune"];

export default function DealerVerificationForm({ onSubmit, submitting, error, initialData = {} }) {
  const [form, setForm] = useState({
    businessName: initialData.businessName || "",
    city: initialData.city || "Hyderabad",
    address: initialData.address || "",
    whatsapp: initialData.whatsapp || initialData.phone || "",
    gstin: initialData.gstin || "",
    panNumber: initialData.panNumber || "",
    documents: { gst: null, pan: null },
    agreeTerms: true,
  });

  const [validationError, setValidationError] = useState("");

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setDoc = (key, doc) => setForm((f) => ({ ...f, documents: { ...f.documents, [key]: doc } }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError("");

    if (!form.businessName.trim()) {
      return setValidationError("Dealership / Business name is required.");
    }
    if (!form.city.trim()) {
      return setValidationError("City is required.");
    }
    if (!form.address.trim()) {
      return setValidationError("Dealership showroom address is required.");
    }
    if (!form.whatsapp.trim()) {
      return setValidationError("WhatsApp contact number is required.");
    }
    const cleanGst = form.gstin.trim().toUpperCase();
    if (!cleanGst || cleanGst.length < 15) {
      return setValidationError("Please enter a valid 15-character GSTIN (e.g. 36AAAAA0000A1Z5).");
    }
    if (!form.agreeTerms) {
      return setValidationError("Please confirm you are an authorized representative.");
    }

    const payload = {
      businessName: form.businessName.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      whatsapp: form.whatsapp.trim(),
      gstin: cleanGst,
      panNumber: form.panNumber.trim().toUpperCase(),
      documents: form.documents,
      ownerMobile: form.whatsapp.trim(),
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h2 className="text-sm font-bold text-emerald-950">Fast Dealer Onboarding</h2>
            <p className="mt-0.5 text-xs text-emerald-800 leading-relaxed">
              Fill in your basic dealership details and GST number to start listing verified vehicles immediately.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Dealership Profile */}
      <div className="rounded-2xl border hairline bg-white p-6 shadow-sm space-y-4">
        <h3 className="font-display text-base font-bold text-ink flex items-center gap-2 border-b hairline pb-3">
          <span>🏪</span>
          <span>Dealership Details</span>
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink">
              Dealership / Business Name <span className="text-danger">*</span>
            </label>
            <input
              required
              placeholder="e.g. Metro Auto Deals"
              value={form.businessName}
              onChange={(e) => set({ businessName: e.target.value })}
              className="focus-ring mt-1 w-full rounded-xl border hairline px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink">
              City <span className="text-danger">*</span>
            </label>
            <select
              value={form.city}
              onChange={(e) => set({ city: e.target.value })}
              className="focus-ring mt-1 w-full rounded-xl border hairline px-3.5 py-2.5 text-sm bg-white"
            >
              {POPULAR_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Other">Other City</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink">
              WhatsApp Contact Number <span className="text-danger">*</span>
            </label>
            <input
              required
              placeholder="e.g. +91 98765 43210"
              value={form.whatsapp}
              onChange={(e) => set({ whatsapp: e.target.value })}
              className="focus-ring mt-1 w-full rounded-xl border hairline px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink">
              Showroom / Lot Address <span className="text-danger">*</span>
            </label>
            <input
              required
              placeholder="e.g. Plot 45, Road No. 12, Banjara Hills"
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
              className="focus-ring mt-1 w-full rounded-xl border hairline px-3.5 py-2.5 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 2. Verification & Business Proof */}
      <div className="rounded-2xl border hairline bg-white p-6 shadow-sm space-y-4">
        <h3 className="font-display text-base font-bold text-ink flex items-center gap-2 border-b hairline pb-3">
          <span>📜</span>
          <span>Business Proof & Verification</span>
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-ink">
              GSTIN / GST Number <span className="text-danger">*</span>
            </label>
            <input
              required
              placeholder="15-digit GSTIN (e.g. 36AAAAA0000A1Z5)"
              value={form.gstin}
              onChange={(e) => set({ gstin: e.target.value.toUpperCase() })}
              maxLength={15}
              className="focus-ring mt-1 w-full rounded-xl border hairline px-3.5 py-2.5 font-mono text-sm uppercase"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink">Business PAN (Optional)</label>
            <input
              placeholder="10-digit PAN (e.g. ABCDE1234F)"
              value={form.panNumber}
              onChange={(e) => set({ panNumber: e.target.value.toUpperCase() })}
              maxLength={10}
              className="focus-ring mt-1 w-full rounded-xl border hairline px-3.5 py-2.5 font-mono text-sm uppercase"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink">
              Upload GST Certificate or Trade License (PDF / Image)
            </label>
            <div className="mt-1.5">
              <DocumentUploadField
                label="GST Registration Certificate or Shop Act License"
                accept="application/pdf,image/*"
                value={form.documents.gst}
                onChange={(doc) => setDoc("gst", doc)}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Used by admin team to verify authentic dealership credentials.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Confirmation & Submit */}
      <div className="rounded-2xl border hairline bg-white p-6 shadow-sm space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.agreeTerms}
            onChange={(e) => set({ agreeTerms: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          <span className="text-xs text-ink">
            I confirm that I am an authorized representative of this dealership and the GST details provided are accurate.
          </span>
        </label>

        {(validationError || error) && (
          <div className="rounded-xl bg-danger/10 border border-danger/20 p-3 text-xs font-semibold text-danger">
            {validationError || error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-paper shadow-md hover:bg-primary-light transition-all disabled:opacity-60"
        >
          {submitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper border-t-transparent"></span>
              <span>Registering Dealership…</span>
            </>
          ) : (
            <span>🚀 Complete Registration & Enter Dashboard</span>
          )}
        </button>
      </div>
    </form>
  );
}
