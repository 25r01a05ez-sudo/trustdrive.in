const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const inMemoryAuditLogs = [];

function unpackVehicle(v) {
  if (!v) return null;
  const meta = v.verificationDetails || {};
  const approvalStatus =
    meta.approvalStatus || (v.status === "active" ? "Approved" : "Pending Admin Approval");
  const rejectionReason = meta.rejectionReason || null;
  const submittedAt = meta.submittedAt || v.listedAt;
  const approvedAt = meta.approvedAt || null;
  const approvedBy = meta.approvedBy || null;
  const featured = Boolean(meta.featured);

  return {
    ...v,
    approvalStatus,
    rejectionReason,
    submittedAt,
    approvedAt,
    approvedBy,
    featured,
  };
}

module.exports = {
  // --- users ---
  async findUserByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },
  async findUserById(id) {
    return prisma.user.findUnique({ where: { id } });
  },
  async createUser(data) {
    return prisma.user.create({ data });
  },
  async setUserDealerId(userId, dealerId) {
    return prisma.user.update({ where: { id: userId }, data: { dealerId } });
  },
  async updateUser(userId, patch) {
    return prisma.user.update({ where: { id: userId }, data: patch });
  },

  // --- dealers ---
  async listDealers({ city, verified } = {}) {
    return prisma.dealer.findMany({
      where: {
        ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
        ...(verified ? { verificationStatus: "verified" } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  },
  async findDealerById(id) {
    return prisma.dealer.findUnique({ where: { id } });
  },
  async createDealer(data) {
    return prisma.dealer.create({ data });
  },
  async updateDealer(id, patch) {
    return prisma.dealer.update({ where: { id }, data: patch });
  },
  async listPendingDealers() {
    return prisma.dealer.findMany({ where: { verificationStatus: "pending" } });
  },
  async deleteDealer(id) {
    await prisma.dealer.delete({ where: { id } });
    return true;
  },
  async unsetUsersDealerId(dealerId) {
    await prisma.user.updateMany({ where: { dealerId }, data: { dealerId: null } });
    return true;
  },

  // --- vehicles ---
  async findVehicleById(id) {
    const v = await prisma.vehicle.findUnique({ where: { id } });
    return unpackVehicle(v);
  },
  async listVehicles({ status, approvalStatus } = {}) {
    const vehicles = await prisma.vehicle.findMany({
      include: { dealer: true },
      orderBy: { listedAt: "desc" },
    });
    let unpacked = vehicles.map(unpackVehicle);
    if (status) {
      unpacked = unpacked.filter(
        (v) =>
          v.status === status ||
          (status === "pending" && v.approvalStatus === "Pending Admin Approval") ||
          (status === "active" && v.approvalStatus === "Approved")
      );
    }
    if (approvalStatus) {
      unpacked = unpacked.filter((v) => v.approvalStatus === approvalStatus);
    }
    return unpacked;
  },
  async listVehiclesByDealer(dealerId) {
    const vehicles = await prisma.vehicle.findMany({ where: { dealerId } });
    return vehicles.map(unpackVehicle);
  },
  async listPendingVehicles() {
    const vehicles = await prisma.vehicle.findMany({
      include: { dealer: true },
      orderBy: { listedAt: "desc" },
    });
    return vehicles
      .map(unpackVehicle)
      .filter((v) => v.approvalStatus === "Pending Admin Approval" || v.status === "draft");
  },
  async createVehicle(data) {
    const {
      approvalStatus,
      rejectionReason,
      submittedAt,
      approvedAt,
      approvedBy,
      status,
      ...prismaData
    } = data;

    const meta = {
      ...(prismaData.verificationDetails || {}),
      approvalStatus: approvalStatus || "Pending Admin Approval",
      rejectionReason: rejectionReason || null,
      submittedAt: submittedAt || new Date().toISOString(),
      approvedAt: approvedAt || null,
      approvedBy: approvedBy || null,
    };

    const prismaStatus = status === "active" ? "active" : status === "sold" ? "sold" : "draft";

    const created = await prisma.vehicle.create({
      data: {
        ...prismaData,
        status: prismaStatus,
        verificationDetails: meta,
      },
    });
    return unpackVehicle(created);
  },
  async updateVehicle(id, patch) {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) return null;

    const {
      approvalStatus,
      rejectionReason,
      submittedAt,
      approvedAt,
      approvedBy,
      status,
      featured,
      ...prismaPatch
    } = patch;

    const meta = {
      ...(existing.verificationDetails || {}),
      ...(prismaPatch.verificationDetails || {}),
      ...(approvalStatus !== undefined ? { approvalStatus } : {}),
      ...(rejectionReason !== undefined ? { rejectionReason } : {}),
      ...(approvedAt !== undefined ? { approvedAt } : {}),
      ...(approvedBy !== undefined ? { approvedBy } : {}),
      ...(featured !== undefined ? { featured: Boolean(featured) } : {}),
    };

    const updateData = {
      ...prismaPatch,
      verificationDetails: meta,
    };

    if (status) {
      updateData.status = status === "active" ? "active" : status === "sold" ? "sold" : "draft";
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: updateData,
    });
    return unpackVehicle(updated);
  },
  async approveVehicle(id, adminUserId) {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) return null;

    const meta = {
      ...(existing.verificationDetails || {}),
      approvalStatus: "Approved",
      rejectionReason: null,
      approvedAt: new Date().toISOString(),
      approvedBy: adminUserId || "admin",
    };

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        status: "active",
        verificationDetails: meta,
      },
    });
    return unpackVehicle(updated);
  },
  async rejectVehicle(id, reason, adminUserId) {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) return null;

    const meta = {
      ...(existing.verificationDetails || {}),
      approvalStatus: "Rejected",
      rejectionReason: reason || "Declined by admin",
      approvedBy: adminUserId || "admin",
    };

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        status: "draft",
        verificationDetails: meta,
      },
    });
    return unpackVehicle(updated);
  },
  async findVehicleByChassisOrReg(chassisNumber, registrationNumber) {
    const cleanChassis = String(chassisNumber || "").trim().toUpperCase();
    const cleanReg = String(registrationNumber || "").trim().toUpperCase();
    if (!cleanChassis && !cleanReg) return null;

    try {
      const vehicles = await prisma.vehicle.findMany({
        where: {
          OR: [
            ...(cleanChassis ? [{ chassisNumber: { equals: cleanChassis, mode: "insensitive" } }] : []),
            ...(cleanReg ? [{ registrationNumber: { equals: cleanReg, mode: "insensitive" } }] : []),
          ],
        },
      });
      const activeOrDraft = vehicles.find((v) => v.status !== "sold");
      return unpackVehicle(activeOrDraft || null);
    } catch (e) {
      return null;
    }
  },
  async deleteVehicle(id) {
    await prisma.vehicle.delete({ where: { id } });
    return true;
  },
  async deleteVehiclesByDealer(dealerId) {
    await prisma.vehicle.deleteMany({ where: { dealerId } });
    return true;
  },

  // --- audit logs (Persistent Postgres with in-memory fallback) ---
  async recordAuditLog(entry) {
    try {
      const created = await prisma.auditLog.create({
        data: {
          action: entry.action || "unknown",
          userId: entry.userId || null,
          userRole: entry.userRole || null,
          vehicleId: entry.vehicleId || null,
          dealerId: entry.dealerId || null,
          details: entry.details || null,
          timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
        },
      });
      return created;
    } catch (err) {
      console.warn("[prismaStore] AuditLog Postgres fallback to memory:", err.message);
      inMemoryAuditLogs.unshift(entry);
      if (inMemoryAuditLogs.length > 500) inMemoryAuditLogs.pop();
      return entry;
    }
  },
  async listAuditLogs({ limit = 100 } = {}) {
    try {
      const logs = await prisma.auditLog.findMany({
        orderBy: { timestamp: "desc" },
        take: limit,
      });
      return logs;
    } catch (err) {
      return inMemoryAuditLogs.slice(0, limit);
    }
  },

  // --- leads ---
  async createLead(data) {
    return prisma.lead.create({ data });
  },
  async listLeadsByDealer(dealerId) {
    return prisma.lead.findMany({
      where: { dealerId },
      include: { vehicle: true },
      orderBy: { createdAt: "desc" },
    });
  },
  async listAllLeads() {
    return prisma.lead.findMany({ include: { vehicle: true }, orderBy: { createdAt: "desc" } });
  },
  async findLeadById(id) {
    return prisma.lead.findUnique({ where: { id } });
  },
  async updateLead(id, patch) {
    return prisma.lead.update({ where: { id }, data: patch });
  },

  // --- reviews ---
  async listReviewsByDealer(dealerId) {
    return prisma.review.findMany({ where: { dealerId }, orderBy: { createdAt: "desc" } });
  },
  async listAllReviews() {
    return prisma.review.findMany({ orderBy: { createdAt: "desc" }, include: { dealer: true } });
  },
  async createReview(data) {
    const review = await prisma.review.create({ data });
    const agg = await prisma.review.aggregate({
      where: { dealerId: data.dealerId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.dealer.update({
      where: { id: data.dealerId },
      data: {
        rating: Number((agg._avg.rating || 0).toFixed(1)),
        reviewCount: agg._count.rating,
      },
    });
    return review;
  },

  // --- notifications ---
  async createNotification(data) {
    return prisma.notification.create({ data });
  },

  // --- analytics ---
  async dealerAnalytics(dealerId) {
    const [vehicles, leads] = await Promise.all([
      prisma.vehicle.findMany({ where: { dealerId } }),
      prisma.lead.findMany({ where: { dealerId } }),
    ]);
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
      inventoryValue: vehicles
        .filter((v) => v.status === "active")
        .reduce((s, v) => s + v.price, 0),
    };
  },
  async platformAnalytics() {
    const [dealers, vehicles, leadCount, reviewCount] = await Promise.all([
      prisma.dealer.findMany(),
      prisma.vehicle.findMany(),
      prisma.lead.count(),
      prisma.review.count(),
    ]);
    return {
      totalDealers: dealers.length,
      verifiedDealers: dealers.filter((d) => d.verificationStatus === "verified").length,
      pendingDealers: dealers.filter((d) => d.verificationStatus === "pending").length,
      totalVehicles: vehicles.length,
      activeVehicles: vehicles.filter((v) => v.status === "active").length,
      verifiedVehicles: vehicles.filter((v) => v.rcVerified).length,
      totalLeads: leadCount,
      totalReviews: reviewCount,
      avgPlatformRating: dealers.length
        ? Number((dealers.reduce((s, d) => s + (d.rating || 0), 0) / dealers.length).toFixed(2))
        : 0,
    };
  },

  // --- dealer microsites ---
  async findDealerSiteByDealerId(dealerId) {
    return prisma.dealerSite.findUnique({ where: { dealerId } });
  },
  async findDealerSiteBySubdomain(subdomain) {
    return prisma.dealerSite.findUnique({ where: { subdomain } });
  },
  async isSubdomainTaken(subdomain, excludeDealerId) {
    const existing = await prisma.dealerSite.findUnique({ where: { subdomain } });
    return Boolean(existing && existing.dealerId !== excludeDealerId);
  },
  async upsertDealerSite(dealerId, patch) {
    const existing = await prisma.dealerSite.findUnique({ where: { dealerId } });
    if (existing) {
      return prisma.dealerSite.update({
        where: { dealerId },
        data: patch,
      });
    }
    const defaultSub = patch.subdomain || `dealer-${String(dealerId).slice(-6).toLowerCase()}`;
    return prisma.dealerSite.create({
      data: {
        dealerId,
        published: false,
        subdomain: defaultSub,
        ...patch,
      },
    });
  },
};
