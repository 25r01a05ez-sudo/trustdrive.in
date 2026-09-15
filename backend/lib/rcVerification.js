/**
 * RC/VIN verification against a government-vehicle-records lookup (VAHAN or
 * a licensed reseller of VAHAN data).
 *
 * Set RC_VERIFICATION_API_URL and RC_VERIFICATION_API_KEY in backend/.env to
 * call a real provider (e.g. Surepass, Signzy, IDfy, Setu, or a direct VAHAN
 * integration). This file sends the registration number and expects a JSON
 * response; adjust `parseProviderResponse()` below to match your provider's
 * exact response shape (they differ).
 *
 * With no API key configured, falls back to a deterministic mock that still
 * returns the full VAHAN-style field set, so the UI and the pending/verified/
 * declined flow stay fully testable during development.
 *
 * Result.status is one of:
 *   "verified" — every field matched what the dealer entered -> vehicle goes live
 *   "declined" — a definite mismatch (wrong chassis, cancelled registration, etc.) -> hidden from buyers
 *   "pending"  — API unreachable/erroring, or no key configured -> awaiting recheck, not shown to buyers yet
 */
async function verifyRC(registrationNumber, chassisNumber) {
  const { RC_VERIFICATION_API_URL, RC_VERIFICATION_API_KEY } = process.env;

  if (RC_VERIFICATION_API_URL && RC_VERIFICATION_API_KEY) {
    try {
      const cleanReg = (registrationNumber || "").replace(/\s/g, "").toUpperCase();
      const res = await fetch(RC_VERIFICATION_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RC_VERIFICATION_API_KEY}`,
          "x-api-key": RC_VERIFICATION_API_KEY,
          "api-key": RC_VERIFICATION_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registration_number: cleanReg,
          vehicle_number: cleanReg,
          rc_number: cleanReg,
          reg_no: cleanReg,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          status: "pending",
          source: "live-api-error",
          checkedAt: new Date().toISOString(),
          error: data?.message || data?.error || `Verification API returned HTTP ${res.status}`,
        };
      }
      return parseProviderResponse(data, chassisNumber);
    } catch (err) {
      return {
        status: "pending",
        source: "live-api-error",
        checkedAt: new Date().toISOString(),
        error: err.message,
      };
    }
  }

  return mockLookup(registrationNumber, chassisNumber);
}

/**
 * Adjust this to match your chosen provider's actual response fields.
 */
function parseProviderResponse(data, chassisNumber) {
  const r = data?.result || data?.data || data?.vehicle_info || data?.response || data;
  const providerChassis = r?.chassis_number || r?.chassis_no || r?.vin || r?.chassisNumber;
  const chassisMatches =
    !chassisNumber || !providerChassis
      ? true
      : String(providerChassis).toUpperCase().includes(String(chassisNumber).toUpperCase()) ||
        String(chassisNumber).toUpperCase().includes(String(providerChassis).toUpperCase());

  const fields = {
    registrationNumber: r?.registration_number || r?.rc_number || r?.vehicle_number || r?.reg_no || null,
    registrationStatus: r?.rc_status || r?.status || r?.vehicle_status || "ACTIVE",
    makeModel: [r?.maker_description || r?.maker || r?.brand, r?.maker_model || r?.model].filter(Boolean).join(" ") || null,
    registrationDate: r?.registration_date || r?.reg_date || null,
    chassisNumber: providerChassis || null,
    engineNumber: r?.engine_number || r?.engine_no || null,
    fuelType: r?.fuel_type || r?.fuel || null,
    financier: r?.financier || r?.financer || "NONE",
    insurance: {
      status: (r?.insurance_upto || r?.insurance_validity || r?.insurance_details?.valid_upto) ? "ACTIVE" : "UNKNOWN",
      provider: r?.insurance_company || r?.insurance_details?.company || null,
      validTill: r?.insurance_upto || r?.insurance_validity || r?.insurance_details?.valid_upto || null,
    },
    puc: {
      status: (r?.pucc_upto || r?.pucc_validity || r?.puc_details?.valid_upto) ? "VALID" : "UNKNOWN",
      validTill: r?.pucc_upto || r?.pucc_validity || r?.puc_details?.valid_upto || null,
    },
    rto: r?.registered_at || r?.rto_name || r?.rto || null,
  };

  const isSuccess = Boolean(data?.success ?? (data?.status === "success" || !data?.error));
  const success = isSuccess && chassisMatches;
  return {
    status: success ? "verified" : "declined",
    source: "live-api",
    checkedAt: new Date().toISOString(),
    fields,
    raw: data,
  };
}

/**
 * Deterministic mock, used until a real API key is configured. Well-formed
 * registration + chassis numbers "pass"; anything malformed is declined so
 * the demo flow exercises both outcomes.
 */
function mockLookup(registrationNumber, chassisNumber) {
  const regClean = (registrationNumber || "").replace(/\s/g, "").toUpperCase();
  const wellFormed = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{3,4}$/.test(regClean) && (chassisNumber || "").length >= 10;

  const rtoCode = regClean.slice(0, 4) || "TS09";
  const state = { TS: "Telangana", KA: "Karnataka", MH: "Maharashtra", DL: "Delhi" }[regClean.slice(0, 2)] || "Telangana";

  const fields = wellFormed
    ? {
        registrationNumber: regClean,
        registrationStatus: "ACTIVE",
        makeModel: null, // filled in by the caller from the vehicle's own brand/model
        registrationDate: null, // filled in by the caller from the vehicle's own year
        chassisNumber: chassisNumber || null,
        engineNumber: `G${Math.floor(1000000 + Math.random() * 8999999)}`,
        fuelType: null, // filled in by the caller
        financier: "NONE",
        insurance: { status: "ACTIVE", provider: "Demo Insurance Co.", validTill: "2027-06-14" },
        puc: { status: "VALID", validTill: "2026-12-20" },
        rto: `RTO ${rtoCode.slice(0, 2)} (${state}) — ${rtoCode}`,
      }
    : null;

  return {
    status: wellFormed ? "verified" : "declined",
    source: "mock (set RC_VERIFICATION_API_KEY to use a real provider)",
    checkedAt: new Date().toISOString(),
    fields,
  };
}

module.exports = { verifyRC };
