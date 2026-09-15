import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import DealerVerificationForm from "./DealerVerificationForm";

export default function Signup() {
  const { sendOtp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "buyer" });
  const [step, setStep] = useState(1); // 2 = dealer verification wizard after account creation
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dealerError, setDealerError] = useState("");
  const [waLink, setWaLink] = useState(null);

  const submitAccount = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Send OTP — account is staged on backend until OTP confirmed
      const res = await sendOtp({ mode: "signup", ...form });
      navigate("/verify-otp", {
        state: {
          email: form.email,
          mode: "signup",
          // Pass full payload so Resend can re-trigger staging
          signupPayload: { mode: "signup", ...form },
          password: form.password,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitDealer = async (dealerVerificationData) => {
    setDealerError("");
    setSubmitting(true);
    try {
      const currentToken = localStorage.getItem("td_token");
      const payload = {
        name: dealerVerificationData.businessName,
        gstNumber: dealerVerificationData.gstin,
        city: dealerVerificationData.city,
        address: dealerVerificationData.address,
        verification: dealerVerificationData,
      };
      const { whatsappLink } = await api.registerDealer(payload, currentToken);
      setWaLink(whatsappLink);
      setStep(3);
    } catch (err) {
      setDealerError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 2) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-display text-3xl font-bold text-ink">Dealer Registration</h1>
        <p className="mt-1 text-sm text-muted">
          Register your showroom details in under 1 minute to start listing inventory.
        </p>
        <div className="mt-6">
          <DealerVerificationForm
            onSubmit={submitDealer}
            submitting={submitting}
            error={dealerError}
            initialData={{ businessName: form.name, whatsapp: form.phone }}
          />
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Registration submitted</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We've received your details and will review them manually — usually within 48 hours.
          You'll see your dealer badge appear once you're approved.
        </p>
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="focus-ring mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-paper hover:bg-primary-light"
          >
            Send your documents on WhatsApp →
          </a>
        )}
        <button
          onClick={() => navigate("/dealer")}
          className="focus-ring mt-4 block w-full text-sm text-muted underline underline-offset-2"
        >
          Go to my dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-20">
      <h1 className="font-display text-3xl font-semibold text-ink">Create an account</h1>

      <div className="mt-6 flex rounded-full border hairline p-1 text-sm">
        {["buyer", "dealer"].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setForm((f) => ({ ...f, role: r }))}
            className={`focus-ring flex-1 rounded-full py-2 capitalize transition-colors ${
              form.role === r ? "bg-primary text-paper" : "text-muted"
            }`}
          >
            {r === "buyer" ? "I'm buying" : "Are you a dealer?"}
          </button>
        ))}
      </div>

      <form onSubmit={submitAccount} className="mt-6 space-y-4">
        <input required placeholder="Full name" value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="focus-ring w-full rounded-lg border hairline px-3 py-2.5 text-sm" />
        <input required type="email" placeholder="Email" value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="focus-ring w-full rounded-lg border hairline px-3 py-2.5 text-sm" />
        <input placeholder="Phone" value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="focus-ring w-full rounded-lg border hairline px-3 py-2.5 text-sm" />
        <input required type="password" placeholder="Password" value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          className="focus-ring w-full rounded-lg border hairline px-3 py-2.5 text-sm" />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button disabled={loading} className="focus-ring w-full rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-paper hover:bg-primary-light disabled:opacity-60">
          {loading ? "Creating…" : form.role === "dealer" ? "Continue to dealer verification" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
