export default function VerifiedStamp({ size = "md", label = "VERIFIED" }) {
  const sizes = {
    sm: "h-8 w-8 text-[7px]",
    md: "h-11 w-11 text-[8px]",
    lg: "h-24 w-24 text-[11px]",
  };
  return (
    <span
      className={`stamp ${sizes[size]} bg-primary/5 text-primary shrink-0`}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
