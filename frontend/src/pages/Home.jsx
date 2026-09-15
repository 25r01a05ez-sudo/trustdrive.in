import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import VehicleCard from "../components/VehicleCard";
import VehicleCardSkeleton from "../components/VehicleCardSkeleton";
import VerifiedStamp from "../components/VerifiedStamp";

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .search({ sort: "newest" })
      .then((d) => setFeatured(d.results.slice(0, 4)))
      .catch(() => {})
      .finally(() => setLoadingFeatured(false));
  }, []);

  const quickSearch = (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get("q");
    navigate(`/listings${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  };

  return (
    <div>
      {/* HERO — the thesis: a document, stamped and checked, before you ever call */}
      <section className="border-b hairline paper-texture">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold-dark">
              Hyderabad · Verified used-car marketplace
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink md:text-6xl">
              Every car here has already passed the paperwork test.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
              We run each dealer's GST and KYC, and cross-check every RC and
              chassis number against government records — before you're ever
              connected. You just show up to look at the car.
            </p>
            <form onSubmit={quickSearch} className="mt-8 flex max-w-md gap-2">
              <input
                name="q"
                placeholder="Search 'Swift', 'Creta', 'City'…"
                className="focus-ring w-full rounded-full border hairline bg-white px-5 py-3 text-sm"
              />
              <button className="focus-ring shrink-0 rounded-full bg-primary px-6 py-3 text-sm font-medium text-paper hover:bg-primary-light">
                Search
              </button>
            </form>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted">
              <div><span className="font-display text-2xl font-semibold text-ink">2,400+</span><br />RC checks run</div>
              <div className="h-8 w-px bg-line" />
              <div><span className="font-display text-2xl font-semibold text-ink">180+</span><br />verified dealers</div>
            </div>
          </div>

          {/* Signature moment: an RC-card style document with the stamp */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-2xl border hairline bg-white p-6 shadow-xl shadow-primary/10">
              <div className="flex items-center justify-between border-b hairline pb-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  Registration Certificate — Check
                </span>
                <span className="font-mono text-[10px] text-muted">VAHAN</span>
              </div>
              <dl className="mt-4 space-y-2.5 font-mono text-xs">
                <div className="flex justify-between"><dt className="text-muted">Reg. No.</dt><dd className="text-ink">TS09EA1234</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Chassis</dt><dd className="text-ink">MA3ERLF1S...</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Owner count</dt><dd className="text-ink">1</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Status</dt><dd className="text-primary">Active, no dues</dd></div>
              </dl>
              <div className="mt-6 flex items-center justify-between border-t hairline pt-4">
                <span className="text-xs text-muted">Cross-checked against govt. records</span>
                <VerifiedStamp size="lg" label="Verified" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three-step process — order carries real meaning here (it's a pipeline) */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl font-semibold text-ink">How a listing earns its stamp</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {[
            { title: "Dealer KYC & GST", body: "Every dealer submits GST registration and business KYC before they can list a single car." },
            { title: "RC & chassis cross-check", body: "Registration number and chassis number are matched against government vehicle records." },
            { title: "Buyer connects direct", body: "Only once both checks clear does the dealer's WhatsApp and call line open up to buyers." },
          ].map((step, i) => (
            <div key={step.title} className="border-t-2 border-primary pt-4">
              <span className="font-mono text-xs text-gold-dark">0{i + 1}</span>
              <h3 className="mt-2 font-display text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured listings */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold text-ink">Recently verified</h2>
          <Link to="/listings" className="focus-ring text-sm font-medium text-primary hover:underline">
            Browse all →
          </Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loadingFeatured
            ? Array.from({ length: 4 }).map((_, i) => <VehicleCardSkeleton key={i} />)
            : featured.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
        </div>
      </section>

      {/* CTA for dealers */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-2xl bg-primary px-8 py-12 text-paper md:px-14">
          <div className="max-w-lg">
            <h2 className="font-display text-2xl font-semibold">Run a dealership? Get the verified badge.</h2>
            <p className="mt-2 text-sm leading-relaxed text-paper/80">
              Verified listings get more serious enquiries and fewer time-wasters.
              Registration takes ten minutes; our team clears KYC within 48 hours.
            </p>
            <Link
              to="/signup"
              className="focus-ring mt-6 inline-block rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink hover:bg-gold-light"
            >
              Register your dealership
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
