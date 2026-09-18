export default function Terms() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold-dark">Legal</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">Dealer Verification Terms</h1>
      <p className="mt-2 text-sm text-muted">Last updated: August 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink">
        <section>
          <h2 className="font-display text-lg font-semibold text-ink">What verification means</h2>
          <p className="mt-2 text-muted">
            A "verified" badge on TrustDrive India means a dealer has submitted GST registration, PAN, and
            supporting business documents, and our team has reviewed them manually. It confirms the
            dealership exists and its registration documents check out — it is not a guarantee about the
            condition, history, or legal status of any specific vehicle, which is checked separately
            through vehicle-level RC/VAHAN verification.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Accuracy of information</h2>
          <p className="mt-2 text-muted">
            By submitting a dealer verification application, you confirm that the information and
            documents you provide are accurate, belong to your dealership, and that you're authorized to
            represent it. Submitting false or altered documents will result in rejection or, for an
            already-approved account, removal from the platform.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Review and decisions</h2>
          <p className="mt-2 text-muted">
            Applications are reviewed manually, typically within 48 hours. We may request additional
            documents or a video call before approving an application. Approval or rejection is at our
            discretion; if rejected, you're welcome to reapply once you can address the reason given.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Ongoing obligations</h2>
          <p className="mt-2 text-muted">
            Once verified, you agree to keep your listings accurate — correct pricing, honest vehicle
            condition, and registration details that match what's on the actual vehicle. We may suspend or
            remove listings, or revoke verification, if we find a pattern of inaccurate listings or
            complaints from buyers.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Data handling</h2>
          <p className="mt-2 text-muted">
            See our <a href="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</a> for
            how your documents and business information are stored and protected.
          </p>
        </section>
      </div>
    </div>
  );
}
