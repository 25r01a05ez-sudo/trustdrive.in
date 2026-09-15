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
      const [pDealers, dList, pStats, vList, logs] = await Promise.all([
        api.pendingDealers(token).catch(() => ({ dealers: [] })),
        api.listDealers().catch(() => ({ dealers: [] })),
        api.platformAnalytics(token).catch(() => null),
        api.getAllVehicles(token).catch(() => ({ vehicles: [] })),
        api.getAuditLogs(token).catch(() => ({ logs: [] })),
      ]);

      setPendingDealers(pDealers.dealers || []);
      setAllDealers(dList.dealers || []);
      setStats(pStats);
      setVehicles(vList.vehicles || []);
      setAuditLogs(logs.logs || []);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    }
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
