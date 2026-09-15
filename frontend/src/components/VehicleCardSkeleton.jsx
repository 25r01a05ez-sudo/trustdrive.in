export default function VehicleCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border hairline bg-white">
      <div className="h-40 bg-line/60" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 rounded bg-line/60" />
        <div className="h-5 w-1/2 rounded bg-line/60" />
        <div className="h-3 w-3/4 rounded bg-line/40" />
        <div className="mt-3 h-3 w-1/3 rounded bg-line/40" />
      </div>
    </div>
  );
}
