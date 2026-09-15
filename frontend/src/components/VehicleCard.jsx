import { Link } from "react-router-dom";
import VerifiedStamp from "./VerifiedStamp";
import VehicleImage from "./VehicleImage";
import { useWishlist } from "../lib/useWishlist";

function formatINR(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0);
}

export default function VehicleCard({ vehicle }) {
  const dealer = vehicle.dealer || {};
  const dealerVerified = dealer.verificationStatus === "verified";
  const { isSaved, toggleWishlist } = useWishlist();
  const saved = isSaved(vehicle.id);

  // Build direct WhatsApp pre-filled link
  const waNumber = (dealer.whatsapp || "").replace(/[^\d]/g, "");
  const waMessage = encodeURIComponent(
    `Hi ${dealer.name || "Dealer"}, I saw the ${vehicle.year} ${vehicle.brand} ${vehicle.model} (₹${formatINR(
      vehicle.price
    )}) on TrustDrive. Is it still available for a test drive?`
  );
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${waMessage}` : null;

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all hover:-translate-y-1 hover:shadow-xl ${
        vehicle.featured
          ? "border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50"
          : "hairline hover:shadow-primary/10"
      }`}
    >
      {/* Image & Badges */}
      <div className="relative h-44 overflow-hidden block bg-paper">
        <Link to={`/vehicle/${vehicle.id}`} className="block h-full w-full">
          <VehicleImage
            vehicle={vehicle}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        {/* Top Badges */}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1 pointer-events-none">
          {vehicle.featured && (
            <span className="rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm flex items-center gap-1">
              <span>⭐</span>
              <span>Spotlight</span>
            </span>
          )}
          {vehicle.owners === 1 && (
            <span className="rounded-full bg-emerald-700/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm shadow-sm">
              👤 1st Owner
            </span>
          )}
          {Number(vehicle.km) < 30000 && (
            <span className="rounded-full bg-blue-700/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm shadow-sm">
              ⚡ Low KM
            </span>
          )}
        </div>

        {/* Wishlist Heart Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(vehicle.id);
          }}
          aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
          className="focus-ring absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition-transform active:scale-90 hover:scale-110"
        >
          <span className={`text-base transition-colors ${saved ? "text-rose-600" : "text-slate-400 hover:text-rose-500"}`}>
            {saved ? "❤️" : "🤍"}
          </span>
        </button>

        {vehicle.rcVerified && (
          <div className="absolute right-2.5 bottom-2.5 pointer-events-none">
            <VerifiedStamp size="sm" label="RC Verified" />
          </div>
        )}

        {vehicle.images?.length > 1 && (
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm pointer-events-none">
            📷 +{vehicle.images.length - 1} photos
          </span>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/vehicle/${vehicle.id}`}>
            <h3 className="font-display text-base font-bold leading-snug text-ink transition-colors hover:text-primary">
              {vehicle.brand} {vehicle.model}
            </h3>
          </Link>
          <span className="whitespace-nowrap rounded-md bg-paper px-1.5 py-0.5 font-mono text-xs font-semibold text-muted">
            {vehicle.year}
          </span>
        </div>

        <p className="mt-1 font-mono text-xl font-bold text-primary">₹{formatINR(vehicle.price)}</p>

        {/* Key Specs Pills */}
        <div className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted">
          <span className="font-medium">{formatINR(vehicle.km)} km</span>
          <span>•</span>
          <span className="font-medium">{vehicle.fuel}</span>
          <span>•</span>
          <span className="font-medium">{vehicle.transmission}</span>
        </div>

        {/* Dealer & Location info */}
        <div className="mt-3 flex items-center justify-between border-t hairline pt-2.5 text-xs text-muted">
          <div className="flex items-center gap-1 truncate max-w-[65%]">
            {dealerVerified && <VerifiedStamp size="sm" />}
            <span className="truncate font-medium text-ink">{dealer.name || "Verified Dealer"}</span>
          </div>
          {dealer.city && (
            <span className="text-[11px] text-muted whitespace-nowrap">
              📍 {dealer.city}
            </span>
          )}
        </div>

        {/* Direct WhatsApp CTA */}
        {waUrl && (
          <div className="mt-3 pt-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="focus-ring flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              <span>💬</span>
              <span>WhatsApp Dealer</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
