export default function Wordmark({ className = "h-8" }) {
  return (
    <img
      src="/logo.png"
      alt="TrustDrive India"
      className={`inline-block w-auto object-contain rounded shadow-sm ${className}`}
    />
  );
}
