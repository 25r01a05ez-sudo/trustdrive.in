import { useState } from "react";
import DocumentUploadField from "../components/DocumentUploadField";

const POPULAR_CITIES = ["Hyderabad", "Secunderabad", "Bengaluru", "Mumbai", "Delhi NCR", "Chennai", "Pune"];

export default function DealerVerificationForm({ onSubmit, submitting, error, initialData = {} }) {
  const [form, setForm] = useState({
    // Basic info
    businessName: initialData.businessName || "",
    ownerName: initialData.ownerName || "",
    city: initialData.city || "Hyderabad",
    address: initialData.address || "",
    whatsapp: initialData.whatsapp || initialData.phone || "",

    // Mandatory KYC
    panNumber: initialData.panNumber || "",
    udyamNumber: initialData.udyamNumber || "",

    // Optional
    gstin: initialData.gstin || "",

    // Document files
    documents: {
      pan: null,      // mandatory
      udyam: null,    // mandatory
      gst: null,      // optional
    },

    agreeTerms: false,
  });

  const [validationError, setValidationError] = useState("");

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setDoc = (key, doc) => setForm((f) => ({ ...f, documents: { ...f.documents, [key]: doc } }));

  const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError("");

    if (!form.businessName.trim()) {
      return setValidationError("Dealership / Business name is required.");
    }
    if (!form.ownerName.trim()) {
      return setValidationError("Dealer full name is required.");
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

    // PAN Validation
    const cleanPan = form.panNumber.trim().toUpperCase();
    if (!cleanPan) {
      return setValidationError("PAN Card number is required.");
    }
    if (!PAN_REGEX.test(cleanPan)) {
      return setValidationError("Invalid PAN number format. Should be like ABCDE1234F.");
    }
    if (!form.documents.pan) {
      return setValidationError("Please upload a copy of your PAN Card.");
    }

    // Udyam Validation
    const cleanUdyam = form.udyamNumber.trim().toUpperCase();
    if (!cleanUdyam) {
      return setValidationError("Udyam Registration Certificate number is required.");
    }
    if (!UDYAM_REGEX.test(cleanUdyam)) {
      return setValidationError("Invalid Udyam number format. Should be like UDYAM-TG-01-0000001.");
    }
    if (!form.documents.udyam) {
      return setValidationError("Please upload your Udyam Registration Certificate.");
    }

    // GST validation — only if provided
    const cleanGst = form.gstin.trim().toUpperCase();
    if (cleanGst && cleanGst.length !== 15) {
      return setValidationError("If entering GSTIN, it must be exactly 15 characters (e.g. 36AAAAA0000A1Z5).");
    }

    if (!form.agreeTerms) {
      return setValidationError("Please confirm you are an authorized representative of this dealership.");
    }

    const payload = {
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      whatsapp: form.whatsapp.trim(),
      panNumber: cleanPan,
      udyamNumber: cleanUdyam,
      gstNumber: cleanGst || null,
      documents: form.documents,
      ownerMobile: form.whatsapp.trim(),
      // Also embed in verification blob for admin docs viewer
      panDoc: form.documents.pan,
      udyamDoc: form.documents.udyam,
      gstDoc: form.documents.gst || null,
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🏅</span>
          <div>
            <h2 className="text-sm font-bold text-amber-950">Verified Dealer Onboarding</h2>
            <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
              Your documents will be reviewed by our team before your account is activated. PAN Card
              and Udyam Certificate are mandatory. GST is optional.
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

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink">
              Dealer / Owner Full Name <span className="text-danger">*</span>
            </label>
            <input
              required
              placeholder="e.g. Rajesh Kumar"
              value={form.ownerName}
              onChange={(e) => set({ ownerName: e.target.value })}
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

      {/* 2. Mandatory KYC Documents */}
      <div className="rounded-2xl border hairline bg-white p-6 shadow-sm space-y-5">
        <h3 className="font-display text-base font-bold text-ink flex items-center gap-2 border-b hairline pb-3">
          <span>📋</span>
          <span>Mandatory KYC Documents</span>
        </h3>

        {/* PAN Card */}
        <div className="space-y-3 rounded-xl bg-slate-50 border hairline p-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🪪</span>
            <div>
              <p className="text-xs font-bold text-ink">PAN Card <span className="text-danger">*</span></p>
              <p className="text-[11px] text-muted">Required for identity and tax verification</p>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink">PAN Number</label>
            <input
              required
              placeholder="e.g. ABCDE1234F"
              value={form.panNumber}
              onChange={(e) => set({ panNumber: e.target.value.toUpperCase() })}
              maxLength={10}
              className="focus-ring mt-1 w-full rounded-xl border hairline px-3.5 py-2.5 font-mono text-sm uppercase"
            />
            <p className="mt-1 text-[11px] text-muted">Format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)</p>
          </div>
          <DocumentUploadField
            label="Upload PAN Card (front side)"
            required
            value={form.documents.pan}
            onChange={(doc) => setDoc("pan", doc)}
            exampleName="PAN_scan.jpg"
            exampleSize="under 5MB"
          />
        </div>

        {/* Udyam Certificate */}
        <div className="space-y-3 rounded-xl bg-slate-50 border hairline p-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🏭</span>
            <div>
              <p className="text-xs font-bold text-ink">Udyam Registration Certificate (MSME) <span className="text-danger">*</span></p>
              <p className="text-[11px] text-muted">Required to confirm registered MSME business status</p>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink">Udyam Registration Number</label>
            <input
              required
              placeholder="e.g. UDYAM-TG-01-0000001"
              value={form.udyamNumber}
              onChange={(e) => set({ udyamNumber: e.target.value.toUpperCase() })}
              className="focus-ring mt-1 w-full rounded-xl border hairline px-3.5 py-2.5 font-mono text-sm uppercase"
            />
            <p className="mt-1 text-[11px] text-muted">Format: UDYAM-XX-00-0000000</p>
          </div>
          <DocumentUploadField
            label="Upload Udyam Certificate"
            required
            value={form.documents.udyam}
            onChange={(doc) => setDoc("udyam", doc)}
            exampleName="Udyam_Certificate.pdf"
            exampleSize="under 5MB"
          />
        </div>
      </div>

      {/* 3. Optional GST */}
      <div className="rounded-2xl border hairline bg-white p-6 shadow-sm space-y-4">
        <h3 className="font-display text-base font-bold text-ink flex items-center gap-2 border-b hairline pb-3">
          <span>📄</span>
          <span>GST Registration <span className="ml-1 text-xs font-normal text-muted">(Optional)</span></span>
        </h3>
        <p className="text-xs text-muted -mt-2">
          GST is not required for most second-hand car dealers. Upload only if your business is GST registered.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink">GSTIN / GST Number (Optional)</label>
            <input
              placeholder="15-digit GSTIN (e.g. 36AAAAA0000A1Z5)"
              value={form.gstin}
              onChange={(e) => set({ gstin: e.target.value.toUpperCase() })}
              maxLength={15}
              className="focus-ring mt-1 w-full rounded-xl border hairline px-3.5 py-2.5 font-mono text-sm uppercase"
            />
          </div>

          {form.gstin.length > 0 && (
            <div className="sm:col-span-2">
              <DocumentUploadField
                label="Upload GST Certificate (if applicable)"
                value={form.documents.gst}
                onChange={(doc) => setDoc("gst", doc)}
                exampleName="GST_Certificate.pdf"
                exampleSize="under 5MB"
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Confirmation & Submit */}
      <div className="rounded-2xl border hairline bg-white p-6 shadow-sm space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.agreeTerms}
            onChange={(e) => set({ agreeTerms: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          <span className="text-xs text-ink leading-relaxed">
            I confirm that I am an authorized representative of this dealership, and the information
            and documents provided above are accurate and genuine. I understand that providing false
            documents is a violation of TrustDrive India's terms and may result in account suspension.
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
              <span>Submitting for Review…</span>
            </>
          ) : (
            <span>🚀 Submit for Admin Approval</span>
          )}
        </button>

        <p className="text-center text-[11px] text-muted">
          Your application will be reviewed within 24–48 hours. You'll be notified once approved.
        </p>
      </div>
    </form>
  );
}
