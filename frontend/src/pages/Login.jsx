import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

export default function Login() {
  const { login, sendOtp } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState("login"); // 'login' | 'forgot_step1' | 'forgot_step2'
  const [form, setForm] = useState({ email: "", password: "" });
  const [forgotData, setForgotData] = useState({ email: "", otp: "", newPassword: "", confirmPassword: "", devOtp: "" });
  
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingAction, setLoadingAction] = useState(null); // 'login' | 'otp' | 'reset' | null

  // 1. Direct Password Login
  const handlePasswordLogin = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccessMessage("");
    if (!form.email || !form.password) {
      setError("Please enter both email and password.");
      return;
    }
    setLoadingAction("login");
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === "dealer" ? "/dealer" : user.role === "admin" ? "/admin" : "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. Passwordless OTP Login (Only requires Email!)
  const handleOtpLogin = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccessMessage("");
    if (!form.email.trim()) {
      setError("Please enter your email address to receive an OTP.");
      return;
    }
    setLoadingAction("otp");
    try {
      const res = await sendOtp({ mode: "login", email: form.email.trim() });
      navigate("/verify-otp", {
        state: {
          email: form.email.trim(),
          mode: "login",
          devOtp: res.devOtp,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. Forgot Password - Step 1: Send Reset OTP
  const handleSendResetOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    if (!forgotData.email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }
    setLoadingAction("reset_send");
    try {
      const res = await sendOtp({ mode: "reset-password", email: forgotData.email.trim() });
      setForgotData((d) => ({ ...d, devOtp: res.devOtp || "" }));
      setSuccessMessage("Verification code sent to your email!");
      setView("forgot_step2");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. Forgot Password - Step 2: Confirm OTP & Set New Password
  const handleConfirmResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    if (!forgotData.otp || forgotData.otp.length < 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }
    if (!forgotData.newPassword || forgotData.newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (forgotData.newPassword !== forgotData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoadingAction("reset_confirm");
    try {
      const res = await api.resetPassword({
        email: forgotData.email.trim(),
        otp: forgotData.otp.trim(),
        newPassword: forgotData.newPassword,
      });

      if (res.token) {
        localStorage.setItem("td_token", res.token);
        setSuccessMessage("Password reset successfully! Redirecting…");
        setTimeout(() => {
          navigate(res.user?.role === "dealer" ? "/dealer" : res.user?.role === "admin" ? "/admin" : "/");
        }, 1000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        
        {/* ===================== VIEW 1: REGULAR SIGN IN ===================== */}
        {view === "login" && (
          <>
            <div className="text-center">
              <h2 className="text-4xl font-serif font-bold text-gray-900 tracking-tight">
                Sign in
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Welcome back to TrustDrive.
              </p>
            </div>

            <form onSubmit={handlePasswordLogin} className="mt-8 space-y-6">
              <div className="rounded-md space-y-4">
                {/* Email Input */}
                <div>
                  <label className="sr-only" htmlFor="email-address">
                    Email address
                  </label>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Email address"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="appearance-none relative block w-full px-4 py-3 border border-blue-200 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a3c34] focus:border-[#1a3c34] sm:text-sm bg-[#eef2ff] transition-all"
                  />
                </div>

                {/* Password Input */}
                <div>
                  <label className="sr-only" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password (leave blank if signing in with OTP)"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="appearance-none relative block w-full px-4 py-3 border border-blue-200 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a3c34] focus:border-[#1a3c34] sm:text-sm bg-[#eef2ff] transition-all"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setSuccessMessage("");
                        setForgotData((d) => ({ ...d, email: form.email }));
                        setView("forgot_step1");
                      }}
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3 border border-red-200 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-4">
                <button
                  type="submit"
                  disabled={loadingAction !== null}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-full text-white bg-[#1a3c34] hover:bg-[#234d43] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1a3c34] transition-all shadow-sm disabled:opacity-60"
                >
                  {loadingAction === "login" ? "Signing in…" : "Login with Password"}
                </button>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink mx-4 text-gray-500 text-xs uppercase tracking-widest font-semibold">
                    or
                  </span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <button
                  type="button"
                  onClick={handleOtpLogin}
                  disabled={loadingAction !== null}
                  className="group relative w-full flex justify-center py-3 px-4 border border-slate-300 text-sm font-semibold rounded-full text-slate-800 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1a3c34] transition-all shadow-sm disabled:opacity-60"
                >
                  {loadingAction === "otp" ? "Sending OTP…" : "📱 Continue with OTP (Passwordless)"}
                </button>
              </div>

              {/* Registration Link */}
              <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                  New here?{" "}
                  <Link to="/signup" className="font-medium text-gray-900 hover:underline">
                    Create an account
                  </Link>
                </p>
              </div>
            </form>
          </>
        )}

        {/* ===================== VIEW 2: FORGOT PASSWORD (STEP 1) ===================== */}
        {view === "forgot_step1" && (
          <div className="rounded-2xl border hairline bg-white p-8 shadow-sm space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-serif font-bold text-gray-900">
                Reset your password
              </h2>
              <p className="mt-1.5 text-xs text-gray-600">
                Enter your registered email address and we'll send you a 6-digit verification code.
              </p>
            </div>

            <form onSubmit={handleSendResetOtp} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700">Email address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. your-email@gmail.com"
                  value={forgotData.email}
                  onChange={(e) => setForgotData((d) => ({ ...d, email: e.target.value }))}
                  className="mt-1 block w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c34]"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 border border-red-200 text-xs font-semibold text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loadingAction === "reset_send"}
                className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#1a3c34] hover:bg-[#234d43] transition-all shadow-sm disabled:opacity-60"
              >
                {loadingAction === "reset_send" ? "Sending Code…" : "Send Reset Code →"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setView("login");
                }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-900 underline"
              >
                Back to Sign in
              </button>
            </form>
          </div>
        )}

        {/* ===================== VIEW 3: FORGOT PASSWORD (STEP 2) ===================== */}
        {view === "forgot_step2" && (
          <div className="rounded-2xl border hairline bg-white p-8 shadow-sm space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-serif font-bold text-gray-900">
                Set new password
              </h2>
              <p className="mt-1.5 text-xs text-gray-600">
                We sent a 6-digit code to <strong>{forgotData.email}</strong>.
              </p>
            </div>

            {forgotData.devOtp && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 flex items-center justify-between text-xs text-blue-700">
                <span>💡 Code: <strong>{forgotData.devOtp}</strong></span>
                <button
                  type="button"
                  onClick={() => setForgotData((d) => ({ ...d, otp: d.devOtp }))}
                  className="bg-blue-600 text-white px-2 py-1 rounded text-[11px] font-bold"
                >
                  Auto-fill
                </button>
              </div>
            )}

            <form onSubmit={handleConfirmResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700">6-Digit Verification Code</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={forgotData.otp}
                  onChange={(e) => setForgotData((d) => ({ ...d, otp: e.target.value.replace(/\D/g, "") }))}
                  className="mt-1 block w-full px-4 py-2.5 border border-gray-300 rounded-xl text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1a3c34]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={forgotData.newPassword}
                  onChange={(e) => setForgotData((d) => ({ ...d, newPassword: e.target.value }))}
                  className="mt-1 block w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c34]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={forgotData.confirmPassword}
                  onChange={(e) => setForgotData((d) => ({ ...d, confirmPassword: e.target.value }))}
                  className="mt-1 block w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c34]"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 border border-red-200 text-xs font-semibold text-red-600">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-xs font-semibold text-emerald-700">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loadingAction === "reset_confirm"}
                className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#1a3c34] hover:bg-[#234d43] transition-all shadow-sm disabled:opacity-60"
              >
                {loadingAction === "reset_confirm" ? "Updating Password…" : "Save New Password & Sign In"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setView("login");
                }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-900 underline"
              >
                Cancel and back to Sign in
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
