import React from "react";
import VerifiedStamp from "./VerifiedStamp";

function formatINR(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0);
}

export default function WindowStickerModal({ vehicle, dealer, onClose }) {
  if (!vehicle) return null;

  const origin = window.location.origin;
  const vehicleUrl = `${origin}/vehicle/${vehicle.id}`;
  // High-res QR code generated via public QR generator service
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    vehicleUrl
  )}&margin=10`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {/* Modal Container */}
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Modal Toolbar (hidden on print) */}
        <div className="no-print flex items-center justify-between border-b hairline bg-paper/50 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2">
              <span>🖨️</span>
              <span>Showroom Window Sticker</span>
            </h2>
            <p className="text-xs text-muted">Print and place on the vehicle windshield for showroom walk-ins.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="focus-ring flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-paper shadow-sm hover:bg-primary-light transition-all"
            >
              <span>🖨️ Print (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-muted hover:bg-slate-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="printable-sticker overflow-y-auto p-8 text-ink">
          {/* Printable Container (styled for clean A4 aspect) */}
          <div className="rounded-2xl border-4 border-slate-900 bg-white p-6 shadow-inner">
            {/* Header: Dealer branding & TrustDrive Badge */}
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                  VERIFIED DEALER INVENTORY
                </span>
                <h1 className="font-display text-2xl font-black text-slate-900 uppercase">
                  {dealer?.name || "Premium Dealership"}
                </h1>
                <p className="font-mono text-xs text-slate-600">
                  📍 {dealer?.address ? `${dealer.address}, ` : ""}{dealer?.city || "India"} {dealer?.whatsapp ? `• 📞 ${dealer.whatsapp}` : ""}
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-900">
                  <span>🛡️</span>
                  <span>TrustDrive Certified</span>
                </div>
              </div>
            </div>

            {/* Vehicle Headline */}
            <div className="mt-5 flex items-baseline justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                  {vehicle.year}
                </span>
                <h2 className="font-display text-3xl font-black text-slate-900 mt-1">
                  {vehicle.brand} {vehicle.model}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Verified Price</span>
                <p className="font-mono text-3xl font-black text-emerald-700">
                  ₹{formatINR(vehicle.price)}
                </p>
              </div>
            </div>

            {/* Specs Grid */}
            <div className="mt-5 grid grid-cols-4 gap-3 text-center">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase text-slate-500">Kilometers</span>
                <p className="font-mono text-base font-bold text-slate-900">{formatINR(vehicle.km)} km</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase text-slate-500">Fuel Type</span>
                <p className="font-mono text-base font-bold text-slate-900">{vehicle.fuel || "Petrol"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase text-slate-500">Transmission</span>
                <p className="font-mono text-base font-bold text-slate-900">{vehicle.transmission || "Manual"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase text-slate-500">Ownership</span>
                <p className="font-mono text-base font-bold text-slate-900">
                  {vehicle.owners === 1 ? "1st Owner" : `${vehicle.owners} Owners`}
                </p>
              </div>
            </div>

            {/* Description & Key Highlights */}
            {vehicle.description && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 border hairline text-xs leading-relaxed text-slate-700 italic">
                "{vehicle.description}"
              </div>
            )}

            {/* QR Code & Scan CTA */}
            <div className="mt-5 flex items-center justify-between rounded-xl border-2 border-dashed border-emerald-600 bg-emerald-50/50 p-4">
              <div className="max-w-[65%]">
                <h3 className="font-display text-base font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>📱</span>
                  <span>Scan to Inspect Full VAHAN & RC History</span>
                </h3>
                <p className="mt-1 text-xs text-emerald-800 leading-normal">
                  Open your smartphone camera to view full photos, certified inspection checklist, and instant WhatsApp chat with our sales team.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-emerald-900">
                  <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">✓ VAHAN Verified</span>
                  <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">✓ Clear Legal Title</span>
                  <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">✓ No Odometer Tampering</span>
                </div>
              </div>

              {/* Scannable QR Code */}
              <div className="flex flex-col items-center">
                <div className="rounded-xl border-2 border-emerald-700 bg-white p-1.5 shadow-md">
                  <img
                    src={qrCodeUrl}
                    alt={`QR Code for ${vehicle.brand} ${vehicle.model}`}
                    className="h-28 w-28 object-contain"
                  />
                </div>
                <span className="mt-1 font-mono text-[9px] font-bold text-emerald-900 tracking-wider">
                  SCAN WITH PHONE
                </span>
              </div>
            </div>

            {/* Footer stamp */}
            <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Powered by TrustDrive Automotive Network</span>
              <span>Listing ID: #{vehicle.id?.slice(-8).toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Print-specific Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-sticker, .printable-sticker * {
            visibility: visible;
          }
          .printable-sticker {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
