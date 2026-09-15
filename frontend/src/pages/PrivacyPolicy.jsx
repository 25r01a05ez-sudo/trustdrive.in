export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold-dark">Legal</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: August 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink">
        <section>
          <h2 className="font-display text-lg font-semibold text-ink">What we collect</h2>
          <p className="mt-2 text-muted">
            <strong className="text-ink">Buyers:</strong> name and phone number, only when you submit
            an enquiry on a listing. We don't require an account to browse.
          </p>
          <p className="mt-2 text-muted">
            <strong className="text-ink">Dealers:</strong> business details, PAN, Aadhaar or another
            government ID, GST registration, bank account details, dealership photos, and owner contact
            information — submitted through our dealer verification form so we can confirm you're a real,
            operating dealership before your listings go live.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">How dealer documents are protected</h2>
          <p className="mt-2 text-muted">
            Dealer verification data — PAN, Aadhaar, bank details, and uploaded document content — is
            encrypted before it's stored, using AES-256 with a key that's never exposed to the application
            itself. It's only decrypted when an admin reviews your application. It is never included in
            any public API response, listing page, or dealer profile — buyers never see it.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">How long we keep it</h2>
          <p className="mt-2 text-muted">
            If your dealer application is rejected, we delete your submitted documents (PAN, Aadhaar,
            bank details, photos) immediately — we keep only a record that an application was made and
            declined, not the documents themselves. If you're approved, we retain your verification
            documents for as long as your dealer account is active, so we can respond to disputes or
            re-verify if needed. You can request deletion of your account and associated documents at any
            time — see "Your rights" below.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Who else sees it</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
            <li>
              When you submit a dealer application, a summary (your business name, GSTIN, PAN number, and
              contact details — not document content) is sent to our team via WhatsApp so we can review it
              quickly. This uses either Meta's WhatsApp Business platform or a direct WhatsApp link,
              depending on how the platform is configured.
            </li>
            <li>
              Vehicle registration numbers are checked against a government-vehicle-records API (VAHAN or
              a licensed data provider) to verify the car's registration status, insurance, and PUC — we
              share only the registration and chassis number for this check, nothing else.
            </li>
            <li>We don't sell or rent your data to advertisers or other third parties.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Vehicle registration numbers</h2>
          <p className="mt-2 text-muted">
            A car's full registration number is never shown to buyers browsing the platform — only to the
            dealer who listed it and to our admin team. Buyers see it directly from the dealer once they
            connect, the same way they would in person.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Your rights</h2>
          <p className="mt-2 text-muted">
            You can ask us what data we hold about you, correct it, or request that we delete it, by
            reaching out on WhatsApp or email (see the footer). We'll respond within a reasonable time and
            confirm once it's done.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Questions</h2>
          <p className="mt-2 text-muted">
            If anything here is unclear, or you want to exercise any of the rights above, contact us on
            WhatsApp or at support@trustdrive.in.
          </p>
        </section>
      </div>
    </div>
  );
}
