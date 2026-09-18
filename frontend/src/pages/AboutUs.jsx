export default function AboutUs() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold-dark">About TrustDrive India</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink">
        Buying a used car shouldn't mean betting on paperwork.
      </h1>

      <div className="mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>
          Used-car buying in India runs almost entirely on trust between strangers — trust that the
          registration matches the car in front of you, that the dealer is who they say they are, and
          that there's no hidden loan sitting against the vehicle. Most of the time it works out. When
          it doesn't, the buyer is the one who finds out at the RTO.
        </p>
        <p>
          TrustDrive India exists to move that trust earlier in the process. Every dealer goes through GST and
          KYC verification before they can list a single car. Every listing's registration and chassis
          number are checked against VAHAN, the government's own vehicle registry, before it's shown to
          a buyer. If either check fails, the listing simply doesn't go live — no exceptions, no
          "trust us."
        </p>
        <p>
          We're based in Hyderabad and started here first, working directly with local dealers to make
          the verification process fast enough that it doesn't get in anyone's way, and thorough enough
          that "verified" on this site actually means something.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          ["GST + KYC checked", "Every dealer, before their first listing goes live."],
          ["VAHAN-verified", "Every registration and chassis number, cross-checked with government records."],
          ["Direct contact", "Buyers reach dealers straight over WhatsApp, call, or email — no middleman."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border hairline bg-white p-5">
            <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
