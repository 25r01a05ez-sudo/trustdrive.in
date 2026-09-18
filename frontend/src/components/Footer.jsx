import { Link } from "react-router-dom";
import Wordmark from "./Wordmark";

export default function Footer() {
  return (
    <footer className="border-t hairline mt-24">
      <div className="mx-auto max-w-6xl px-6 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <Wordmark className="text-lg" />
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-gold-dark">
            Drive smart · Buy safe
          </p>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            Every dealer KYC-checked. Every RC cross-verified with government
            records. No surprises at the RTO.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-muted">Buy</div>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li><Link to="/listings" className="focus-ring hover:text-primary">Browse verified cars</Link></li>
            <li><Link to="/dealers" className="focus-ring hover:text-primary">Verified dealers</Link></li>
            <li><Link to="/faq" className="focus-ring hover:text-primary">How verification works</Link></li>
            <li><Link to="/reviews" className="focus-ring hover:text-primary">Customer reviews</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-muted">Sell</div>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li><Link to="/signup" className="focus-ring hover:text-primary">Register as a dealer</Link></li>
            <li><Link to="/dealer" className="focus-ring hover:text-primary">Dealer dashboard</Link></li>
            <li><Link to="/faq" className="focus-ring hover:text-primary">Get verified</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-muted">Company</div>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li><Link to="/about" className="focus-ring hover:text-primary">About us</Link></li>
            <li><Link to="/blog" className="focus-ring hover:text-primary">Blog</Link></li>
            <li><Link to="/faq" className="focus-ring hover:text-primary">FAQs</Link></li>
            <li>WhatsApp: +91 90000 00000</li>
            <li>Hyderabad, India</li>
          </ul>
        </div>
      </div>
      <div className="border-t hairline py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 text-xs text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} TrustDrive India. Demo build.</span>
          <div className="flex gap-4">
            <Link to="/privacy" className="focus-ring hover:text-primary">Privacy Policy</Link>
            <Link to="/terms" className="focus-ring hover:text-primary">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
