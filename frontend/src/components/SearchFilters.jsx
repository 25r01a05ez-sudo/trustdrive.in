import { useEffect, useState } from "react";
import { api } from "../lib/api";

const COMMON_BRANDS = ["Maruti Suzuki", "Hyundai", "Honda", "Tata", "Mahindra", "BMW", "Audi", "Mercedes-Benz", "Toyota", "Kia"];
const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"];
const POPULAR_CITIES = ["Hyderabad", "Secunderabad", "Bengaluru", "Mumbai", "Delhi NCR", "Chennai", "Pune"];
const POPULAR_AREAS = [
  "Banjara Hills",
  "Jubilee Hills",
  "Gachibowli",
  "Kukatpally",
  "Madhapur",
  "Hitec City",
  "S.D. Road",
  "Kondapur",
  "Begumpet",
];

export default function SearchFilters({ initial = {}, onSearch }) {
  const [filters, setFilters] = useState({
    q: initial.q || "",
    brand: initial.brand || "",
    fuel: initial.fuel || "",
    city: initial.city || "",
    area: initial.area || "",
    transmission: initial.transmission || "",
    maxPrice: initial.maxPrice || "",
    verifiedOnly: initial.verifiedOnly || "",
    sort: initial.sort || "newest",
  });

  const [facets, setFacets] = useState({
    brands: COMMON_BRANDS,
    fuels: FUEL_TYPES,
    cities: POPULAR_CITIES,
    areas: POPULAR_AREAS,
  });

  useEffect(() => {
    api
      .searchFacets()
      .then((data) => {
        if (data) {
          setFacets((prev) => ({
            brands: data.brands?.length ? data.brands : prev.brands,
            fuels: data.fuels?.length ? data.fuels : prev.fuels,
            cities: data.cities?.length ? data.cities : prev.cities,
            areas: data.areas?.length ? data.areas : prev.areas,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const update = (key) => (e) => {
    const val = e.target ? e.target.value : e;
    setFilters((f) => ({ ...f, [key]: val }));
  };

  const submit = (e) => {
    if (e) e.preventDefault();
    const cleaned = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ""));
    onSearch(cleaned);
  };

  const clearFilter = (key) => {
    const next = { ...filters, [key]: "" };
    setFilters(next);
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== ""));
    onSearch(cleaned);
  };

  const clearAll = () => {
    const empty = {
      q: "",
      brand: "",
      fuel: "",
      city: "",
      area: "",
      transmission: "",
      maxPrice: "",
      verifiedOnly: "",
      sort: "newest",
    };
    setFilters(empty);
    onSearch({});
  };

  const activeCount = Object.entries(filters).filter(
    ([k, v]) => v !== "" && k !== "sort"
  ).length;

  return (
    <form onSubmit={submit} className="rounded-2xl border hairline bg-white p-5 shadow-sm">
      {/* Primary Search Bar Row */}
      <div className="grid gap-3 sm:grid-cols-12">
        <div className="sm:col-span-4 relative">
          <input
            value={filters.q}
            onChange={update("q")}
            placeholder="Search make, model, or locality..."
            className="focus-ring h-10 w-full rounded-xl border hairline pl-9 pr-3 text-sm bg-white text-ink placeholder:text-muted"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
        </div>

        {/* City Filter */}
        <div className="sm:col-span-2 relative">
          <select
            value={filters.city}
            onChange={update("city")}
            className="focus-ring h-10 w-full rounded-xl border hairline pl-9 pr-3 text-sm bg-white text-ink appearance-none"
          >
            <option value="">All Cities</option>
            {facets.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">📍</span>
        </div>

        {/* Area / Locality Filter */}
        <div className="sm:col-span-2 relative">
          <select
            value={filters.area}
            onChange={update("area")}
            className="focus-ring h-10 w-full rounded-xl border hairline pl-9 pr-3 text-sm bg-white text-ink appearance-none"
          >
            <option value="">All Localities</option>
            {facets.areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🏘️</span>
        </div>

        {/* Fuel Type Filter */}
        <div className="sm:col-span-2 relative">
          <select
            value={filters.fuel}
            onChange={update("fuel")}
            className="focus-ring h-10 w-full rounded-xl border hairline pl-9 pr-3 text-sm bg-white text-ink appearance-none"
          >
            <option value="">All Fuel Types</option>
            {facets.fuels.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">⛽</span>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="focus-ring h-10 w-full rounded-xl bg-primary text-sm font-semibold text-paper hover:bg-primary-light transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            <span>Apply Filters</span>
          </button>
        </div>
      </div>

      {/* Secondary Filter Row */}
      <div className="mt-3 grid gap-3 sm:grid-cols-4 border-t hairline pt-3">
        <div className="relative">
          <select
            value={filters.brand}
            onChange={update("brand")}
            className="focus-ring h-10 w-full rounded-xl border hairline pl-9 pr-3 text-sm bg-white text-ink appearance-none"
          >
            <option value="">Brand: Any Brand</option>
            {facets.brands.map((b) => (
              <option key={b} value={b} className="text-ink">
                {b}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🚘</span>
        </div>

        <div className="relative">
          <select
            value={filters.transmission}
            onChange={update("transmission")}
            className="focus-ring h-10 w-full rounded-xl border hairline pl-9 pr-3 text-sm bg-white text-ink appearance-none"
          >
            <option value="">Transmission: Any</option>
            <option value="Manual" className="text-ink">Manual</option>
            <option value="Automatic" className="text-ink">Automatic</option>
            <option value="CVT" className="text-ink">CVT</option>
          </select>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">⚙️</span>
        </div>

        <div className="relative">
          <select
            value={filters.maxPrice}
            onChange={update("maxPrice")}
            className="focus-ring h-10 w-full rounded-xl border hairline pl-9 pr-3 text-sm bg-white text-ink appearance-none"
          >
            <option value="">Budget: Any Price</option>
            <option value="500000" className="text-ink">Under ₹5 Lakh</option>
            <option value="1000000" className="text-ink">Under ₹10 Lakh</option>
            <option value="2000000" className="text-ink">Under ₹20 Lakh</option>
            <option value="3500000" className="text-ink">Under ₹35 Lakh</option>
            <option value="5000000" className="text-ink">Under ₹50 Lakh</option>
          </select>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">💰</span>
        </div>

        <div className="relative">
          <select
            value={filters.sort}
            onChange={(e) => {
              update("sort")(e);
              const next = { ...filters, sort: e.target.value };
              const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== ""));
              onSearch(cleaned);
            }}
            className="focus-ring h-10 w-full rounded-xl border hairline pl-9 pr-3 text-sm bg-white text-ink font-medium appearance-none"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="price_asc">Sort: Price (Low to High)</option>
            <option value="price_desc">Sort: Price (High to Low)</option>
            <option value="km_asc">Sort: Lowest Mileage</option>
          </select>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">↕️</span>
        </div>
      </div>

      {/* Active Filter Badges & Reset Bar */}
      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t hairline">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1">
            Active ({activeCount}):
          </span>

          {filters.q && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-ink font-medium">
              Keyword: "{filters.q}"
              <button type="button" onClick={() => clearFilter("q")} className="text-muted hover:text-danger">
                ✕
              </button>
            </span>
          )}

          {filters.city && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs text-emerald-800 font-medium">
              📍 {filters.city}
              <button type="button" onClick={() => clearFilter("city")} className="hover:text-danger">
                ✕
              </button>
            </span>
          )}

          {filters.area && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs text-blue-800 font-medium">
              🏘️ {filters.area}
              <button type="button" onClick={() => clearFilter("area")} className="hover:text-danger">
                ✕
              </button>
            </span>
          )}

          {filters.fuel && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs text-amber-800 font-medium">
              ⛽ {filters.fuel}
              <button type="button" onClick={() => clearFilter("fuel")} className="hover:text-danger">
                ✕
              </button>
            </span>
          )}

          {filters.brand && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-ink font-medium">
              Brand: {filters.brand}
              <button type="button" onClick={() => clearFilter("brand")} className="text-muted hover:text-danger">
                ✕
              </button>
            </span>
          )}

          {filters.maxPrice && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-ink font-medium">
              Max: ₹{Number(filters.maxPrice).toLocaleString("en-IN")}
              <button type="button" onClick={() => clearFilter("maxPrice")} className="text-muted hover:text-danger">
                ✕
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-muted hover:text-danger underline font-medium ml-2"
          >
            Clear all filters
          </button>
        </div>
      )}
    </form>
  );
}
