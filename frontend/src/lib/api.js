const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export function resolveMediaUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  const baseUrl = (import.meta.env.VITE_API_BASE || "").replace(/\/api$/, "");
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function request(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  // auth
  signup: (payload) => request("/auth/signup", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  me: (token) => request("/auth/me", { token }),

  // OTP auth
  sendOtp: (payload) => request("/auth/send-otp", { method: "POST", body: payload }),
  verifyOtp: (payload) => request("/auth/verify-otp", { method: "POST", body: payload }),
  resetPassword: (payload) => request("/auth/reset-password", { method: "POST", body: payload }),

  // search / listings
  search: (params, token) => request(`/search?${new URLSearchParams(params).toString()}`, { token }),
  searchFacets: () => request("/search/facets"),
  recommendations: (vehicleId) => request(`/search/recommendations/${vehicleId}`),
  getVehicle: (id, token) => request(`/vehicles/${id}`, { token }),
  getMyVehicles: (token) => request("/vehicles/mine", { token }),
  getAllVehicles: (token) => request("/vehicles", { token }),

  // dealers
  listDealers: (params = {}) => request(`/dealers?${new URLSearchParams(params).toString()}`),
  getDealer: (id, token) => request(`/dealers/${id}`, { token }),
  getDealerVerification: (id, token) => request(`/dealers/${id}/verification`, { token }),
  registerDealer: (payload, token) => request("/dealers/register", { method: "POST", body: payload, token }),
  updateDealer: (id, payload, token) => request(`/dealers/${id}`, { method: "PATCH", body: payload, token }),
  deleteDealer: (id, token) => request(`/dealers/${id}`, { method: "DELETE", token }),

  // vehicles (dealer & admin)
  uploadInspectionVideo: (file, onProgress, token) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE}/vehicles/upload-video?filename=${encodeURIComponent(file.name)}`;
      xhr.open("POST", url, true);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            onProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
          } else {
            reject(new Error(data.error || `Upload failed (${xhr.status})`));
          }
        } catch (e) {
          reject(new Error("Invalid server response for video upload"));
        }
      };

      xhr.onerror = () => reject(new Error("Network connection error during video upload"));
      xhr.send(file);
    });
  },
  createVehicle: (payload, token) => request("/vehicles", { method: "POST", body: payload, token }),
  updateVehicle: (id, payload, token) => request(`/vehicles/${id}`, { method: "PATCH", body: payload, token }),
  deleteVehicle: (id, token) => request(`/vehicles/${id}`, { method: "DELETE", token }),
  approveVehicle: (id, token) => request(`/vehicles/${id}/approve`, { method: "POST", token }),
  rejectVehicle: (id, reason, token) => request(`/vehicles/${id}/reject`, { method: "POST", body: { reason }, token }),
  toggleFeatureVehicle: (id, featured, token) => request(`/vehicles/${id}/feature`, { method: "PATCH", body: { featured }, token }),
  generateVehicleDescription: (payload, token) => request("/vehicles/generate-description", { method: "POST", body: payload, token }),
  getAuditLogs: (token) => request("/vehicles/audit-logs", { token }),

  // leads
  createLead: (payload) => request("/leads", { method: "POST", body: payload }),
  listLeads: (token) => request("/leads", { token }),
  updateLead: (id, payload, token) => request(`/leads/${id}`, { method: "PATCH", body: payload, token }),

  // reviews
  listReviews: (dealerId) => request(`/reviews?dealerId=${dealerId}`),
  listAllReviews: () => request("/reviews"),
  createReview: (payload) => request("/reviews", { method: "POST", body: payload }),

  // verification
  verifyVehicle: (id, token) => request(`/verification/vehicle/${id}`, { method: "POST", token }),
  verifyDealer: (id, decision, token) =>
    request(`/verification/dealer/${id}`, { method: "POST", body: { decision }, token }),
  pendingDealers: (token) => request("/verification/pending", { token }),

  // analytics
  dealerAnalytics: (token) => request("/analytics/dealer", { token }),
  platformAnalytics: (token) => request("/analytics/platform", { token }),

  // dealer AI microsites
  getMySite: (token) => request("/dealer-sites/mine", { token }),
  generateSite: (prompt, token) => request("/dealer-sites/generate", { method: "POST", body: { prompt }, token }),
  updateSite: (payload, token) => request("/dealer-sites/mine", { method: "PATCH", body: payload, token }),
  checkSubdomain: (subdomain, token) => request(`/dealer-sites/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`, { token }),
  setSubdomain: (subdomain, token) => request("/dealer-sites/subdomain", { method: "POST", body: { subdomain }, token }),
  publishSite: (token) => request("/dealer-sites/publish", { method: "POST", token }),
  unpublishSite: (token) => request("/dealer-sites/unpublish", { method: "POST", token }),
  getSiteBySubdomain: (subdomain) => request(`/dealer-sites/by-subdomain/${subdomain}`),

  // payments & listing lifecycle
  activateListing: (vehicleId, payload, token) => request(`/payments/activate-listing/${vehicleId}`, { method: "POST", body: payload, token }),
  renewListing: (vehicleId, payload, token) => request(`/payments/renew/${vehicleId}`, { method: "POST", body: payload, token }),
  purchasePackage: (payload, token) => request("/payments/purchase-package", { method: "POST", body: payload, token }),
  getPackages: () => request("/payments/packages"),
  runExpiryCheck: (token) => request("/payments/run-expiry-check", { method: "POST", token }),

  // coupons
  validateCoupon: (code, token) => request("/coupons/validate", { method: "POST", body: { code }, token }),
  redeemCoupon: (payload, token) => request("/coupons/redeem", { method: "POST", body: payload, token }),
  listCoupons: (token) => request("/coupons", { token }),
  createCoupon: (payload, token) => request("/coupons", { method: "POST", body: payload, token }),
  updateCoupon: (id, payload, token) => request(`/coupons/${id}`, { method: "PATCH", body: payload, token }),
  deleteCoupon: (id, token) => request(`/coupons/${id}`, { method: "DELETE", token }),
};

