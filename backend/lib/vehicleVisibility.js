/**
 * Strict Vehicle Privacy & Role-Based Visibility Control
 * 
 * CORE PRIVACY RULES:
 * 1. ONLY Admin users can view the complete, unmasked registration number and chassis number (VIN).
 * 2. Dealers can NEVER view complete registration or chassis numbers after submission (returned only masked).
 * 3. Other dealers, students, buyers, and public users have NO ACCESS to registration/chassis numbers (omitted).
 * 4. Raw VAHAN verification details / engine numbers are scrubbed for non-admin users.
 */

function maskRegistrationNumber(reg) {
  if (!reg) return null;
  const str = String(reg).replace(/\s/g, "").toUpperCase();
  if (str.length <= 4) return "••••••••";
  // E.g. TS09EA1234 -> TS09••••1234
  const prefix = str.slice(0, 4);
  const suffix = str.slice(-4);
  return `${prefix}••••${suffix}`;
}

function maskChassisNumber(chassis) {
  if (!chassis) return null;
  const str = String(chassis).trim();
  if (str.length <= 6) return "••••••••••••";
  // E.g. MA3ERLF1SXXXXXXXX -> MA3••••••••••XX
  return `${str.slice(0, 3)}••••••••••${str.slice(-2)}`;
}

function sanitizeVerificationDetails(details, isAdmin) {
  if (!details) return null;
  if (isAdmin) return details;

  const sanitized = {
    status: details.status,
    source: details.source,
    checkedAt: details.checkedAt,
  };

  if (details.fields) {
    sanitized.fields = {
      registrationStatus: details.fields.registrationStatus || null,
      makeModel: details.fields.makeModel || null,
      registrationDate: details.fields.registrationDate || null,
      fuelType: details.fields.fuelType || null,
      financier: details.fields.financier || "NONE",
      insurance: details.fields.insurance || null,
      puc: details.fields.puc || null,
      rto: details.fields.rto || null,
      // Strictly mask/omit sensitive numbers
      registrationNumber: maskRegistrationNumber(details.fields.registrationNumber),
      chassisNumber: maskChassisNumber(details.fields.chassisNumber),
      engineNumber: "••••••••••",
    };
  }

  // Never expose raw provider payload to non-admin
  return sanitized;
}

function canSeeCompleteSensitiveData(user) {
  return Boolean(user && user.role === "admin");
}

function sanitizeVehicle(vehicle, user) {
  if (!vehicle) return vehicle;

  const isAdmin = canSeeCompleteSensitiveData(user);
  if (isAdmin) {
    return {
      ...vehicle,
      isMasked: false,
    };
  }

  const isOwningDealer = Boolean(
    user && user.role === "dealer" && user.dealerId && user.dealerId === vehicle.dealerId
  );

  const cleanDetails = sanitizeVerificationDetails(vehicle.verificationDetails, false);

  if (isOwningDealer) {
    // Owning dealer gets masked references for tracking their inventory, but never complete values
    return {
      ...vehicle,
      registrationNumber: maskRegistrationNumber(vehicle.registrationNumber),
      chassisNumber: maskChassisNumber(vehicle.chassisNumber),
      isMasked: true,
      verificationDetails: cleanDetails,
    };
  }

  // Public / Buyer / Other Dealers / Students / Anonymous: Completely omit sensitive identifiers
  const { registrationNumber, chassisNumber, ...rest } = vehicle;
  return {
    ...rest,
    isMasked: true,
    verificationDetails: cleanDetails,
  };
}

function sanitizeVehicles(vehicles, user) {
  if (!Array.isArray(vehicles)) return [];
  return vehicles.map((v) => sanitizeVehicle(v, user));
}

module.exports = {
  canSeeCompleteSensitiveData,
  maskRegistrationNumber,
  maskChassisNumber,
  sanitizeVehicle,
  sanitizeVehicles,
};
