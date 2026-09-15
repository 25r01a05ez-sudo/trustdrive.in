/**
 * Resizes an uploaded image in the browser before it's sent to the API, so
 * dealer photo uploads don't balloon into multi-megabyte payloads. Returns
 * a base64 data URL. In production, swap this for a real upload to S3 /
 * Cloudinary and store the returned URL instead of a data URL — the
 * `images` field on Vehicle already accepts either.
 */

// HEIC/HEIF (the default format on iPhone cameras) reports a MIME type
// starting with "image/", so it passes a naive type check, but browsers
// can't decode it via <img>/Canvas at all -- the decode step then hangs
// forever with neither onload nor onerror firing in some browsers. Catch
// it explicitly up front instead, with an actionable message, rather than
// letting the upload silently hang.
const UNSUPPORTED_EXTENSIONS = [".heic", ".heif"];
const DECODE_TIMEOUT_MS = 10000;

export function resizeImageFile(file, { maxWidth = 1280, maxHeight = 960, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error(`"${file.name}" isn't an image file`));
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (UNSUPPORTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      reject(new Error(`"${file.name}" is a HEIC/HEIF photo, which browsers can't process directly — convert it to JPG or PNG first (most phones can do this from the share/export menu)`));
      return;
    }

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`"${file.name}" took too long to process — try a different photo or format (JPG/PNG work best)`));
    }, DECODE_TIMEOUT_MS);

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn();
    };

    const reader = new FileReader();
    reader.onerror = () => finish(() => reject(new Error(`Could not read "${file.name}"`)));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => finish(() => reject(new Error(`Could not decode "${file.name}" — try converting it to JPG or PNG`)));
      img.onload = () => {
        finish(() => {
          let { width, height } = img;
          const scale = Math.min(1, maxWidth / width, maxHeight / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
