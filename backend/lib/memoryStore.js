const { db, nextId } = require("../data/db");

function computeDealerRating(dealerId) {
  const reviews = db.reviews.filter((r) => r.dealerId === dealerId);
  return {
    reviewCount: reviews.length,
    rating: reviews.length
      ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1))
      : 0,
  };
}

module.exports = {
  // --- users ---
  async findUserByEmail(email) {
    if (!email) return null;
    const target = email.trim().toLowerCase();
    return db.users.find((u) => u.email && u.email.toLowerCase() === target) || null;
  },
  async findUserById(id) {
    return db.users.find((u) => u.id === id) || null;
  },
  async createUser(data) {
    const cleanEmail = data.email ? data.email.trim().toLowerCase() : data.email;
    const user = { id: nextId("u"), createdAt: new Date().toISOString(), ...data, email: cleanEmail };
    db.users.push(user);
    return user;
  },
  async setUserDealerId(userId, dealerId) {
    const user = db.users.find((u) => u.id === userId);
    if (user) user.dealerId = dealerId;
    return user;
  },
  async updateUser(userId, patch) {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return null;
    Object.assign(user, patch);
    return user;
  },

  // --- dealers ---
  async listDealers({ city, verified } = {}) {
    let results = db.dealers;
    if (city) results = results.filter((d) => d.city.toLowerCase() === city.toLowerCase());
    if (verified) results = results.filter((d) => d.verificationStatus === "verified");
    return results;
  },
  async findDealerById(id) {
    return db.dealers.find((d) => d.id === id) || null;
  },
  async createDealer(data) {
    const dealer = {
      id: nextId("d"),
      verificationStatus: "pending",
      verifiedAt: null,
      kycDocs: [],
      rating: 0,
      reviewCount: 0,
      whatsapp: "",
      ...data,
    };
    db.dealers.push(dealer);
    return dealer;
  },
  async updateDealer(id, patch) {
    const dealer = db.dealers.find((d) => d.id === id);
    if (!dealer) return null;
    Object.assign(dealer, patch);
    return dealer;
  },
  async listPendingDealers() {
    return db.dealers.filter((d) => d.verificationStatus === "pending");
  },
  async deleteDealer(id) {
    const idx = db.dealers.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    db.dealers.splice(idx, 1);
    return true;
  },
  async unsetUsersDealerId(dealerId) {
    db.users.forEach((u) => {
      if (u.dealerId === dealerId) u.dealerId = null;
    });
    return true;
  },

  async findVehicleById(id) {
    return db.vehicles.find((v) => v.id === id) || null;
  },
  async findVehicleByChassisOrReg(chassisNumber, registrationNumber) {
    const cleanChassis = String(chassisNumber || "").trim().toUpperCase();
    const cleanReg = String(registrationNumber || "").trim().toUpperCase();
    if (!cleanChassis && !cleanReg) return null;

    return (
      db.vehicles.find(
        (v) =>
          v.status !== "sold" &&
          ((cleanChassis && String(v.chassisNumber).trim().toUpperCase() === cleanChassis) ||
            (cleanReg && String(v.registrationNumber).trim().toUpperCase() === cleanReg))
      ) || null
    );
  },
  async listVehicles({ status = "active", approvalStatus } = {}) {
    let results = db.vehicles;
    if (status) results = results.filter((v) => v.status === status);
    if (approvalStatus) results = results.filter((v) => v.approvalStatus === approvalStatus);
    return results;
  },
  async listVehiclesByDealer(dealerId) {
    return db.vehicles.filter((v) => v.dealerId === dealerId);
  },
  async listPendingVehicles() {
    return db.vehicles.filter((v) => v.approvalStatus === "Pending Admin Approval" || v.status === "pending");
  },
  async createVehicle(data) {
    const vehicle = {
      id: nextId("v"),
      rcVerified: false,
      verificationStatus: "pending",
      verificationDetails: null,
      images: [],
      // Strict Gated Lifecycle: Starts in Pending Admin Approval
      approvalStatus: "Pending Admin Approval",
      status: "pending",
      rejectionReason: null,
      submittedAt: new Date().toISOString(),
      approvedAt: null,
      approvedBy: null,
      listedAt: new Date().toISOString(),
      ...data,
    };
    db.vehicles.push(vehicle);
    return vehicle;
  },
  async updateVehicle(id, patch) {
    const vehicle = db.vehicles.find((v) => v.id === id);
    if (!vehicle) return null;
    Object.assign(vehicle, patch);
    return vehicle;
  },
  async approveVehicle(id, adminUserId) {
    const vehicle = db.vehicles.find((v) => v.id === id);
    if (!vehicle) return null;
    vehicle.approvalStatus = "Approved";
    vehicle.status = "active";
    vehicle.rejectionReason = null;
    vehicle.approvedAt = new Date().toISOString();
    vehicle.approvedBy = adminUserId || "admin";
    return vehicle;
  },
  async rejectVehicle(id, reason, adminUserId) {
    const vehicle = db.vehicles.find((v) => v.id === id);
    if (!vehicle) return null;
    vehicle.approvalStatus = "Rejected";
    vehicle.status = "rejected";
    vehicle.rejectionReason = reason || "Declined by admin";
    vehicle.approvedAt = null;
    vehicle.approvedBy = adminUserId || "admin";
    return vehicle;
  },
  async deleteVehicle(id) {
    const idx = db.vehicles.findIndex((v) => v.id === id);
    if (idx === -1) return false;
    db.vehicles.splice(idx, 1);
    return true;
  },
  async deleteVehiclesByDealer(dealerId) {
    db.vehicles = db.vehicles.filter((v) => v.dealerId !== dealerId);
    return true;
  },

  // --- audit logs ---
  async recordAuditLog(entry) {
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(entry);
    if (db.auditLogs.length > 500) db.auditLogs.pop();
    return entry;
  },
  async listAuditLogs({ limit = 100 } = {}) {
    if (!db.auditLogs) db.auditLogs = [];
    return db.auditLogs.slice(0, limit);
  },

  // --- leads ---
  async createLead(data) {
    const lead = { id: nextId("l"), status: "new", createdAt: new Date().toISOString(), ...data };
    db.leads.push(lead);
    return lead;
  },
  async listLeadsByDealer(dealerId) {
    return db.leads.filter((l) => l.dealerId === dealerId);
  },
  async listAllLeads() {
    return db.leads;
  },
  async findLeadById(id) {
    return db.leads.find((l) => l.id === id) || null;
  },
  async updateLead(id, patch) {
    const lead = db.leads.find((l) => l.id === id);
    if (!lead) return null;
    Object.assign(lead, patch);
    return lead;
  },

  // --- reviews ---
  async listReviewsByDealer(dealerId) {
    return db.reviews.filter((r) => r.dealerId === dealerId);
  },
  async listAllReviews() {
    return [...db.reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  async createReview(data) {
    const review = { id: nextId("r"), createdAt: new Date().toISOString(), ...data };
    db.reviews.push(review);
    const { rating, reviewCount } = computeDealerRating(data.dealerId);
    await this.updateDealer(data.dealerId, { rating, reviewCount });
    return review;
  },

  // --- notifications ---
  async createNotification(data) {
    const notification = { id: nextId("n"), createdAt: new Date().toISOString(), ...data };
    db.notifications.push(notification);
    return notification;
  },

  // --- analytics ---
  async dealerAnalytics(dealerId) {
    const vehicles = db.vehicles.filter((v) => v.dealerId === dealerId);
    const leads = db.leads.filter((l) => l.dealerId === dealerId);
    return {
      totalListings: vehicles.length,
      activeListings: vehicles.filter((v) => v.status === "active").length,
      soldListings: vehicles.filter((v) => v.status === "sold").length,
      totalLeads: leads.length,
      newLeads: leads.filter((l) => l.status === "new").length,
      leadsByChannel: {
        whatsapp: leads.filter((l) => l.channel === "whatsapp").length,
        call: leads.filter((l) => l.channel === "call").length,
        email: leads.filter((l) => l.channel === "email").length,
      },
      inventoryValue: vehicles.filter((v) => v.status === "active").reduce((s, v) => s + v.price, 0),
    };
  },
  async platformAnalytics() {
    return {
      totalDealers: db.dealers.length,
      verifiedDealers: db.dealers.filter((d) => d.verificationStatus === "verified").length,
      pendingDealers: db.dealers.filter((d) => d.verificationStatus === "pending").length,
      totalVehicles: db.vehicles.length,
      activeVehicles: db.vehicles.filter((v) => v.status === "active").length,
      verifiedVehicles: db.vehicles.filter((v) => v.rcVerified).length,
      totalLeads: db.leads.length,
      totalReviews: db.reviews.length,
      avgPlatformRating: db.dealers.length
        ? Number((db.dealers.reduce((s, d) => s + (d.rating || 0), 0) / db.dealers.length).toFixed(2))
        : 0,
    };
  },

  // --- dealer microsites ---
  async findDealerSiteByDealerId(dealerId) {
    return db.dealerSites.find((s) => s.dealerId === dealerId) || null;
  },
  async findDealerSiteBySubdomain(subdomain) {
    return db.dealerSites.find((s) => s.subdomain === subdomain) || null;
  },
  async isSubdomainTaken(subdomain, excludeDealerId) {
    return db.dealerSites.some((s) => s.subdomain === subdomain && s.dealerId !== excludeDealerId);
  },
  async upsertDealerSite(dealerId, patch) {
    let site = db.dealerSites.find((s) => s.dealerId === dealerId);
    if (site) {
      Object.assign(site, patch, { updatedAt: new Date().toISOString() });
    } else {
      site = {
        id: nextId("site"),
        dealerId,
        published: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...patch,
      };
      db.dealerSites.push(site);
    }
    return site;
  },
};
