/**
 * Formats numbers into Indian Rupees currency or integer strings,
 * stripping all stray space characters produced by locale formatting.
 * E.g., 2150000 -> "21,50,000"
 */
export function formatINR(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
  // Remove normal spaces, non-breaking spaces, thin spaces, and zero-width spaces
  return formatted.replace(/[\s\u2000-\u200D\u202F\u00A0]/g, "");
}
