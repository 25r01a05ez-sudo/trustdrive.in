import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

export default function OtpVerify() {
  const { verifyOtp, sendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State passed from Login or Signup
  const { email = "", mode = "login", signupPayload = null, devOtp = "" } = location.state || {};

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [otpExpiry] = useState(() => Date.now() + 10 * 60 * 1000); // 10 min
  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const [verified, setVerified] = useState(false);

  const inputRefs = useRef([]);

  // Auto-fill devOtp if available for frictionless onboarding
  const autoFillCode = (code) => {
    if (!code) return;
    const chars = String(code).slice(0, OTP_LENGTH).split("");
    const newDigits = Array(OTP_LENGTH).fill("");
    chars.forEach((c, i) => {
      newDigits[i] = c;
    });
    setDigits(newDigits);
    setError("");
  };

  // Focus first box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
    if (devOtp) autoFillCode(devOtp);
  }, [devOtp]);

  // Redirect if no email (direct navigation)
  useEffect(() => {
    if (!email) navigate("/login", { replace: true });
  }, [email, navigate]);

  // OTP expiry countdown
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((otpExpiry - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [otpExpiry]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError("");
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "Backspace") {
      const newDigits = [...digits];
      newDigits[index] = "";
      setDigits(newDigits);
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => { newDigits[i] = ch; });
    setDigits(newDigits);
    const nextEmpty = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[nextEmpty]?.focus();
  };

  const handleSubmit = useCallback(async () => {
    const otp = digits.join("");
    if (otp.length < OTP_LENGTH) {
      setError("Please enter all 6 digits.");
      return;
    }
    if (timeLeft === 0) {
      setError("This OTP has expired. Please request a new one.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = await verifyOtp({ mode, email, otp, signupPayload });
      setVerified(true);
      setTimeout(() => {
        // For signup dealers: redirect to /dealer — the dashboard handles
        // showing the verification wizard for newly created, unverified dealers.
        navigate(
          user.role === "dealer" ? "/dealer" : user.role === "admin" ? "/admin" : "/",
          { replace: true }
        );
      }, 1200);
    } catch (err) {
      setError(err.message);
      // Shake the inputs
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [digits, email, mode, navigate, timeLeft, verifyOtp, signupPayload]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const payload = mode === "signup" && signupPayload
        ? { ...signupPayload, mode: "signup" }
        : { mode: "login", email, password: location.state?.password };
      await sendOtp(payload);
      setDigits(Array(OTP_LENGTH).fill(""));
      setResendCooldown(RESEND_COOLDOWN);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  const expiredOtp = timeLeft === 0;
  const allFilled = digits.every(Boolean);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
      padding: "24px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(212, 175, 55, 0.2)",
        borderRadius: "24px",
        padding: "48px 40px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative glow */}
        <div style={{
          position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)",
          width: "200px", height: "200px",
          background: "radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Icon */}
        <div style={{
          width: "72px", height: "72px", borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05))",
          border: "1px solid rgba(212,175,55,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
          fontSize: "32px",
          transition: "transform 0.3s",
          transform: verified ? "scale(1.15)" : "scale(1)",
        }}>
          {verified ? "✅" : "📧"}
        </div>

        <h1 style={{
          margin: "0 0 8px",
          fontSize: "26px", fontWeight: 700,
          color: "#ffffff",
          letterSpacing: "-0.5px",
        }}>
          {verified ? "Verified!" : "Check your email"}
        </h1>

        <p style={{ margin: "0 0 6px", fontSize: "14px", color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
          {verified
            ? "You're all set. Redirecting…"
            : <>We sent a 6-digit code to<br /><strong style={{ color: "#d4af37" }}>{email}</strong></>}
        </p>

        {!verified && (
          <>
            {/* Timer */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              margin: "12px 0 32px",
              padding: "6px 14px", borderRadius: "99px",
              background: expiredOtp
                ? "rgba(239,68,68,0.15)"
                : "rgba(212,175,55,0.1)",
              border: `1px solid ${expiredOtp ? "rgba(239,68,68,0.3)" : "rgba(212,175,55,0.2)"}`,
            }}>
              <span style={{ fontSize: "12px" }}>{expiredOtp ? "⏰" : "⏱"}</span>
              <span style={{
                fontSize: "13px", fontWeight: 600,
                color: expiredOtp ? "#f87171" : "#d4af37",
                fontVariantNumeric: "tabular-nums",
              }}>
                {expiredOtp ? "Code expired" : `Expires in ${formatTime(timeLeft)}`}
              </span>
            </div>

            {/* Dev / Demo Auto-fill Helper */}
            {devOtp && (
              <div
                style={{
                  margin: "0 auto 20px",
                  maxWidth: "340px",
                  padding: "8px 14px",
                  borderRadius: "12px",
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  fontSize: "12px",
                  color: "#93c5fd",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <span>💡 Code: <strong style={{ color: "#ffffff", letterSpacing: "2px" }}>{devOtp}</strong></span>
                <button
                  type="button"
                  onClick={() => autoFillCode(devOtp)}
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Auto-fill
                </button>
              </div>
            )}

            {/* OTP inputs */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "28px" }}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-digit-${i}`}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  disabled={loading || expiredOtp}
                  style={{
                    width: "48px", height: "58px",
                    textAlign: "center",
                    fontSize: "22px", fontWeight: 700,
                    background: digit
                      ? "rgba(212,175,55,0.15)"
                      : "rgba(255,255,255,0.06)",
                    border: `2px solid ${
                      error ? "rgba(239,68,68,0.6)"
                        : digit ? "rgba(212,175,55,0.6)"
                        : "rgba(255,255,255,0.12)"
                    }`,
                    borderRadius: "12px",
                    color: "#ffffff",
                    outline: "none",
                    transition: "all 0.15s",
                    caretColor: "#d4af37",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(212,175,55,0.8)";
                    e.target.style.background = "rgba(212,175,55,0.1)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(212,175,55,0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = digit ? "rgba(212,175,55,0.6)" : "rgba(255,255,255,0.12)";
                    e.target.style.background = digit ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.06)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                margin: "0 0 20px",
                padding: "10px 14px",
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "10px",
                fontSize: "13px", color: "#f87171", lineHeight: 1.4,
              }}>
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              id="otp-submit-btn"
              onClick={handleSubmit}
              disabled={loading || !allFilled || expiredOtp}
              style={{
                width: "100%", padding: "14px",
                borderRadius: "12px", border: "none",
                background: allFilled && !expiredOtp
                  ? "linear-gradient(135deg, #d4af37, #f5d36e)"
                  : "rgba(255,255,255,0.08)",
                color: allFilled && !expiredOtp ? "#1a1a2e" : "rgba(255,255,255,0.3)",
                fontSize: "15px", fontWeight: 700,
                cursor: allFilled && !expiredOtp ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                letterSpacing: "0.3px",
              }}
              onMouseEnter={(e) => {
                if (allFilled && !expiredOtp && !loading)
                  e.target.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; }}
            >
              {loading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    width: "16px", height: "16px", border: "2px solid #1a1a2e",
                    borderTopColor: "transparent", borderRadius: "50%",
                    display: "inline-block", animation: "spin 0.7s linear infinite",
                  }} />
                  Verifying…
                </span>
              ) : "Verify code"}
            </button>

            {/* Resend */}
            <div style={{ marginTop: "20px", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
              Didn't receive it?{" "}
              <button
                id="otp-resend-btn"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resending}
                style={{
                  background: "none", border: "none", padding: "0",
                  color: resendCooldown > 0 ? "rgba(212,175,55,0.4)" : "#d4af37",
                  fontWeight: 600, fontSize: "13px",
                  cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                  textDecoration: resendCooldown === 0 ? "underline" : "none",
                  transition: "color 0.2s",
                }}
              >
                {resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>

            {/* Back link */}
            <button
              onClick={() => navigate(mode === "signup" ? "/signup" : "/login")}
              style={{
                marginTop: "16px", background: "none", border: "none",
                color: "rgba(255,255,255,0.3)", fontSize: "12px",
                cursor: "pointer", textDecoration: "underline",
              }}
            >
              ← Back to {mode === "signup" ? "sign up" : "sign in"}
            </button>
          </>
        )}

        {/* Spinner keyframes */}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
