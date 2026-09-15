/**
 * Notifies you (the site owner) on WhatsApp whenever a dealer submits GST
 * and KYC details, so you can review and approve/reject manually in the
 * admin dashboard.
 *
 * Two modes, and both are always attempted/returned:
 *
 *  1. Automatic (optional) — if WHATSAPP_ACCESS_TOKEN and
 *     WHATSAPP_PHONE_NUMBER_ID are set (from Meta's WhatsApp Cloud API,
 *     free tier available at developers.facebook.com), the message is sent
 *     to ADMIN_WHATSAPP_NUMBER automatically, no clicking required.
 *
 *  2. Manual fallback (zero setup) — a wa.me deep link is always returned,
 *     pre-filled with the same message. The frontend shows this as a
 *     "Send on WhatsApp" button so the flow works immediately even before
 *     you've set up the Cloud API, at no cost.
 *
 * Set ADMIN_WHATSAPP_NUMBER in backend/.env (with country code, e.g.
 * 919876500000) to enable either mode.
 */
async function notifyAdminOnWhatsApp(text) {
  const adminNumber = (process.env.ADMIN_WHATSAPP_NUMBER || "").replace(/[^\d]/g, "");
  const waLink = adminNumber ? `https://wa.me/${adminNumber}?text=${encodeURIComponent(text)}` : null;

  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

  if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID && adminNumber) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: adminNumber,
          type: "text",
          text: { body: text },
        }),
      });
      if (res.ok) {
        return { sentAutomatically: true, waLink };
      }
      console.error("[whatsapp] Cloud API send failed:", await res.text());
    } catch (err) {
      console.error("[whatsapp] Cloud API error:", err.message);
    }
  }

  return { sentAutomatically: false, waLink };
}

async function notifyDealerOnVehicleDecision(dealer, vehicle, status, reason) {
  if (!dealer || !vehicle) return null;
  const dealerPhone = (dealer.whatsapp || "").replace(/[^\d]/g, "");
  if (!dealerPhone) return null;

  const vehicleName = `${vehicle.year || ""} ${vehicle.brand || ""} ${vehicle.model || ""}`.trim();
  let message = "";

  if (status === "Approved") {
    message = `🚗 *TrustDrive Listing Approved!*\n\nHi ${dealer.name || "Dealer"},\nYour listing for *${vehicleName}* has been verified & approved by TrustDrive Admin. It is now live to all buyers!\n\nView listing: ${process.env.PUBLIC_DOMAIN ? `https://${process.env.PUBLIC_DOMAIN}` : "http://localhost:5173"}/vehicle/${vehicle.id}`;
  } else {
    message = `⚠️ *TrustDrive Listing Update*\n\nHi ${dealer.name || "Dealer"},\nYour submission for *${vehicleName}* was not approved.\n*Reason:* ${reason || "Verification requirements not met"}\n\nPlease review and update your listing in your Dealer Dashboard.`;
  }

  const waLink = `https://wa.me/${dealerPhone}?text=${encodeURIComponent(message)}`;
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

  if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: dealerPhone,
          type: "text",
          text: { body: message },
        }),
      });
      if (res.ok) {
        return { sentAutomatically: true, waLink, message };
      }
    } catch (err) {
      console.error("[whatsapp] Error sending dealer alert:", err.message);
    }
  }

  return { sentAutomatically: false, waLink, message };
}

module.exports = { notifyAdminOnWhatsApp, notifyDealerOnVehicleDecision };
