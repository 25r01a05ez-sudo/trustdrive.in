import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import SearchFilters from "../components/SearchFilters";
import VehicleCard from "../components/VehicleCard";
import VehicleCardSkeleton from "../components/VehicleCardSkeleton";
import { useWishlist } from "../lib/useWishlist";

export default function Listings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { savedIds, count: wishlistCount } = useWishlist();

  const isSavedMode = searchParams.get("saved") === "true";
  const params = Object.fromEntries(searchParams.entries());

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .search(params)
      .then((d) => setResults(d.results || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const displayedResults = isSavedMode
    ? results.filter((v) => savedIds.includes(v.id))
    : results;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold leading-tight text-ink">
            {isSavedMode ? "❤️ Your Saved Cars" : "Browse Verified Cars"}
          </h1>

          {/* Tab switcher: All Cars vs Saved Cars */}
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                const next = { ...params };
                delete next.saved;
                setSearchParams(next);
              }}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                !isSavedMode ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              All Inventory ({results.length})
            </button>
            <button
              type="button"
              onClick={() => setSearchParams({ ...params, saved: "true" })}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                isSavedMode ? "bg-rose-600 text-white shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              <span>❤️ Saved</span>
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${isSavedMode ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"}`}>
                {wishlistCount}
              </span>
            </button>
          </div>
        </div>
        <p className="text-sm text-muted">
          {isSavedMode
            ? `You have saved ${wishlistCount} car${wishlistCount === 1 ? "" : "s"} for easy comparison.`
            : "Direct from verified dealers with VAHAN cross-checked records."}
        </p>
      </div>

      {!isSavedMode && (
        <div className="mt-6">
          <SearchFilters initial={params} onSearch={(f) => setSearchParams(f)} />
        </div>
      )}

      <div className="mt-8">
        {error && <p className="text-sm text-danger">{error}</p>}

        {!loading && !error && displayedResults.length === 0 && (
          <div className="rounded-2xl border hairline bg-white p-12 text-center shadow-sm">
            {isSavedMode ? (
              <div>
                <span className="text-4xl">🤍</span>
                <p className="font-display text-lg font-bold text-ink mt-2">No cars saved yet.</p>
                <p className="mt-1 text-sm text-muted">Click the heart icon on any vehicle card to save it here.</p>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...params };
                    delete next.saved;
                    setSearchParams(next);
                  }}
                  className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-xs font-semibold text-paper"
                >
                  Browse all cars →
                </button>
              </div>
            ) : (
              <div>
                <p className="font-display text-lg font-bold text-ink">No cars match those filters.</p>
                <p className="mt-1 text-sm text-muted">Try widening your budget, selecting another fuel type, or clearing filters.</p>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <VehicleCardSkeleton key={i} />)
            : displayedResults.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
        </div>
      </div>
    </div>
  );
}
