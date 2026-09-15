/**
 * Generates a dealer's microsite content from a text prompt.
 *
 * IMPORTANT SECURITY DESIGN: the AI (or the fallback generator) never
 * produces raw HTML. It only fills in a small, fixed set of plain-text
 * fields (headline, about text, etc.), which the frontend renders as plain
 * React text (auto-escaped, never dangerouslySetInnerHTML). This means a
 * malicious or manipulated prompt cannot inject a script into a page that
 * gets served to real buyers on a dealer's public subdomain. Every AI
 * response is re-validated against this same schema before it's ever saved
 * -- if the model returns anything unexpected, we fall back to the
 * template generator instead of trusting it blindly.
 *
 * A dealer's actual inventory (cars, prices, verification badges) is NEVER
 * part of this AI-generated content -- it's always pulled live from the
 * real listings data when the site is rendered, so a dealer's AI-written
 * "about us" blurb can never misrepresent what's actually for sale.
 */

const MAX_LEN = {
  headline: 90,
  subheadline: 160,
  aboutHeading: 50,
  aboutBody: 600,
  highlightTitle: 50,
  highlightBody: 140,
  ctaText: 40,
};
const ALLOWED_FONTS = ["serif", "sans"];
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
];

function clampText(value, maxLen, fallback) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/<[^>]*>/g, "").trim(); // strip anything HTML-tag-shaped
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLen);
}

/**
 * Validates and clamps a candidate site payload into the exact shape we store and render.
 */
function sanitizeSiteContent(candidate, dealer = {}) {
  const c = candidate || {};
  const theme = c.theme || {};
  const hero = c.hero || {};
  const about = c.about || {};
  const contact = c.contact || {};
  const highlightsIn = Array.isArray(c.highlights) ? c.highlights : [];

  const dealerName = dealer.name || "Our Dealership";
  const dealerCity = dealer.city || "Hyderabad";

  return {
    theme: {
      primaryColor: HEX_COLOR.test(theme.primaryColor) ? theme.primaryColor : "#1A3A30",
      accentColor: HEX_COLOR.test(theme.accentColor) ? theme.accentColor : "#B49054",
      font: ALLOWED_FONTS.includes(theme.font) ? theme.font : "serif",
    },
    hero: {
      headline: clampText(
        hero.headline || hero.title,
        MAX_LEN.headline,
        `${dealerName} — Quality Used Cars in ${dealerCity}`
      ),
      subheadline: clampText(
        hero.subheadline || hero.subtitle,
        MAX_LEN.subheadline,
        "Browse our verified inventory and reach out directly — no middleman, no pressure."
      ),
    },
    about: {
      heading: clampText(about.heading, MAX_LEN.aboutHeading, `About ${dealerName}`),
      body: clampText(
        about.body || about.description,
        MAX_LEN.aboutBody,
        `${dealerName} is a verified dealership based in ${dealerCity}, listed on TrustDrive.`
      ),
    },
    highlights: highlightsIn
      .slice(0, 4)
      .map((h) => ({
        title: clampText(h?.title, MAX_LEN.highlightTitle, "Quality guaranteed"),
        body: clampText(
          h?.body || h?.description,
          MAX_LEN.highlightBody,
          "Every car we list is verified before it goes live."
        ),
      }))
      .filter((h) => h.title && h.body),
    contact: {
      ctaText: clampText(
        contact.ctaText || hero.ctaText,
        MAX_LEN.ctaText,
        "Contact us on WhatsApp"
      ),
    },
  };
}

