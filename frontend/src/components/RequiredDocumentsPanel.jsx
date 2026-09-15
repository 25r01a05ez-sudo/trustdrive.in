const REQUIRED_DOCS = [
  "PAN Card",
  "Aadhaar Card / Government ID",
  "GST Registration Certificate",
  "Udyam Registration Certificate",
  "Shop & Establishment / Trade License",
  "Business Address Proof",
  "Cancelled Cheque / Bank Account Proof",
  "Dealer Declaration / Self-Declaration",
  "Dealership Photos (exterior, interior, signboard)",
  "Owner/Authorized Person Selfie or Video KYC",
];

export default function RequiredDocumentsPanel() {
  return (
    <div className="rounded-2xl border hairline bg-white p-5">
      <h2 className="font-display text-lg font-semibold text-ink">Documents you'll need</h2>
      <p className="mt-1 text-sm text-muted">
        Have these ready before you start — the form takes about 10 minutes if you do.
      </p>
      <ol className="mt-4 space-y-2">
        {REQUIRED_DOCS.map((doc, i) => (
          <li key={doc} className="flex items-start gap-2.5 text-sm text-ink">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-semibold text-primary">
              {i + 1}
            </span>
            {doc}
          </li>
        ))}
      </ol>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t hairline pt-4 text-xs text-muted sm:grid-cols-4">
        <div><p className="font-medium text-ink">Formats</p><p>PDF, JPG, PNG</p></div>
        <div><p className="font-medium text-ink">Max per file</p><p>5 MB</p></div>
        <div><p className="font-medium text-ink">Dealership photos</p><p>5–10 images</p></div>
        <div><p className="font-medium text-ink">Total documents</p><p>Up to 12</p></div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        After you submit, our team reviews everything manually — we'll also ask you to send the
        original files on WhatsApp to confirm, since automated document checks can be spoofed.
      </p>
    </div>
  );
}
