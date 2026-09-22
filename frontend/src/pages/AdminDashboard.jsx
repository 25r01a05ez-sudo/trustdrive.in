import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import DealerDocumentsViewer from "../components/DealerDocumentsViewer";
import VehicleImage from "../components/VehicleImage";

function formatINR(n) {
  return new Intl.NumberFormat("en-IN").format(n || 0);
}

const QUICK_REJECT_REASONS = [
  "Chassis number mismatch with VAHAN records",
  "Invalid or unreadable RC document",
  "Incorrect vehicle model or year specified",
  "Suspicious pricing or mileage discrepancy",
  "Duplicate vehicle listing already active",
  "High hypothecation / uncleared financier lien",
];

export default function AdminDashboard() {
  const { getToken, user } = useAuth();
  const [activeTab, setActiveTab] = useState("vehicle-approvals");
  const [pendingDealers, setPendingDealers] = useState([]);
  const [allDealers, setAllDealers] = useState([]);
  const [stats, setStats] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [expandedDealerId, setExpandedDealerId] = useState(null);
  const [verificationCache, setVerificationCache] = useState({});
  const [editingDealer, setEditingDealer] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Coupon Builder state
  const [coupons, setCoupons] = useState([]);
  const [submittingCoupon, setSubmittingCoupon] = useState(false);
  const [couponCopied, setCouponCopied] = useState("");
  const [couponFilter, setCouponFilter] = useState("all");
  const [couponSearch, setCouponSearch] = useState("");
  const [couponForm, setCouponForm] = useState({
    code: "DEALER20-" + Math.random().toString(36).substring(2, 6).toUpperCase(),
    discountType: "percent",
    discountValue: 20,
    usageLimit: 1,
    expiresAt: "",
    active: true,
  });

  // Vehicle reject modal state
  const [rejectingVehicle, setRejectingVehicle] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [processingId, setProcessingId] = useState(null);

  const refresh = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const [pDealers, dList, pStats, vList, logs, cList] = await Promise.all([
        api.pendingDealers(token).catch(() => ({ dealers: [] })),
        api.listDealers().catch(() => ({ dealers: [] })),
        api.platformAnalytics(token).catch(() => null),
        api.getAllVehicles(token).catch(() => ({ vehicles: [] })),
        api.getAuditLogs(token).catch(() => ({ logs: [] })),
        api.listCoupons(token).catch(() => ({ coupons: [] })),
      ]);

      setPendingDealers(pDealers.dealers || []);
      setAllDealers(dList.dealers || []);
      setStats(pStats);
      setVehicles(vList.vehicles || []);
      setAuditLogs(logs.logs || []);
      setCoupons(cList.coupons || []);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    }
  };

  const generateCouponCode = (prefix = "DEALER") => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let rand = "";
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const val = couponForm.discountValue || 20;
    const typeLabel = couponForm.discountType === "percent" ? `${val}` : `FLAT${val}`;
    const code = `${prefix}${typeLabel}-${rand}`;
    setCouponForm((prev) => ({ ...prev, code }));
  };

  const handleCreateCoupon = async (e) => {
    if (e) e.preventDefault();
    if (!couponForm.code.trim()) {
      setErrorMessage("Please specify a coupon code.");
      return;
    }
    const numVal = Number(couponForm.discountValue);
    if (!numVal || numVal <= 0) {
      setErrorMessage("Discount value must be greater than 0.");
      return;
    }
    if (couponForm.discountType === "percent" && numVal > 100) {
      setErrorMessage("Percentage discount cannot exceed 100%.");
      return;
    }

    setSubmittingCoupon(true);
    setErrorMessage("");
    try {
      const token = await getToken();
      await api.createCoupon(
        {
          code: couponForm.code.trim().toUpperCase(),
          discountType: couponForm.discountType,
          discountValue: numVal,
          usageLimit: Number(couponForm.usageLimit || 1),
          expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : null,
          active: couponForm.active,
        },
        token
      );
      setMessage(`Coupon "${couponForm.code.trim().toUpperCase()}" created successfully! Available for dealers.`);
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let rand = "";
      for (let i = 0; i < 4; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
      setCouponForm({
        code: `DEALER20-${rand}`,
        discountType: "percent",
        discountValue: 20,
        usageLimit: 1,
        expiresAt: "",
        active: true,
      });
      refresh();
    } catch (err) {
      setErrorMessage(err.message || "Failed to create coupon");
    } finally {
      setSubmittingCoupon(false);
    }
  };

  const handleToggleCoupon = async (coupon) => {
    try {
      const token = await getToken();
      await api.updateCoupon(coupon.id, { active: !coupon.active }, token);
      setMessage(`Coupon "${coupon.code}" ${coupon.active ? "paused" : "activated"}.`);
      refresh();
    } catch (err) {
      setErrorMessage(err.message || "Failed to update coupon status");
    }
  };

  const handleDeleteCoupon = async (coupon) => {
    if (!window.confirm(`Permanently delete coupon "${coupon.code}"?`)) return;
    try {
      const token = await getToken();
      await api.deleteCoupon(coupon.id, token);
      setMessage(`Coupon "${coupon.code}" deleted.`);
      refresh();
    } catch (err) {
      setErrorMessage(err.message || "Failed to delete coupon");
    }
  };

  const handleCopyCoupon = (code) => {
    navigator.clipboard?.writeText(code);
    setCouponCopied(code);
    setTimeout(() => setCouponCopied(""), 2200);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleApproveVehicle = async (id) => {
    try {
      setProcessingId(id);
      setMessage("");
      setErrorMessage("");
      const token = await getToken();
      const res = await api.approveVehicle(id, token);
      
      // Optimistic state update
      setVehicles((prev) =>
        prev.map((v) => (v.id === id ? { ...v, approvalStatus: "Approved", status: "active" } : v))
      );
      setMessage(res.message || "✓ Vehicle successfully approved and activated on marketplace!");
      await refresh();
    } catch (err) {
      setErrorMessage(`Failed to approve vehicle: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectVehicle = async (e) => {
    if (e) e.preventDefault();
    if (!rejectingVehicle) return;
    const targetId = rejectingVehicle.id;
    const finalReason = rejectReason.trim() || "Declined during administrative document review";

    try {
      setProcessingId(targetId);
      setMessage("");
      setErrorMessage("");
      const token = await getToken();
      const res = await api.rejectVehicle(targetId, finalReason, token);

      // Optimistic state update
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === targetId
            ? { ...v, approvalStatus: "Rejected", status: "rejected", rejectionReason: finalReason }
            : v
        )
      );
      setMessage(`Vehicle rejected. Reason recorded: "${finalReason}"`);
      setRejectingVehicle(null);
      setRejectReason("");
      await refresh();
    } catch (err) {
      setErrorMessage(`Failed to reject vehicle: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRunRcCheck = async (id) => {
    try {
      setProcessingId(id);
      setMessage("");
      setErrorMessage("");
      const token = await getToken();
      await api.verifyVehicle(id, token);
      setMessage("✓ VAHAN RC lookup completed.");
      await refresh();
    } catch (err) {
      setErrorMessage(`RC verification error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const decideDealer = async (id, decision) => {
    const token = await getToken();
    await api.verifyDealer(id, decision, token);
    refresh();
  };

  const toggleExpandDealer = async (id) => {
    if (expandedDealerId === id) return setExpandedDealerId(null);
    setExpandedDealerId(id);
    if (!verificationCache[id]) {
      const token = await getToken();
      const { verification } = await api.getDealerVerification(id, token);
      setVerificationCache((c) => ({ ...c, [id]: verification }));
    }
  };

  const saveDealerEdit = async () => {
    const token = await getToken();
    const { id, name, city, address, whatsapp, gstNumber, verificationStatus } = editingDealer;
    await api.updateDealer(id, { name, city, address, whatsapp, gstNumber, verificationStatus }, token);
    setEditingDealer(null);
    setMessage("Dealer updated.");
    refresh();
  };

  const confirmDeleteDealer = async (id) => {
    const token = await getToken();
    await api.deleteDealer(id, token);
    setDeleteConfirmId(null);
    setMessage("Dealer and their listings were deleted.");
    refresh();
  };

  const exportAuditLogsCsv = () => {
    if (!auditLogs.length) return;
    const headers = ["ID", "Timestamp", "Action", "User ID", "User Role", "Vehicle ID", "Dealer ID", "Details"];
    const rows = auditLogs.map((l) => [
      `"${l.id || ""}"`,
      `"${new Date(l.timestamp).toISOString()}"`,
      `"${l.action || ""}"`,
      `"${l.userId || ""}"`,
      `"${l.userRole || ""}"`,
      `"${l.vehicleId || ""}"`,
      `"${l.dealerId || ""}"`,
      `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `trustdrive-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pendingVehicles = vehicles.filter(
    (v) => v.approvalStatus === "Pending Admin Approval" || v.status === "pending" || v.status === "draft"
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Platform Administration</h1>
          <p className="mt-1 text-sm text-muted">
            Manage dealer registrations, review vehicle approvals, inspect sensitive RC/VIN details, and monitor audit logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Admin Clearance Level: Complete Unmasked Access
          </div>
          {user && (
            <span className="text-xs text-muted font-mono">
              Signed in as: <strong>{user.email}</strong>
            </span>
          )}
        </div>
      </div>

      {message && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 shadow-sm">
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 shadow-sm">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage("")} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Pending Approvals", pendingVehicles.length, "text-amber-600 font-bold"],
            ["Total Vehicles", stats.totalVehicles],
            ["RC Verified", stats.verifiedVehicles],
            ["Total Dealers", stats.totalDealers],
            ["Pending KYC", pendingDealers.length],
            ["Avg. Rating", stats.avgPlatformRating ? `★ ${stats.avgPlatformRating}` : "—"],
          ].map(([label, value, customClass]) => (
            <div key={label} className="rounded-2xl border hairline bg-white p-4 shadow-sm">
              <p className="text-xs text-muted">{label}</p>
              <p className={`mt-1 font-display text-xl font-semibold ${customClass || "text-ink"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs navigation */}
      <div className="mt-8 flex flex-wrap gap-2 border-b hairline">
        {[
          { id: "vehicle-approvals", label: "Vehicle Approvals", badge: pendingVehicles.length },
          { id: "all-vehicles", label: "All Vehicles Directory", badge: vehicles.length },
          { id: "dealer-kyc", label: "Dealer KYC Verification", badge: pendingDealers.length },
          { id: "all-dealers", label: "Dealer Directory", badge: allDealers.length },
          { id: "coupons", label: "Coupon Builder", badge: coupons.filter((c) => c.active).length },
          { id: "audit-logs", label: "Security & Audit Logs", badge: auditLogs.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`focus-ring -mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  tab.id === "vehicle-approvals" && tab.badge > 0
                    ? "bg-amber-100 text-amber-800 font-semibold"
                    : "bg-paper text-muted"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: VEHICLE APPROVALS QUEUE */}
      {activeTab === "vehicle-approvals" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-ink">
              Pending Vehicle Approvals ({pendingVehicles.length})
            </h2>
            <span className="text-xs text-muted">
              Vehicles submitted by dealers remain hidden until approved by an administrator.
            </span>
          </div>

          {pendingVehicles.length === 0 ? (
            <div className="rounded-2xl border hairline bg-white p-12 text-center text-muted">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/5 text-primary text-xl">
                ✓
              </div>
              <p className="text-sm font-medium text-ink">All caught up!</p>
              <p className="mt-1 text-xs">No dealer vehicles are currently awaiting admin review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingVehicles.map((v) => (
                <div key={v.id} className="overflow-hidden rounded-2xl border hairline bg-white p-6 shadow-sm">
                  <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left: Photos & overview */}
                    <div>
                      <div className="h-44 w-full overflow-hidden rounded-xl border hairline bg-paper">
                        <VehicleImage vehicle={v} />
                      </div>
                      <div className="mt-3">
                        <h3 className="font-display text-lg font-semibold text-ink">
                          {v.brand} {v.model} <span className="text-muted text-sm">({v.year})</span>
                        </h3>
                        <p className="font-mono text-lg font-bold text-primary">₹{formatINR(v.price)}</p>
                        <p className="mt-1 text-xs text-muted">
                          {formatINR(v.km)} km · {v.fuel} · {v.transmission} · {v.owners} owner(s)
                        </p>
                        {v.description && (
                          <p className="mt-2 line-clamp-2 text-xs italic text-muted">"{v.description}"</p>
                        )}
                      </div>
                    </div>

                    {/* Middle: Dealer & Sensitive Info (UNMASKED FOR ADMIN) */}
                    <div className="space-y-3 rounded-xl border hairline bg-slate-50/70 p-4">
                      <div className="border-b hairline pb-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Dealer Information</p>
                        <p className="mt-1 text-sm font-medium text-ink">{v.dealer?.name || "Dealer ID: " + v.dealerId}</p>
                        <p className="text-xs text-muted">{v.dealer?.city} · Phone: {v.dealer?.whatsapp || "N/A"}</p>
                        <p className="font-mono text-xs text-muted">GST: {v.dealer?.gstNumber || "N/A"}</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                            <span>🔒</span> Complete Registration No.
                          </span>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                            ADMIN ONLY
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-sm font-bold text-ink bg-white rounded border hairline px-2.5 py-1">
                          {v.registrationNumber || "NOT PROVIDED"}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                            <span>🔒</span> Complete Chassis / VIN No.
                          </span>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                            ADMIN ONLY
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-sm font-bold text-ink bg-white rounded border hairline px-2.5 py-1">
                          {v.chassisNumber || "NOT PROVIDED"}
                        </p>
                      </div>

                      {v.inspectionVideoUrl && (
                        <div className="pt-2 border-t hairline space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                              <span>🎥</span> Inspection Video
                            </span>
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                              ADMIN ONLY
                            </span>
                          </div>
                          {v.inspectionVideoUrl.startsWith("data:video") || v.inspectionVideoUrl.startsWith("blob:") || v.inspectionVideoUrl.endsWith(".mp4") || v.inspectionVideoUrl.endsWith(".mov") || v.inspectionVideoUrl.endsWith(".webm") ? (
                            <video controls src={v.inspectionVideoUrl} className="w-full max-h-44 rounded-lg border border-slate-300 bg-black object-contain" />
                          ) : (
                            <a href={v.inspectionVideoUrl} target="_blank" rel="noreferrer" className="block p-2 text-xs font-mono text-blue-600 hover:underline bg-white rounded border hairline truncate">
                              🔗 Open Inspection Video Link →
                            </a>
                          )}
                        </div>
                      )}

                      <div className="text-[11px] text-muted pt-1">
                        Submitted on: {new Date(v.submittedAt || v.listedAt).toLocaleString("en-IN")}
                      </div>
                    </div>

                    {/* Right: Verification status & Actions */}
                    <div className="flex flex-col justify-between rounded-xl border hairline bg-paper/50 p-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">VAHAN RC Status</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              v.rcVerified
                                ? "bg-emerald-100 text-emerald-800"
                                : v.verificationStatus === "declined"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {v.rcVerified ? "✓ VAHAN Verified" : `RC: ${v.verificationStatus || "Pending"}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRunRcCheck(v.id)}
                            disabled={processingId === v.id}
                            className="focus-ring rounded-lg border hairline bg-white px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-50"
                          >
                            {processingId === v.id ? "Checking…" : "Run RC Check"}
                          </button>
                        </div>

                        {v.verificationDetails?.fields && (
                          <div className="mt-3 text-xs space-y-1 font-mono bg-white p-2 rounded border hairline">
                            <p className="text-muted">RTO: {v.verificationDetails.fields.rto || "—"}</p>
                            <p className="text-muted">Fuel: {v.verificationDetails.fields.fuelType || "—"}</p>
                            <p className="text-muted">Insurance: {v.verificationDetails.fields.insurance?.status || "—"}</p>
                          </div>
                        )}
                      </div>

                      {/* Approval Actions */}
                      <div className="mt-4 pt-4 border-t hairline space-y-2">
                        <button
                          type="button"
                          onClick={() => handleApproveVehicle(v.id)}
                          disabled={processingId === v.id}
                          className="focus-ring w-full rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          {processingId === v.id ? (
                            <span>Processing…</span>
                          ) : (
                            <>
                              <span>✓</span>
                              <span>Approve & Publish Vehicle</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingVehicle(v);
                            setRejectReason("");
                          }}
                          disabled={processingId === v.id}
                          className="focus-ring w-full rounded-full border border-danger/40 bg-white px-4 py-2 text-xs font-medium text-danger hover:bg-danger/5 disabled:opacity-60"
                        >
                          ✕ Reject Vehicle
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL VEHICLES DIRECTORY */}
      {activeTab === "all-vehicles" && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-ink">All Vehicle Listings ({vehicles.length})</h2>
            <span className="text-xs text-muted">Complete administrative view of all dealer vehicles.</span>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border hairline bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b hairline bg-paper/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Dealer</th>
                  <th className="px-4 py-3">🔒 Full Reg. No.</th>
                  <th className="px-4 py-3">🔒 Full Chassis</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Approval Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} className="border-b hairline last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-ink">
                      <div>
                        {v.brand} {v.model} <span className="text-xs text-muted">({v.year})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {v.dealer?.name || v.dealerId}
                      <span className="block text-[10px] text-muted">{v.dealer?.city}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-emerald-800 bg-emerald-50/50">
                      {v.registrationNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink bg-slate-50/50">
                      {v.chassisNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">₹{formatINR(v.price)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          v.approvalStatus === "Approved" || v.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : v.approvalStatus === "Rejected" || v.status === "rejected"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {v.approvalStatus || v.status}
                      </span>
                      {v.rejectionReason && (
                        <p className="mt-0.5 text-[10px] text-danger max-w-xs truncate">Reason: {v.rejectionReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {v.approvalStatus !== "Approved" && (
                        <button
                          type="button"
                          onClick={() => handleApproveVehicle(v.id)}
                          disabled={processingId === v.id}
                          className="focus-ring rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {processingId === v.id ? "…" : "Approve"}
                        </button>
                      )}
                      {v.approvalStatus !== "Rejected" && (
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingVehicle(v);
                            setRejectReason("");
                          }}
                          disabled={processingId === v.id}
                          className="focus-ring rounded-full border border-danger/40 px-3 py-1 text-xs font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DEALER KYC */}
      {activeTab === "dealer-kyc" && (
        <div className="mt-6 space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink">Pending Dealer KYC Reviews</h2>
          {pendingDealers.length === 0 && (
            <p className="rounded-xl border hairline bg-white p-8 text-center text-sm text-muted">
              No pending dealer verifications.
            </p>
          )}
          {pendingDealers.map((d) => (
            <div key={d.id} className="rounded-xl border hairline bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-ink">{d.name}</p>
                  <p className="font-mono text-xs text-muted">GST: {d.gstNumber} · {d.city}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpandDealer(d.id)}
                    className="focus-ring rounded-full border hairline px-4 py-1.5 text-xs text-ink hover:border-primary hover:text-primary"
                  >
                    {expandedDealerId === d.id ? "Hide documents" : "Review documents"}
                  </button>
                  <button
                    type="button"
                    onClick={() => decideDealer(d.id, "reject")}
                    className="focus-ring rounded-full border border-danger/40 px-4 py-1.5 text-xs font-medium text-danger hover:bg-danger/5"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => decideDealer(d.id, "approve")}
                    className="focus-ring rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-paper hover:bg-primary-light"
                  >
                    Approve
                  </button>
                </div>
              </div>
              {expandedDealerId === d.id && (
                <div className="mt-4 border-t hairline pt-4">
                  {verificationCache[d.id] === undefined ? (
                    <p className="text-sm text-muted">Loading documents…</p>
                  ) : (
                    <DealerDocumentsViewer verification={verificationCache[d.id]} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: ALL DEALERS */}
      {activeTab === "all-dealers" && (
        <div className="mt-6">
          <h2 className="font-display text-xl font-semibold text-ink">Dealer Directory</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border hairline bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b hairline text-xs uppercase tracking-wide text-muted bg-paper/50">
                <tr>
                  <th className="px-4 py-3">Dealer</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allDealers.map((d) => (
                  <tr key={d.id} className="border-b hairline last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{d.name}</td>
                    <td className="px-4 py-3 text-muted">{d.city}</td>
                    <td className="px-4 py-3 capitalize">{d.verificationStatus}</td>
                    <td className="px-4 py-3 font-mono">★ {d.rating || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingDealer(d)}
                          className="focus-ring rounded-full border hairline px-3 py-1 text-xs hover:border-primary hover:text-primary"
                        >
                          Edit
                        </button>
                        {deleteConfirmId === d.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => confirmDeleteDealer(d.id)}
                              className="focus-ring rounded-full bg-danger px-3 py-1 text-xs font-medium text-paper"
                            >
                              Confirm delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="focus-ring rounded-full border hairline px-3 py-1 text-xs text-muted"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(d.id)}
                            className="focus-ring rounded-full border border-danger/40 px-3 py-1 text-xs text-danger hover:bg-danger/5"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === "audit-logs" && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Administrative & Security Audit Logs</h2>
              <p className="text-xs text-muted">Immutable record of registrations, approvals, rejections, and views.</p>
            </div>
            <button
              type="button"
              onClick={exportAuditLogsCsv}
              disabled={auditLogs.length === 0}
              className="focus-ring flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              <span>📥</span>
              <span>Export Audit Trail (CSV)</span>
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border hairline bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b hairline bg-paper/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor (User ID / Role)</th>
                  <th className="px-4 py-3">Vehicle / Target ID</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="border-b hairline last:border-0 font-mono text-xs hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-muted">{new Date(log.timestamp).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 font-semibold ${
                            log.action === "vehicle_approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : log.action === "vehicle_rejected"
                              ? "bg-rose-100 text-rose-800"
                              : log.action === "vehicle_registered"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {log.userId} <span className="text-muted">({log.userRole})</span>
                      </td>
                      <td className="px-4 py-3 text-muted">{log.vehicleId || log.dealerId || "—"}</td>
                      <td className="px-4 py-3 text-muted max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: COUPON BUILDER (DEALER EXCLUSIVE) */}
      {activeTab === "coupons" && (
        <div className="mt-6 space-y-6">
          {/* Header & Exclusive Policy Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-semibold text-ink">Dealer Coupon Builder</h2>
                <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                  Dealer Exclusive
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                Create promotional discount vouchers for registered car dealers to apply during listing activations and renewals.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refresh}
                className="focus-ring rounded-full border hairline bg-white px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-slate-50 flex items-center gap-1.5"
              >
                <span>🔄</span> Refresh Coupons
              </button>
            </div>
          </div>

          {/* Security Banner */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 flex items-start gap-3 shadow-xs">
            <span className="text-xl">🛡️</span>
            <div className="text-xs leading-relaxed">
              <strong className="font-semibold text-emerald-900">Enforced Dealer Exclusivity:</strong> All coupons created here are strictly validated against verified dealership accounts at the API level (<code>/api/coupons/validate</code> and <code>/api/payments/activate-listing</code>). Regular buyer accounts or non-authenticated users cannot view, validate, or redeem these vouchers.
            </div>
          </div>

          {/* Metric Summary Cards */}
          {(() => {
            const totalCount = coupons.length;
            const activeCount = coupons.filter((c) => c.active && (!c.expiresAt || new Date(c.expiresAt) > new Date()) && c.usedCount < c.usageLimit).length;
            const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
            const totalEstSavings = coupons.reduce((sum, c) => {
              const uses = c.usedCount || 0;
              const discountPerUse = c.discountType === "percent"
                ? Math.round((1999 * c.discountValue) / 100)
                : Math.min(c.discountValue, 1999);
              return sum + (discountPerUse * uses);
            }, 0);

            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border hairline bg-white p-4 shadow-sm">
                  <p className="text-xs text-muted">Total Coupons Created</p>
                  <p className="mt-1 font-display text-2xl font-bold text-ink">{totalCount}</p>
                  <p className="mt-1 text-[11px] text-muted">All active & past campaign codes</p>
                </div>
                <div className="rounded-2xl border hairline bg-white p-4 shadow-sm">
                  <p className="text-xs text-muted">Active & Ready</p>
                  <p className="mt-1 font-display text-2xl font-bold text-emerald-600">{activeCount}</p>
                  <p className="mt-1 text-[11px] text-muted">Can be redeemed right now</p>
                </div>
                <div className="rounded-2xl border hairline bg-white p-4 shadow-sm">
                  <p className="text-xs text-muted">Dealer Redemptions</p>
                  <p className="mt-1 font-display text-2xl font-bold text-primary">{totalRedemptions}</p>
                  <p className="mt-1 text-[11px] text-muted">Times applied at listing checkout</p>
                </div>
                <div className="rounded-2xl border hairline bg-white p-4 shadow-sm">
                  <p className="text-xs text-muted">Total Dealer Savings Provided</p>
                  <p className="mt-1 font-display text-2xl font-bold text-gold-dark">₹{formatINR(totalEstSavings)}</p>
                  <p className="mt-1 text-[11px] text-muted">Estimated platform fee subsidies</p>
                </div>
              </div>
            );
          })()}

          {/* Builder & Voucher Preview Layout */}
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* Left: Builder Form (7 Cols) */}
            <div className="lg:col-span-7 rounded-2xl border hairline bg-white p-6 shadow-sm">
              <div className="border-b hairline pb-4">
                <h3 className="font-display text-lg font-semibold text-ink">Create New Dealer Coupon</h3>
                <p className="mt-0.5 text-xs text-muted">Configure discount, redemption limits, and validity rules.</p>
              </div>

              <form onSubmit={handleCreateCoupon} className="mt-5 space-y-5">
                {/* Code Field + Generator */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">Coupon Code</label>
                    <button
                      type="button"
                      onClick={() => generateCouponCode("DEALER")}
                      className="text-xs font-semibold text-primary hover:text-primary-light flex items-center gap-1 focus-ring rounded"
                    >
                      <span>⚡ Generate Random Code</span>
                    </button>
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="text"
                      required
                      value={couponForm.code}
                      onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. DEALER20, FESTIVAL50, HYDERABAD100"
                      className="focus-ring flex-1 rounded-xl border hairline p-3 font-mono text-base font-bold uppercase tracking-wider text-ink bg-paper/50"
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="text-[11px] text-muted mr-1">Quick Prefixes:</span>
                    {["DEALER", "FESTIVAL", "WELCOME", "PROMO", "PREMIUM"].map((prefix) => (
                      <button
                        key={prefix}
                        type="button"
                        onClick={() => generateCouponCode(prefix)}
                        className="rounded px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                      >
                        {prefix}…
                      </button>
                    ))}
                  </div>
                </div>

                {/* Discount Type & Value */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">Discount Type</label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCouponForm({ ...couponForm, discountType: "percent", discountValue: 20 })}
                        className={`rounded-xl border p-2.5 text-xs font-semibold text-center transition-all ${
                          couponForm.discountType === "percent"
                            ? "border-primary bg-primary text-paper shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        % Percentage Off
                      </button>
                      <button
                        type="button"
                        onClick={() => setCouponForm({ ...couponForm, discountType: "fixed", discountValue: 500 })}
                        className={`rounded-xl border p-2.5 text-xs font-semibold text-center transition-all ${
                          couponForm.discountType === "fixed"
                            ? "border-primary bg-primary text-paper shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        ₹ Flat Amount (INR)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Discount Value ({couponForm.discountType === "percent" ? "%" : "₹"})
                    </label>
                    <div className="mt-1.5 relative">
                      <input
                        type="number"
                        min="1"
                        max={couponForm.discountType === "percent" ? 100 : 1999}
                        required
                        value={couponForm.discountValue}
                        onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                        className="focus-ring w-full rounded-xl border hairline p-3 text-base font-bold text-ink pl-8"
                      />
                      <span className="absolute left-3 top-3.5 text-muted font-bold">
                        {couponForm.discountType === "percent" ? "%" : "₹"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Discount Presets */}
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted self-center">Presets:</span>
                    {couponForm.discountType === "percent" ? (
                      <>
                        {[
                          [10, "10% Off"],
                          [20, "20% Off"],
                          [50, "50% Off"],
                          [100, "100% Free Listing"],
                        ].map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCouponForm({ ...couponForm, discountValue: val })}
                            className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                              Number(couponForm.discountValue) === val
                                ? "border-primary bg-primary/10 text-primary font-bold"
                                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        {[
                          [250, "₹250 Off"],
                          [500, "₹500 Off"],
                          [1000, "₹1,000 Off"],
                          [1999, "₹1,999 (Full Waiver)"],
                        ].map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCouponForm({ ...couponForm, discountValue: val })}
                            className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                              Number(couponForm.discountValue) === val
                                ? "border-primary bg-primary/10 text-primary font-bold"
                                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Usage Limits & Expiration */}
                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t hairline">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">Redemption Limit</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={couponForm.usageLimit}
                      onChange={(e) => setCouponForm({ ...couponForm, usageLimit: e.target.value })}
                      placeholder="1"
                      className="focus-ring mt-1.5 w-full rounded-xl border hairline p-2.5 text-sm text-ink"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[1, 5, 10, 50, 1000].map((lim) => (
                        <button
                          key={lim}
                          type="button"
                          onClick={() => setCouponForm({ ...couponForm, usageLimit: lim })}
                          className="rounded px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                        >
                          {lim === 1000 ? "Unlimited" : `${lim} use${lim > 1 ? "s" : ""}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Expiry Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={couponForm.expiresAt}
                      onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
                      className="focus-ring mt-1.5 w-full rounded-xl border hairline p-2.5 text-sm text-ink"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[
                        [0, "No Expiry"],
                        [7, "+7 Days"],
                        [30, "+30 Days"],
                        [90, "+90 Days"],
                      ].map(([days, label]) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => {
                            if (days === 0) {
                              setCouponForm({ ...couponForm, expiresAt: "" });
                            } else {
                              const d = new Date();
                              d.setDate(d.getDate() + days);
                              setCouponForm({ ...couponForm, expiresAt: d.toISOString().split("T")[0] });
                            }
                          }}
                          className="rounded px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Active Checkbox */}
                <div className="flex items-center gap-3 pt-2">
                  <input
                    id="coupon-active-checkbox"
                    type="checkbox"
                    checked={couponForm.active}
                    onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="coupon-active-checkbox" className="text-xs font-medium text-ink cursor-pointer">
                    Activate immediately upon creation (dealers can use right away)
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submittingCoupon}
                  className="focus-ring w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-paper shadow hover:bg-primary-light transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submittingCoupon ? "Creating Coupon…" : "🚀 Publish Dealer Coupon"}
                </button>
              </form>
            </div>

            {/* Right: Live Voucher Preview Card (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border hairline bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b hairline">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Live Voucher Preview</span>
                  <span className="text-[11px] font-mono text-primary font-semibold">Dealer Perspective</span>
                </div>

                {/* The Luxury Voucher Card */}
                {(() => {
                  const val = Number(couponForm.discountValue) || 0;
                  const isPct = couponForm.discountType === "percent";
                  const discountAmount = isPct ? Math.round((1999 * val) / 100) : Math.min(val, 1999);
                  const finalPay = Math.max(0, 1999 - discountAmount);

                  return (
                    <div className="mt-4 overflow-hidden rounded-2xl border-2 border-[#C5A059] bg-[#142B21] text-white shadow-xl relative">
                      {/* Decorative background watermark */}
                      <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
                        <svg viewBox="0 0 100 100" className="h-48 w-48 text-gold">
                          <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="none" />
                          <path d="M30 50 L45 65 L70 35" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      </div>

                      {/* Card Header */}
                      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full border border-gold flex items-center justify-center text-[10px] text-gold font-bold">
                            ✓
                          </div>
                          <span className="font-display text-sm font-semibold tracking-wide text-paper">
                            TrustDrive India
                          </span>
                        </div>
                        <span className="rounded-full bg-gold/20 border border-gold/40 px-2 py-0.5 text-[9px] font-bold text-gold uppercase tracking-wider">
                          Dealer Voucher
                        </span>
                      </div>

                      {/* Voucher Body */}
                      <div className="p-5">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <p className="text-[11px] uppercase tracking-widest text-gold-light">Listing Discount</p>
                            <h4 className="font-display text-3xl font-extrabold text-white mt-0.5">
                              {isPct ? `${val}% OFF` : `₹${formatINR(val)} OFF`}
                            </h4>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-white/60 uppercase">Scope</span>
                            <p className="text-xs font-semibold text-emerald-300">Verified Dealers Only</p>
                          </div>
                        </div>

                        {/* Code Display with copy */}
                        <div className="mt-4 rounded-xl border border-dashed border-gold/40 bg-black/30 p-3 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-white/50 block">Coupon Code</span>
                            <span className="font-mono text-base font-bold text-gold tracking-widest">
                              {couponForm.code || "ENTER-CODE"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyCoupon(couponForm.code)}
                            className="rounded-lg bg-gold/20 hover:bg-gold/30 text-gold px-3 py-1.5 text-xs font-semibold transition-colors focus-ring"
                          >
                            {couponCopied === couponForm.code ? "✓ Copied" : "Copy Code"}
                          </button>
                        </div>

                        {/* Calculation on Listing */}
                        <div className="mt-4 rounded-lg bg-white/5 p-3 space-y-1.5 text-xs">
                          <div className="flex justify-between text-white/70">
                            <span>Standard Individual Listing:</span>
                            <span>₹1,999</span>
                          </div>
                          <div className="flex justify-between text-emerald-400 font-semibold">
                            <span>Coupon Discount:</span>
                            <span>- ₹{formatINR(discountAmount)}</span>
                          </div>
                          <div className="border-t border-white/10 pt-1.5 flex justify-between font-bold text-white text-sm">
                            <span>Dealer Net Payable:</span>
                            <span className="text-gold">₹{formatINR(finalPay)}</span>
                          </div>
                        </div>

                        {/* Terms */}
                        <p className="mt-3 text-[10px] text-white/50 leading-relaxed">
                          • One-time use per listing activation.
                          {couponForm.expiresAt ? ` • Valid until ${new Date(couponForm.expiresAt).toLocaleDateString("en-IN")}.` : " • No expiration date."}
                          • Exclusively for KYC-cleared TrustDrive dealerships.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Instructions Box */}
              <div className="rounded-2xl border hairline bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
                <p className="font-bold text-ink flex items-center gap-1.5">
                  <span>💡</span> How Dealers Redeem Coupons
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-muted">
                  <li>Dealer submits car listing (RC checked via VAHAN).</li>
                  <li>Admin approves vehicle in "Vehicle Approvals" tab.</li>
                  <li>Dealer clicks <strong>"Pay & Activate"</strong> in their dashboard.</li>
                  <li>Under <em>Individual Listing (₹1,999)</em>, they enter this coupon code.</li>
                  <li>Discount applies immediately before simulated/Razorpay payment.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Existing Coupons Directory Table */}
          <div className="rounded-2xl border hairline bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b hairline pb-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">All Coupon Vouchers ({coupons.length})</h3>
                <p className="mt-0.5 text-xs text-muted">Monitor usage, pause active campaigns, or remove expired vouchers.</p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search code…"
                  value={couponSearch}
                  onChange={(e) => setCouponSearch(e.target.value)}
                  className="focus-ring rounded-lg border hairline px-3 py-1.5 text-xs text-ink w-36 sm:w-48"
                />

                <div className="flex rounded-lg border hairline p-0.5 bg-paper">
                  {["all", "active", "paused", "exhausted"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setCouponFilter(f)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded capitalize transition-colors ${
                        couponFilter === f ? "bg-white text-primary shadow-xs" : "text-muted hover:text-ink"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b hairline bg-paper/60 text-xs font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Coupon Code</th>
                    <th className="px-4 py-3">Discount</th>
                    <th className="px-4 py-3">Redemptions</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y hairline">
                  {(() => {
                    const filtered = coupons.filter((c) => {
                      if (couponSearch && !c.code.toLowerCase().includes(couponSearch.toLowerCase())) {
                        return false;
                      }
                      const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
                      const isExhausted = c.usedCount >= c.usageLimit;
                      if (couponFilter === "active") return c.active && !isExpired && !isExhausted;
                      if (couponFilter === "paused") return !c.active;
                      if (couponFilter === "exhausted") return isExhausted;
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-sm text-muted">
                            No coupons found matching your filter. Use the builder above to create one.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((c) => {
                      const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
                      const isExhausted = c.usedCount >= c.usageLimit;
                      const pctUsed = Math.min(100, Math.round(((c.usedCount || 0) / (c.usageLimit || 1)) * 100));

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Code */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-ink text-sm bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                {c.code}
                              </span>
                              <button
                                type="button"
                                title="Copy code"
                                onClick={() => handleCopyCoupon(c.code)}
                                className="text-muted hover:text-primary text-xs focus-ring rounded"
                              >
                                {couponCopied === c.code ? "✓" : "📋"}
                              </button>
                            </div>
                          </td>

                          {/* Discount */}
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                c.discountType === "percent"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {c.discountType === "percent" ? `${c.discountValue}% OFF` : `₹${formatINR(c.discountValue)} OFF`}
                            </span>
                          </td>

                          {/* Usage Progress */}
                          <td className="px-4 py-3">
                            <div className="w-32">
                              <div className="flex justify-between text-xs text-muted mb-1">
                                <span>{c.usedCount} used</span>
                                <span>Limit {c.usageLimit}</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    isExhausted ? "bg-slate-500" : "bg-primary"
                                  }`}
                                  style={{ width: `${pctUsed}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            {isExhausted ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Exhausted
                              </span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                Expired
                              </span>
                            ) : c.active ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                Paused
                              </span>
                            )}
                          </td>

                          {/* Expiry */}
                          <td className="px-4 py-3 text-xs text-muted">
                            {c.expiresAt ? (
                              <span className={isExpired ? "text-rose-600 font-semibold" : ""}>
                                {new Date(c.expiresAt).toLocaleDateString("en-IN")}
                              </span>
                            ) : (
                              <span className="text-slate-400">Never</span>
                            )}
                          </td>

                          {/* Created */}
                          <td className="px-4 py-3 text-xs text-muted">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN") : "—"}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleCoupon(c)}
                                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                                  c.active
                                    ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                                    : "border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                                }`}
                              >
                                {c.active ? "Pause" : "Activate"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCoupon(c)}
                                className="text-xs px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Delete coupon"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">Reject Vehicle Listing</h3>
                <p className="mt-0.5 text-xs text-muted">
                  Provide feedback for {rejectingVehicle.brand} {rejectingVehicle.model} ({rejectingVehicle.registrationNumber || "Masked"}).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingVehicle(null)}
                className="text-muted hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Reason Chips */}
            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Quick Select Common Reasons:
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {QUICK_REJECT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className={`rounded-lg border px-2.5 py-1 text-xs transition-colors text-left ${
                      rejectReason === reason
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleRejectVehicle} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink">Rejection Reason / Notes for Dealer:</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Type custom rejection notes or select a reason above..."
                  className="focus-ring mt-1 w-full rounded-xl border hairline p-3 text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingVehicle(null)}
                  className="focus-ring flex-1 rounded-full border hairline px-4 py-2 text-sm text-ink hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === rejectingVehicle.id}
                  className="focus-ring flex-1 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-paper hover:bg-danger/90 disabled:opacity-60"
                >
                  {processingId === rejectingVehicle.id ? "Rejecting…" : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit dealer modal */}
      {editingDealer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={() => setEditingDealer(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-ink">Edit dealer</h3>
            <div className="mt-4 space-y-3">
              <input value={editingDealer.name} onChange={(e) => setEditingDealer({ ...editingDealer, name: e.target.value })} placeholder="Name" className="focus-ring w-full rounded-lg border hairline px-3 py-2 text-sm" />
              <input value={editingDealer.city} onChange={(e) => setEditingDealer({ ...editingDealer, city: e.target.value })} placeholder="City" className="focus-ring w-full rounded-lg border hairline px-3 py-2 text-sm" />
              <input value={editingDealer.address || ""} onChange={(e) => setEditingDealer({ ...editingDealer, address: e.target.value })} placeholder="Address" className="focus-ring w-full rounded-lg border hairline px-3 py-2 text-sm" />
              <input value={editingDealer.whatsapp || ""} onChange={(e) => setEditingDealer({ ...editingDealer, whatsapp: e.target.value })} placeholder="Phone / WhatsApp" className="focus-ring w-full rounded-lg border hairline px-3 py-2 text-sm" />
              <input value={editingDealer.gstNumber} onChange={(e) => setEditingDealer({ ...editingDealer, gstNumber: e.target.value })} placeholder="GSTIN" className="focus-ring w-full rounded-lg border hairline px-3 py-2 text-sm font-mono" />
              <select value={editingDealer.verificationStatus} onChange={(e) => setEditingDealer({ ...editingDealer, verificationStatus: e.target.value })} className="focus-ring w-full rounded-lg border hairline px-3 py-2 text-sm">
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setEditingDealer(null)} className="focus-ring flex-1 rounded-full border hairline px-4 py-2 text-sm text-ink">Cancel</button>
              <button onClick={saveDealerEdit} className="focus-ring flex-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-paper hover:bg-primary-light">Save changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
