import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Listings from "./pages/Listings";
import VehicleDetail from "./pages/VehicleDetail";
import Dealers from "./pages/Dealers";
import DealerProfile from "./pages/DealerProfile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OtpVerify from "./pages/OtpVerify";
import FAQ from "./pages/FAQ";
import Reviews from "./pages/Reviews";
import AboutUs from "./pages/AboutUs";
import Blog from "./pages/Blog";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import DealerDashboard from "./pages/DealerDashboard";
import DealerSiteBuilder from "./pages/DealerSiteBuilder";
import AdminDashboard from "./pages/AdminDashboard";
import MicrositePage from "./pages/MicrositePage";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/vehicle/:id" element={<VehicleDetail />} />
          <Route path="/dealers" element={<Dealers />} />
          <Route path="/dealer/:id" element={<DealerProfile />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-otp" element={<OtpVerify />} />
          <Route
            path="/dealer"
            element={
              <ProtectedRoute role="dealer">
                <DealerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dealer/website"
            element={
              <ProtectedRoute role="dealer">
                <DealerSiteBuilder />
              </ProtectedRoute>
            }
          />
          <Route path="/site/:subdomain" element={<MicrositePage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-32 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-gold-dark">404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">This page didn't check out.</h1>
      <p className="mt-2 text-sm text-muted">The link you followed doesn't match anything on TrustDrive.</p>
    </div>
  );
}
