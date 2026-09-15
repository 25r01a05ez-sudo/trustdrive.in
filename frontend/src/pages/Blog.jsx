import { useState } from "react";

const POSTS = [
  {
    title: "How to read an RC before you hand over any money",
    date: "2026-06-02",
    excerpt: "The registration certificate tells you almost everything that matters — if you know where to look.",
    body: "The registration certificate (RC) is the single most important document in a used-car purchase, and most buyers only glance at it. Check the registration status first — it should say ACTIVE, not suspended or cancelled. Match the chassis and engine numbers stamped on the RC against the numbers physically on the car; a mismatch is the clearest sign of a swapped or stolen vehicle. Check the 'Financier' field: if a bank or NBFC is listed there, the car still has an active loan against it (hypothecation), and you shouldn't buy it until that's cleared and the RC is updated. Finally, check the registration date against the odometer reading — a car with implausibly low kilometers for its age is worth asking harder questions about.",
  },
  {
    title: "Why we check GST and KYC before a dealer lists anything",
    date: "2026-05-18",
    excerpt: "A verified badge only means something if it's hard to get.",
    body: "It would be easy to let any dealer sign up and list cars immediately — it's better for growth numbers in the short term. We don't do that, because a 'verified' badge that everyone has is worse than no badge at all. Every dealer on TrustDrive submits their GST registration and business KYC, and a real person on our team checks it before their first car goes live. It adds friction. It's meant to.",
  },
  {
    title: "Insurance and PUC: the two documents everyone forgets to ask about",
    date: "2026-04-30",
    excerpt: "A great price on a car with lapsed insurance isn't actually a great price.",
    body: "Buyers spend most of their attention on price and kilometers, and almost none on insurance and PUC (Pollution Under Control) status — both of which cost real money to fix if they've lapsed. An expired PUC means the car can't legally be driven until it's renewed, and a gap in insurance coverage can complicate a claim if anything goes wrong in the first weeks after purchase. Ask for both before you finalize anything, not after.",
  },
];

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function Blog() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink">From the TrustDrive blog</h1>
      <p className="mt-2 text-sm text-muted">Notes on buying smart and what verification actually catches.</p>

      <div className="mt-8 space-y-4">
        {POSTS.map((post, i) => (
          <article key={post.title} className="rounded-2xl border hairline bg-white p-6">
            <p className="font-mono text-xs text-muted">{formatDate(post.date)}</p>
            <h2 className="mt-1.5 font-display text-xl font-semibold text-ink">{post.title}</h2>
            <p className="mt-2 text-sm text-muted">{post.excerpt}</p>
            {openIndex === i ? (
              <>
                <p className="mt-4 text-sm leading-relaxed text-ink">{post.body}</p>
                <button onClick={() => setOpenIndex(null)} className="focus-ring mt-4 text-xs font-medium text-primary hover:underline">
                  Show less
                </button>
              </>
            ) : (
              <button onClick={() => setOpenIndex(i)} className="focus-ring mt-4 text-xs font-medium text-primary hover:underline">
                Read more →
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
