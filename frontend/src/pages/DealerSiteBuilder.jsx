import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import MicrositeView from "../components/microsite/MicrositeView";

function publicUrlFor(subdomain) {
  const publicDomain = import.meta.env.VITE_PUBLIC_DOMAIN;
  if (publicDomain) return `https://${subdomain}.${publicDomain}`;
  const port = window.location.port ? `:${window.location.port}` : "";
  return `http://${subdomain}.localhost${port}`;
}

const DEFAULT_STARTER_SITE = {
  subdomain: "my-dealership",
  theme: {
    primaryColor: "#0F2A1D",
    accentColor: "#D4AF37",
    font: "serif",
  },
  hero: {
    headline: "Verified Pre-Owned Cars in Hyderabad",
    subheadline: "Browse our 100% RC-verified inventory and contact us directly on WhatsApp.",
  },
  about: {
    heading: "About Our Dealership",
    body: "We are an authorized, verified dealership on TrustDrive. Every car in our inventory is inspected, accident-free, and legally cleared.",
  },
  highlights: [
    {
      title: "100% RC & VAHAN Verified",
      body: "Every vehicle is cross-checked against government registration records.",
    },
    {
      title: "Direct WhatsApp Inquiries",
      body: "Connect directly with our sales team without middlemen or broker fees.",
    },
    {
      title: "Clean Document Guarantee",
      body: "Zero financier liens or hypothecation issues — guaranteed smooth transfer.",
    },
  ],
  contact: {
    ctaText: "Chat with us on WhatsApp",
  },
  published: false,
};

