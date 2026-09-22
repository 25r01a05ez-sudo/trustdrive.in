export default function Wordmark({ className = "h-8" }) {
  return (
    <img
      src="/logo.png"
      alt="TrustDrives India"
      className={`inline-block w-auto object-contain mix-blend-multiply ${className}`}
    />
  );
}
