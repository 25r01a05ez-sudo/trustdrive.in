/**
 * Audit Logging Service
 * Records sensitive administrative and vehicle lifecycle events.
 */
const store = require("./store");

async function logAuditEvent({ userId, userRole, action, vehicleId, dealerId, details = {} }) {
  try {
    const logEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: userId || "anonymous",
      userRole: userRole || "unknown",
      action, // e.g. "vehicle_registered", "vehicle_viewed_by_admin", "vehicle_approved", "vehicle_rejected", "vehicle_modified", "vehicle_deleted"
      vehicleId: vehicleId || null,
      dealerId: dealerId || null,
      details,
      timestamp: new Date().toISOString(),
    };

    if (store.recordAuditLog) {
      await store.recordAuditLog(logEntry);
    }
    return logEntry;
  } catch (err) {
    console.error("[auditLog] Error recording audit event:", err.message);
    return null;
  }
}

module.exports = { logAuditEvent };