export default function DealerSiteBuilder() {
  const { getToken, user } = useAuth();
  const [site, setSite] = useState(DEFAULT_STARTER_SITE);
  const [dealerInfo, setDealerInfo] = useState(null);
  const [dealerVehicles, setDealerVehicles] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [subdomainInput, setSubdomainInput] = useState("my-dealership");
  const [subdomainStatus, setSubdomainStatus] = useState(null);
  const [previewDevice, setPreviewDevice] = useState("desktop"); // desktop | mobile

  const load = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const [{ site: fetchedSite }, vList, dList] = await Promise.all([
        api.getMySite(token).catch(() => ({ site: null })),
        api.myVehicles(token).catch(() => ({ vehicles: [] })),
        api.listDealers().catch(() => ({ dealers: [] })),
      ]);

      if (user?.dealerId) {
        const found = (dList.dealers || []).find((d) => d.id === user.dealerId);
        if (found) setDealerInfo(found);
      }

      setDealerVehicles(vList.vehicles || []);

      if (fetchedSite) {
        setSite(fetchedSite);
        setSubdomainInput(fetchedSite.subdomain);
      } else if (user?.name) {
        const defaultSub = user.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        setSite((prev) => ({
          ...prev,
          subdomain: defaultSub || "my-dealership",
          hero: {
            ...prev.hero,
            headline: `${user.name} — Verified Pre-Owned Cars`,
          },
          about: {
            ...prev.about,
            heading: `About ${user.name}`,
          },
        }));
        setSubdomainInput(defaultSub || "my-dealership");
      }
    } catch (err) {
      console.error("Error loading dealer site data:", err);
    }
  };

  useEffect(() => {
    if (user?.dealerId) load();
  }, [user]);

  const generate = async () => {
    if (!prompt.trim()) return;
    setError("");
    setMessage("");
    setGenerating(true);
    try {
      const token = await getToken();
      const { site: generated } = await api.generateSite(prompt, token);
      setSite(generated);
      setSubdomainInput(generated.subdomain);
      setMessage("✓ AI generated your branded website! Review the live preview below, customize if desired, and publish.");
    } catch (err) {
      setError(err.message || "Failed to generate website with AI.");
    } finally {
      setGenerating(false);
    }
  };

  const updateField = (section, field, value) => {
    setSite((s) => ({ ...s, [section]: { ...s[section], [field]: value } }));
  };

  const updateHighlight = (idx, field, value) => {
    setSite((s) => {
      const highlights = [...(s.highlights || [])];
      highlights[idx] = { ...highlights[idx], [field]: value };
      return { ...s, highlights };
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const token = await getToken();
      const { site: updated } = await api.updateSite(site, token);
      setSite(updated);
      setMessage("✓ Changes saved successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const checkSubdomain = async () => {
    setSubdomainStatus("checking");
    const token = await getToken();
    const cleanSub = subdomainInput.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setSubdomainInput(cleanSub);
    const result = await api.checkSubdomain(cleanSub, token);
    setSubdomainStatus(result);
  };

  const saveSubdomain = async () => {
    setError("");
    try {
      const token = await getToken();
      const cleanSub = subdomainInput.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { site: updated } = await api.setSubdomain(cleanSub, token);
      setSite(updated);
      setSubdomainStatus(null);
      setMessage(`✓ Address updated to ${cleanSub}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePublish = async () => {
    setError("");
    setMessage("");
    try {
      const token = await getToken();
      const call = site.published ? api.unpublishSite : api.publishSite;
      const { site: updated } = await call(token);
      setSite(updated);
      setMessage(
        updated.published
          ? `🎉 Your website is LIVE! Access it at: /site/${updated.subdomain}`
          : "Your website is now unpublished."
      );
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user?.dealerId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Finish dealer registration first</h1>
        <p className="mt-2 text-sm text-muted">You need an active dealer profile to build and publish a website.</p>
        <Link
          to="/dealer"
          className="focus-ring mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-paper"
        >
          Go to Dealer Dashboard
        </Link>
      </div>
    );
  }

  const effectiveDealer = {
    name: dealerInfo?.name || user?.name || "Premium Pre-Owned Cars",
    city: dealerInfo?.city || "Hyderabad",
    whatsapp: dealerInfo?.whatsapp || "+919876500002",
    address: dealerInfo?.address || "Auto Square, Main Road",
    gstNumber: dealerInfo?.gstNumber || "36ABCDE1234F1Z5",
    rating: dealerInfo?.rating || 4.8,
    reviewCount: dealerInfo?.reviewCount || 120,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b hairline pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">AI Dealer Website Builder</h1>
          <p className="mt-1 text-sm text-muted">
            Create an ultra-fast, branded website showcasing your verified cars with instant WhatsApp lead generation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/site/${site.subdomain}`}
            target="_blank"
            rel="noreferrer"
            className="focus-ring flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            <span>↗</span>
            <span>Open Fullscreen Public Site</span>
          </Link>
          <button
            type="button"
            onClick={togglePublish}
            className={`focus-ring rounded-full px-5 py-2 text-xs font-semibold shadow-sm transition-all ${
              site.published
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {site.published ? "Unpublish Site" : "🚀 Publish Website"}
          </button>
        </div>
      </div>

      {/* AI Prompt Card */}
      <div className="mt-6 rounded-2xl border hairline bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-ink flex items-center gap-1.5">
            <span>✨</span>
            <span>Describe Your Desired Website Tone & Style</span>
          </label>
          <span className="text-xs text-muted">Powered by Google Gemini</span>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. 'Luxury German automotive aesthetic in Hyderabad, dark emerald green and gold accents, focus on clean luxury cars'"
          rows={2}
          className="focus-ring mt-2 w-full rounded-xl border hairline p-3 text-sm"
        />

        <div className="mt-3">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Quick Prompt Ideas (Click to populate):
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {[
              "Luxury & Premium (Dark Green & Gold, German styling)",
              "Family & Budget Friendly (Affordable cars & reliable SUVs)",
              "Modern & Minimalist (Sleek slate blue, tech-forward)",
              "Trust & Heritage (Classic navy, 100% verified focus)",
            ].map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setPrompt(idea)}
                className="rounded-lg border hairline bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-primary hover:text-primary transition-colors"
              >
                + {idea}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={generating || !prompt.trim()}
            className="focus-ring rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-paper hover:bg-primary-light disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {generating ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                <span>Generating with AI…</span>
              </>
            ) : (
              <span>✨ Generate / Regenerate with AI</span>
            )}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-danger bg-red-50 p-3 rounded-xl border border-red-200">{error}</p>}
        {message && (
          <p className="mt-3 text-sm text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            {message}
          </p>
        )}
      </div>

      {/* Main Two-Column Layout: Left Editor, Right Live Preview */}
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* Left Column: Editor Controls (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Subdomain & Custom Domain Settings */}
          <div className="rounded-2xl border hairline bg-white p-5 shadow-sm space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">TrustDrive Subdomain</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={subdomainInput}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                    setSubdomainInput(val);
                    setSubdomainStatus(null);
                  }}
                  className="focus-ring w-44 rounded-lg border hairline px-3 py-1.5 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={checkSubdomain}
                  className="focus-ring rounded-full border hairline px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary"
                >
                  Check
                </button>
                {subdomainStatus === "checking" && <span className="text-xs text-muted">Checking…</span>}
                {subdomainStatus && subdomainStatus !== "checking" && (
                  <span className={`text-xs font-semibold ${subdomainStatus.available ? "text-emerald-700" : "text-danger"}`}>
                    {subdomainStatus.available ? "✓ Available" : "✗ Unavailable"}
                  </span>
                )}
                {subdomainStatus?.available && subdomainInput !== site.subdomain && (
                  <button
                    type="button"
                    onClick={saveSubdomain}
                    className="focus-ring rounded-full bg-primary px-3 py-1 text-xs font-medium text-paper"
                  >
                    Save Address
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Live link: <Link to={`/site/${site.subdomain}`} target="_blank" className="text-primary underline font-mono">/site/{site.subdomain}</Link>
              </p>
            </div>

            <div className="border-t hairline pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">Custom Domain (Optional)</h3>
                <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-mono text-muted">DNS CNAME</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  placeholder="e.g. www.primemotors.in"
                  value={site.customDomain || ""}
                  onChange={(e) => setSite((s) => ({ ...s, customDomain: e.target.value.trim().toLowerCase() }))}
                  className="focus-ring w-full rounded-lg border hairline px-3 py-1.5 text-xs font-mono"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Point your domain's DNS <strong>CNAME</strong> record to <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">cname.trustdrive.in</code>.
              </p>
            </div>
          </div>

          {/* Content & Theme Customizer */}
          <div className="space-y-4 rounded-2xl border hairline bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b hairline pb-3">
              <h2 className="font-display text-base font-semibold text-ink">Customize Content & Theme</h2>
              <span className="text-xs text-muted">Real-time updates</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Hero Headline</label>
              <input
                value={site.hero?.headline || ""}
                onChange={(e) => updateField("hero", "headline", e.target.value)}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Hero Subheadline</label>
              <textarea
                rows={2}
                value={site.hero?.subheadline || ""}
                onChange={(e) => updateField("hero", "subheadline", e.target.value)}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Primary Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={site.theme?.primaryColor || "#0F2A1D"}
                    onChange={(e) => updateField("theme", "primaryColor", e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border hairline"
                  />
                  <span className="font-mono text-xs text-muted">{site.theme?.primaryColor}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Accent Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={site.theme?.accentColor || "#D4AF37"}
                    onChange={(e) => updateField("theme", "accentColor", e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border hairline"
                  />
                  <span className="font-mono text-xs text-muted">{site.theme?.accentColor}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">About Section Heading</label>
              <input
                value={site.about?.heading || ""}
                onChange={(e) => updateField("about", "heading", e.target.value)}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">About Section Body</label>
              <textarea
                rows={3}
                value={site.about?.body || ""}
                onChange={(e) => updateField("about", "body", e.target.value)}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Call to Action Button Text</label>
              <input
                value={site.contact?.ctaText || ""}
                onChange={(e) => updateField("contact", "ctaText", e.target.value)}
                className="focus-ring mt-1 w-full rounded-lg border hairline px-3 py-2 text-sm"
              />
            </div>

            {/* Highlights */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Feature Highlights</label>
              {(site.highlights || []).map((h, i) => (
                <div key={i} className="rounded-xl border hairline bg-slate-50/50 p-3">
                  <input
                    value={h.title || ""}
                    onChange={(e) => updateHighlight(i, "title", e.target.value)}
                    placeholder="Highlight Title"
                    className="focus-ring w-full rounded-lg border hairline bg-white px-2.5 py-1 text-xs font-semibold"
                  />
                  <textarea
                    rows={2}
                    value={h.body || ""}
                    onChange={(e) => updateHighlight(i, "body", e.target.value)}
                    placeholder="Highlight description"
                    className="focus-ring mt-1.5 w-full rounded-lg border hairline bg-white px-2.5 py-1 text-xs text-muted"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="focus-ring w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-paper hover:bg-primary-light disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving Changes…" : "💾 Save Changes"}
            </button>
          </div>
        </div>

        {/* Right Column: Interactive Live Preview (7 cols) */}
        <div className="lg:col-span-7">
          <div className="sticky top-6 overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-xl">
            {/* Preview Window Chrome */}
            <div className="flex items-center justify-between border-b hairline bg-slate-100 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-rose-400 inline-block"></span>
                <span className="h-3 w-3 rounded-full bg-amber-400 inline-block"></span>
                <span className="h-3 w-3 rounded-full bg-emerald-400 inline-block"></span>
                <span className="ml-2 font-mono text-xs text-slate-500 truncate max-w-xs">
                  {site.subdomain}.trustdrive.in
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors ${
                    previewDevice === "desktop" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  🖥️ Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors ${
                    previewDevice === "mobile" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  📱 Mobile
                </button>
              </div>
            </div>

            {/* Scrollable Preview Canvas */}
            <div
              className={`mx-auto transition-all duration-300 ${
                previewDevice === "mobile"
                  ? "max-w-sm border-x hairline my-4 rounded-xl shadow-inner"
                  : "w-full"
              }`}
            >
              <div className="h-[680px] overflow-y-auto bg-white">
                <MicrositeView
                  site={site}
                  dealer={effectiveDealer}
                  vehicles={dealerVehicles}
                  reviews={[
                    { id: "r-1", buyerName: "Kiran R.", rating: 5, comment: "100% transparent pricing and flawless RC paperwork transfer." },
                    { id: "r-2", buyerName: "Sanjay M.", rating: 5, comment: "Excellent condition car, exactly as described on the website." },
                  ]}
                  preview
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
