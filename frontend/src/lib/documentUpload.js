import { resizeImageFile } from "./imageResize";

export const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
export const MAX_DOC_SIZE_MB = 5;
export const RECOMMENDED_IMAGE_SIZE_MB = 3;

/**
 * Validates and processes a single uploaded document (PAN, GST cert, etc.)
 * or dealership photo for the dealer verification form.
 *
 * Every file's actual content is kept as a base64 `dataUrl`, so the admin
 * dashboard can open/download the original — not just see a filename.
 * Images are ALSO compressed into a small `preview` thumbnail for fast
 * rendering in lists; PDFs have no thumbnail (`preview: null`) but their
 * full content is still in `dataUrl`.
 *
 * This is fine at small scale but stores documents as base64 directly in
 * the database — swap for real object storage (S3, or Supabase Storage
 * since you're already on Supabase) before real dealer volume. See the
 * README's production-readiness notes.
 */
export async function processDocumentFile(file) {
  if (!ALLOWED_DOC_TYPES.includes(file.type)) {
    throw new Error("Only PDF, JPG, or PNG files are accepted");
  }
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_DOC_SIZE_MB) {
    throw new Error(`File is too large (${sizeMB.toFixed(1)}MB) — max ${MAX_DOC_SIZE_MB}MB`);
  }

  const base = {
    name: file.name,
    size: file.size,
    type: file.type,
    uploadedAt: new Date().toISOString(),
  };

  if (file.type === "application/pdf") {
    const dataUrl = await readFileAsDataURL(file);
    return { ...base, preview: null, dataUrl };
  }

  const preview = await resizeImageFile(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.75 });
  // The compressed preview doubles as the downloadable content for images.
  return { ...base, preview, dataUrl: preview };
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
