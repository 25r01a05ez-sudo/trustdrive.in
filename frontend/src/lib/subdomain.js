/**
 * Detects whether the current page is being visited on a dealer's
 * subdomain (e.g. primemotors.trustdrive.in) vs the main TrustDrive site.
 *
 * Three cases:
 *  1. Local dev on plain "localhost" or an IP -> no subdomain, main site.
 *  2. Local dev on "primemotors.localhost" -> subdomain = "primemotors".
 *     This is how you test subdomains locally: add an entry to your
 *     hosts file mapping e.g. "primemotors.localhost" to 127.0.0.1, then
 *     visit http://primemotors.localhost:5173. See README "Dealer
 *     microsites" for exact steps (Windows/Mac/Linux differ slightly).
 *  3. Real deployment on "primemotors.trustdrive.in" (VITE_PUBLIC_DOMAIN
 *     set to "trustdrive.in") -> subdomain = "primemotors".
 */
const RESERVED = new Set(["www", "app", "api"]);

export function getDealerSubdomain() {
  const hostname = window.location.hostname;
  const publicDomain = import.meta.env.VITE_PUBLIC_DOMAIN;

  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  if (hostname.endsWith(".localhost")) {
    const slug = hostname.replace(".localhost", "");
    return RESERVED.has(slug) ? null : slug;
  }

  if (publicDomain && hostname.endsWith(`.${publicDomain}`)) {
    const slug = hostname.slice(0, -(publicDomain.length + 1));
    return RESERVED.has(slug) || slug.includes(".") ? null : slug;
  }

  return null;
}
