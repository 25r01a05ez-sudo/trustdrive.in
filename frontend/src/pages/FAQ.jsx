import { useState } from "react";

const FAQS = [
  {
    q: "How is a car actually verified on TrustDrive India?",
    a: "Every dealer submits GST and KYC documents before they can list anything, and our team reviews those manually. Separately, each car's registration number and chassis number are checked against VAHAN (India's government vehicle registry) — that check covers registration status, ownership history, insurance, PUC, and any financier/hypothecation on the vehicle. A listing only goes live once both the dealer and the specific car pass.",
  },
  {
    q: "What if a dealer's documents don't pass verification?",
    a: "Their account stays pending and none of their listings go public until our team approves them. If something looks off, we reach out on WhatsApp to sort it out before making a decision.",
  },
  {
    q: "What if a car fails the RC/VAHAN check?",
    a: "The listing is marked declined and stays hidden from buyers. The dealer sees exactly why (usually a mismatched chassis number or an inactive registration) and can correct the details and re-run the check.",
  },
  {
    q: "Is buying through TrustDrive India free?",
    a: "Yes — browsing, contacting dealers, and submitting enquiries are all free for buyers.",
  },
  {
    q: "How do I contact a dealer?",
    a: "Every listing has a contact form that reaches the dealer directly over WhatsApp, call, or email — TrustDrive India doesn't sit in between your conversation.",
  },
  {
    q: "How long does dealer verification take?",
    a: "Usually within 48 hours of submitting your documents, once you've also sent them to us on WhatsApp for manual review.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink">Frequently asked questions</h1>
      <p className="mt-2 text-sm text-muted">Everything about how verification, buying, and selling works on TrustDrive India.</p>

      <div className="mt-8 divide-y divide-line border-y hairline">
        {FAQS.map((item, i) => (
          <div key={item.q}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? -1 : i)}
              className="focus-ring flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span className="font-display text-base font-semibold text-ink">{item.q}</span>
              <span className={`shrink-0 text-lg text-muted transition-transform ${openIndex === i ? "rotate-45" : ""}`}>+</span>
            </button>
            {openIndex === i && <p className="pb-5 text-sm leading-relaxed text-muted">{item.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
