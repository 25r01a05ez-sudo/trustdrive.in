function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Doc({ label, doc }) {
  if (!doc) {
    return (
      <div className="rounded-lg border border-dashed hairline p-3 text-center text-xs text-muted">
        {label} — not provided
      </div>
    );
  }
  return (
    <div className="rounded-lg border hairline bg-paper p-3">
      <div className="flex items-center gap-2">
        {doc.preview ? (
          <img src={doc.preview} alt={doc.name} className="h-10 w-10 shrink-0 rounded object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10 font-mono text-[9px] font-semibold text-primary">
            PDF
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink">{label}</p>
          <p className="truncate text-[11px] text-muted">{doc.name} · {formatFileSize(doc.size)}</p>
        </div>
      </div>
      {doc.dataUrl ? (
        <div className="mt-2 flex gap-2">
          <a
            href={doc.dataUrl}
            target="_blank"
            rel="noreferrer"
            className="focus-ring flex-1 rounded-md border hairline py-1.5 text-center text-[11px] font-medium text-ink hover:border-primary hover:text-primary"
          >
            View
          </a>
          <a
            href={doc.dataUrl}
            download={doc.name}
            className="focus-ring flex-1 rounded-md border hairline py-1.5 text-center text-[11px] font-medium text-ink hover:border-primary hover:text-primary"
          >
            Download
          </a>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-gold-dark">
          Uploaded before file storage was enabled — ask the dealer to re-upload or send it on WhatsApp.
        </p>
      )}
    </div>
  );
}

export default function DealerDocumentsViewer({ verification }) {
  if (!verification) {
    return <p className="text-sm text-muted">No verification details were submitted with this registration.</p>;
  }

  const v = verification;

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Business</h3>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <Field label="Business name" value={v.businessName} />
          <Field label="Business type" value={v.businessType} />
          <Field label="Year started" value={v.yearStarted} />
          <Field label="Employees" value={v.employeeCount} />
          <Field label="PAN number" value={v.panNumber} mono />
          <Field label="GSTIN" value={v.gstin} mono />
        </dl>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Owner / authorized person</h3>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <Field label="Name" value={v.ownerName} />
          <Field label="Designation" value={v.designation} />
          <Field label="Mobile" value={v.ownerMobile} mono />
          <Field label="Email" value={v.ownerEmail} />
        </dl>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Address</h3>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <Field label="Address" value={v.address} />
          <Field label="City" value={v.city} />
          <Field label="State" value={v.state} />
          <Field label="PIN" value={v.pinCode} mono />
        </dl>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Bank details</h3>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <Field label="Account holder" value={v.bankAccountHolder} />
          <Field label="Account number" value={v.bankAccountNumber} mono />
          <Field label="IFSC" value={v.ifsc} mono />
        </dl>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Documents</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Doc label="PAN Card" doc={v.documents?.pan} />
          <Doc label="Aadhaar / Government ID" doc={v.documents?.aadhaar} />
          <Doc label="GST Certificate" doc={v.documents?.gst} />
          <Doc label="Udyam Certificate" doc={v.documents?.udyam} />
          <Doc label="Trade License" doc={v.documents?.tradeLicense} />
          <Doc label="Address Proof" doc={v.addressProof} />
          <Doc label="Cancelled Cheque" doc={v.cancelledCheque} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Dealership photos</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Doc label="Exterior" doc={v.photos?.exterior} />
          <Doc label="Interior" doc={v.photos?.interior} />
          <Doc label="Signboard" doc={v.photos?.signboard} />
        </div>
        {v.extraPhotos?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {v.extraPhotos.map((p, i) => (
              <a key={p.name + i} href={p.dataUrl || p.preview} target="_blank" rel="noreferrer" className="focus-ring block">
                <img src={p.preview} alt={p.name} className="h-14 w-14 rounded-lg object-cover transition-opacity hover:opacity-80" />
              </a>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Owner verification & declarations</h3>
        <p className="mt-2 text-xs text-ink">
          Video KYC: <span className="font-medium">{v.selfieStatus === "requested" ? "Requested by dealer" : "Not requested"}</span>
        </p>
        <p className="mt-1 text-xs text-ink">
          Declarations confirmed: <span className="font-medium">{Object.values(v.declarations || {}).every(Boolean) ? "Yes, all 4" : "Incomplete"}</span>
        </p>
      </section>
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className={`text-ink ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}