function templateSite(dealer = {}, prompt = "") {
  const mood = (prompt || "").toLowerCase();
  const premium = /premium|luxury|high.?end|german|bmw|audi|mercedes/.test(mood);
  const family = /family|affordable|budget|hatchback|suv/.test(mood);
  const dealerName = dealer.name || "Our Dealership";
  const dealerCity = dealer.city || "Hyderabad";

  return sanitizeSiteContent(
    {
      theme: premium
        ? { primaryColor: "#1A3A30", accentColor: "#B49054", font: "serif" }
        : { primaryColor: "#0F2942", accentColor: "#C59B27", font: "sans" },
      hero: {
        headline: premium
          ? `${dealerName} — Premium Cars, Honestly Priced`
          : family
          ? `${dealerName} — Reliable Family Cars in ${dealerCity}`
          : `${dealerName} — Verified Used Cars in ${dealerCity}`,
        subheadline:
          "Every listing here is GST-verified and RC-checked against government records before it ever reaches you.",
      },
      about: {
        heading: `Why buy from ${dealerName}`,
        body: `We are a verified dealership on TrustDrive based in ${dealerCity}. Every vehicle we list has passed rigorous registration and document checks.`,
      },
      highlights: [
        {
          title: "Verified inventory",
          body: "Every listing is cross-referenced with government VAHAN records.",
        },
        {
          title: "Direct WhatsApp Contact",
          body: "Reach our dealership directly — zero brokerage or middlemen.",
        },
        {
          title: "Transparent History",
          body: `Proudly serving buyers across ${dealerCity} with verified ownership history.`,
        },
      ],
      contact: { ctaText: "Contact us on WhatsApp" },
    },
    dealer
  );
}

/**
 * Calls Gemini or Claude to generate site content from the dealer's prompt.
 */
async function generateSite(prompt, dealer = {}) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const systemInstruction =
    "You write sleek, honest marketing copy for used-car dealership microsites. " +
    "Never invent specific claims about awards, years in business, or inventory counts " +
    "that were not given. Respond with ONLY a valid JSON object matching exactly this shape: " +
    '{"theme":{"primaryColor":"#HEXCOLOR","accentColor":"#HEXCOLOR","font":"serif|sans"},' +
    '"hero":{"headline":"...","subheadline":"..."},"about":{"heading":"...","body":"..."},' +
    '"highlights":[{"title":"...","body":"..."},{"title":"...","body":"..."},{"title":"...","body":"..."}],' +
    '"contact":{"ctaText":"..."}}';

  const userPrompt = `Dealership name: ${dealer.name || "Pre-Owned Dealership"}\nCity: ${
    dealer.city || "Hyderabad"
  }\nDealer's prompt/tone preferences: "${prompt}"\n\nGenerate the dealer microsite JSON now.`;

  // 1. Try Google Gemini with modern model cascade
  if (geminiKey) {
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const cleanedText = rawText.replace(/```json\s*|```/g, "").trim();
          const parsed = JSON.parse(cleanedText);
          console.log(`[aiSiteGenerator] Generated site successfully using ${model}`);
          return sanitizeSiteContent(parsed, dealer);
        } else {
          console.warn(`[aiSiteGenerator] Gemini ${model} returned ${res.status}`);
        }
      } catch (err) {
        console.warn(`[aiSiteGenerator] Gemini ${model} error: ${err.message}`);
      }
    }
  }

  // 2. Try Anthropic Claude if configured
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 1000,
          system: systemInstruction,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = (data.content || []).find((b) => b.type === "text")?.text || "";
        const cleanedText = text.replace(/```json\s*|```/g, "").trim();
        const parsed = JSON.parse(cleanedText);
        return sanitizeSiteContent(parsed, dealer);
      }
    } catch (err) {
      console.warn(`[aiSiteGenerator] Anthropic error: ${err.message}`);
    }
  }

  // 3. Fallback to smart template
  console.log("[aiSiteGenerator] Using fallback template generator");
  return templateSite(dealer, prompt);
}

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "ftp",
  "trustdrive",
  "blog",
  "help",
  "support",
  "status",
  "static",
  "assets",
  "cdn",
  "dashboard",
  "login",
  "signup",
]);

function slugifySubdomain(input) {
  return (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function isValidSubdomain(slug) {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug) && !RESERVED_SUBDOMAINS.has(slug);
}

module.exports = { generateSite, sanitizeSiteContent, slugifySubdomain, isValidSubdomain };
