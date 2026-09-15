import { useState } from "react";
import { processDocumentFile, formatFileSize } from "../lib/documentUpload";

export default function DocumentUploadField({ label, required = false, value, onChange, exampleName, exampleSize }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const doc = await processDocumentFile(file);
      onChange(doc);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      <label className="flex items-center gap-1 text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger">*</span>}
      </label>

      {value ? (
        <div className="mt-1.5 flex items-center justify-between rounded-lg border hairline bg-primary/5 px-3 py-2.5">
          <a
            href={value.dataUrl || value.preview}
            target="_blank"
            rel="noreferrer"
            className="focus-ring flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
            title="View what you uploaded"
          >
            {value.preview ? (
              <img src={value.preview} alt={value.name} className="h-9 w-9 shrink-0 rounded object-cover" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary/10 font-mono text-[9px] font-semibold text-primary">
                PDF
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-ink underline-offset-2 hover:underline">{value.name}</p>
              <p className="text-[11px] text-muted">{formatFileSize(value.size)}</p>
            </div>
          </a>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="focus-ring shrink-0 rounded-full px-2 py-1 text-xs text-muted hover:text-danger"
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="focus-ring mt-1.5 flex cursor-pointer items-center justify-center rounded-lg border border-dashed hairline px-3 py-3 text-xs text-muted hover:border-primary hover:text-primary">
          {loading ? "Processing…" : "Upload PDF / JPG / PNG"}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/jpg,image/png"
            onChange={handleFile}
            className="hidden"
            disabled={loading}
          />
        </label>
      )}

      {!value && (exampleName || exampleSize) && (
        <p className="mt-1 font-mono text-[10px] text-muted">
          Example: {exampleName} {exampleSize && `· ${exampleSize}`}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
