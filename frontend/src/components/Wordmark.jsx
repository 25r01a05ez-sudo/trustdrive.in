export default function Wordmark({ className = "text-xl" }) {
  return (
    <span className={`font-display font-semibold tracking-tight ${className}`}>
      <span className="text-primary">Trust</span>
      <span className="text-gold-dark">Drive</span>
    </span>
  );
}
