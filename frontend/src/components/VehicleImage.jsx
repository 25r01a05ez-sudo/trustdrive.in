// Deterministic hue shift per brand so placeholders feel varied, not identical
function brandTint(brand = "") {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = brand.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return hue;
}

function CarSilhouette({ hue }) {
  return (
    <svg viewBox="0 0 200 100" className="h-1/2 w-3/4 opacity-70" style={{ color: `hsl(${hue} 35% 30%)` }}>
      <path
        fill="currentColor"
        d="M20 68c-6 0-10-4-10-10 0-5 3-9 8-10l8-16c4-8 12-13 21-13h50c11 0 21 6 26 16l6 12c9 1 16 6 19 14 2 5-1 9-6 9h-4c0 8-6 14-14 14s-14-6-14-14H62c0 8-6 14-14 14S34 78 34 70h-4c-4 0-8-1-10-2z"
      />
      <circle cx="48" cy="70" r="9" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="152" cy="70" r="9" fill="none" stroke="currentColor" strokeWidth="4" />
      <path fill="white" fillOpacity="0.55" d="M56 36h64l8 16H50z" />
    </svg>
  );
}

export default function VehicleImage({ vehicle, className = "" }) {
  const photo = vehicle?.images?.[0];
  const hue = brandTint(vehicle?.brand);

  if (photo) {
    return (
      <img
        src={photo}
        alt={`${vehicle.brand} ${vehicle.model}`}
        className={`h-full w-full object-cover ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center paper-texture ${className}`}
      style={{ background: `hsl(${hue} 40% 95%)` }}
    >
      <CarSilhouette hue={hue} />
      <span className="mt-1 font-display text-xs text-ink/40">{vehicle?.brand}</span>
    </div>
  );
}
