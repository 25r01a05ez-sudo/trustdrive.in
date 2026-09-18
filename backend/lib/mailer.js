/**
 * Mailer — Uses Brevo (formerly Sendinblue) HTTP API.
 *
 * WHY BREVO INSTEAD OF SMTP:
 * Render's free tier blocks all outbound SMTP ports (25, 465, 587).
 * Brevo sends email over HTTPS (port 443) which is always open.
 * Free tier = 300 emails/day. No domain verification needed.
 *
 * SETUP (one-time, ~2 minutes):
 * 1. Sign up free at https://www.brevo.com
 * 2. Go to Settings → API Keys → Generate a new API key
 * 3. In Render Dashboard → Environment → add:
 *      BREVO_API_KEY = xkeysib-xxxxxxxxxxxxxxxx
 */

const { BrevoClient } = require("@getbrevo/brevo");

let _client = null;

function getBrevoClient() {
  if (_client) return _client;
  const key = process.env.BREVO_API_KEY;
  if (!key) return null;
  _client = new BrevoClient({ apiKey: key });
  return _client;
}

/**
 * Send a 6-digit OTP to the given email address via Brevo HTTP API.
 *
 * @param {string} toEmail  Recipient email address
 * @param {string} otp      The 6-digit OTP string
 * @returns {{ delivered: boolean, error?: string }}
 */
async function sendOtpEmail(toEmail, otp) {
  const client = getBrevoClient();

  console.log(
    `\n==============================================\n📬 [OTP GENERATED] Email: ${toEmail} | Code: ${otp}\n==============================================\n`
  );

  if (!client) {
    console.warn(
      "[mailer] BREVO_API_KEY not set — OTP printed to console only.\n" +
        "Sign up free at https://www.brevo.com → Settings → API Keys, then add BREVO_API_KEY to Render env vars."
    );
    return {
      delivered: false,
      error: "BREVO_API_KEY not configured on server. Add it in Render → Environment.",
    };
  }

  const senderEmail = process.env.BREVO_FROM_EMAIL || "trustdrive.co.in@gmail.com";

  try {
    await client.transactionalEmails.sendTransacEmail({
      sender: { name: "TrustDrive Security", email: senderEmail },
      to: [{ email: toEmail }],
      subject: `${otp} — Your TrustDrive verification code`,
      htmlContent: `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
        <body style="margin:0;padding:0;background:#f8f5f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5f0;padding:40px 0;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
                <tr>
                  <td style="background:#1a1a2e;padding:28px 40px;">
                    <span style="font-size:22px;font-weight:700;color:#d4af37;letter-spacing:-0.5px;">TrustDrive</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <p style="margin:0 0 8px;font-size:15px;color:#444;">Your one-time verification code is:</p>
                    <div style="background:#f8f5f0;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
                      <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#1a1a2e;">${otp}</span>
                    </div>
                    <p style="margin:0 0 8px;font-size:13px;color:#888;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
                    <p style="margin:0;font-size:13px;color:#aaa;">If you didn't request this, you can safely ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8f5f0;padding:20px 40px;border-top:1px solid #eee;">
                    <p style="margin:0;font-size:12px;color:#bbb;text-align:center;">© ${new Date().getFullYear()} TrustDrive — Verified Used Car Marketplace</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      textContent: `Your TrustDrive verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    });

    console.log(`[mailer] OTP email sent via Brevo to ${toEmail}`);
    return { delivered: true };
  } catch (err) {
    const msg = err?.body?.message || err?.message || JSON.stringify(err);
    console.warn(`[mailer] Brevo send failed: ${msg}`);
    return { delivered: false, error: msg };
  }
}

module.exports = { sendOtpEmail, sendListingExpiryReminder, sendListingRejectedEmail };

/**
 * Send a 3-day expiry reminder to a dealer.
 */
async function sendListingExpiryReminder(toEmail, dealerName, vehicleName, expiresAt) {
  const client = getBrevoClient();
  const senderEmail = process.env.BREVO_FROM_EMAIL || "trustdrive.co.in@gmail.com";
  const expStr = new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  console.log(`[mailer] Sending expiry reminder to ${toEmail} for ${vehicleName} (expires ${expStr})`);

  if (!client) {
    console.warn("[mailer] BREVO_API_KEY not set — expiry reminder not sent.");
    return { delivered: false, error: "BREVO_API_KEY not configured" };
  }

  try {
    await client.transactionalEmails.sendTransacEmail({
      sender: { name: "TrustDrive India", email: senderEmail },
      to: [{ email: toEmail }],
      subject: `⚠️ Your ${vehicleName} listing expires in 3 days`,
      htmlContent: `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
        <body style="margin:0;padding:0;background:#f8f5f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5f0;padding:40px 0;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
                <tr>
                  <td style="background:#1a1a2e;padding:28px 40px;">
                    <span style="font-size:22px;font-weight:700;color:#d4af37;letter-spacing:-0.5px;">TrustDrive India</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <p style="margin:0 0 8px;font-size:15px;color:#444;">Hi ${dealerName},</p>
                    <div style="background:#fff8e1;border:2px solid #f59e0b;border-radius:12px;padding:20px;margin:20px 0;">
                      <p style="margin:0;font-size:16px;font-weight:700;color:#92400e;">⚠️ Your listing expires in 3 days</p>
                      <p style="margin:8px 0 0;font-size:14px;color:#78350f;">
                        Your <strong>${vehicleName}</strong> listing will expire on <strong>${expStr}</strong>.
                      </p>
                    </div>
                    <p style="margin:0 0 8px;font-size:13px;color:#555;">
                      After expiry, the listing will no longer appear to buyers. Renew it from your dealer dashboard to keep it active.
                    </p>
                    <div style="text-align:center;margin-top:24px;">
                      <a href="${process.env.PUBLIC_DOMAIN ? `https://${process.env.PUBLIC_DOMAIN}/dealer` : "http://localhost:5173/dealer"}" 
                         style="background:#1a1a2e;color:#d4af37;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;display:inline-block;font-size:14px;">
                        Renew Listing →
                      </a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8f5f0;padding:20px 40px;border-top:1px solid #eee;">
                    <p style="margin:0;font-size:12px;color:#bbb;text-align:center;">© ${new Date().getFullYear()} TrustDrive India — Verified Used Car Marketplace</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      textContent: `Hi ${dealerName},\n\nYour ${vehicleName} listing on TrustDrive India expires on ${expStr}.\n\nPlease log in to your dealer dashboard to renew it before it expires.`,
    });
    return { delivered: true };
  } catch (err) {
    const msg = err?.body?.message || err?.message || JSON.stringify(err);
    console.warn(`[mailer] Expiry reminder send failed: ${msg}`);
    return { delivered: false, error: msg };
  }
}

/**
 * Send a rejection notification to a dealer when their vehicle listing is rejected.
 */
async function sendListingRejectedEmail(toEmail, dealerName, vehicleName, reason) {
  const client = getBrevoClient();
  const senderEmail = process.env.BREVO_FROM_EMAIL || "trustdrive.co.in@gmail.com";

  console.log(`[mailer] Sending rejection email to ${toEmail} for ${vehicleName}`);

  if (!client) {
    console.warn("[mailer] BREVO_API_KEY not set — rejection email not sent.");
    return { delivered: false, error: "BREVO_API_KEY not configured" };
  }

  try {
    await client.transactionalEmails.sendTransacEmail({
      sender: { name: "TrustDrive India", email: senderEmail },
      to: [{ email: toEmail }],
      subject: `Your ${vehicleName} listing was not approved`,
      htmlContent: `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
        <body style="margin:0;padding:0;background:#f8f5f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5f0;padding:40px 0;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
                <tr>
                  <td style="background:#1a1a2e;padding:28px 40px;">
                    <span style="font-size:22px;font-weight:700;color:#d4af37;letter-spacing:-0.5px;">TrustDrive India</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <p style="margin:0 0 8px;font-size:15px;color:#444;">Hi ${dealerName},</p>
                    <p style="margin:0 0 16px;font-size:14px;color:#555;">
                      Your listing for <strong>${vehicleName}</strong> was reviewed by our team and was not approved at this time.
                    </p>
                    ${reason ? `
                    <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:16px;margin:16px 0;">
                      <p style="margin:0;font-size:13px;font-weight:700;color:#991b1b;">Reason:</p>
                      <p style="margin:6px 0 0;font-size:13px;color:#7f1d1d;">${reason}</p>
                    </div>` : ""}
                    <p style="margin:16px 0 8px;font-size:13px;color:#555;">
                      You can make corrections and resubmit the vehicle from your dealer dashboard. No payment will be charged for rejected listings.
                    </p>
                    <div style="text-align:center;margin-top:24px;">
                      <a href="${process.env.PUBLIC_DOMAIN ? `https://${process.env.PUBLIC_DOMAIN}/dealer` : "http://localhost:5173/dealer"}"
                         style="background:#1a1a2e;color:#d4af37;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;display:inline-block;font-size:14px;">
                        Go to Dashboard →
                      </a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8f5f0;padding:20px 40px;border-top:1px solid #eee;">
                    <p style="margin:0;font-size:12px;color:#bbb;text-align:center;">© ${new Date().getFullYear()} TrustDrive India — Verified Used Car Marketplace</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
      textContent: `Hi ${dealerName},\n\nYour ${vehicleName} listing was not approved.\n\nReason: ${reason || "Verification requirements not met"}\n\nYou can correct and resubmit the vehicle from your dealer dashboard. No payment will be charged.`,
    });
    return { delivered: true };
  } catch (err) {
    const msg = err?.body?.message || err?.message || JSON.stringify(err);
    console.warn(`[mailer] Rejection email send failed: ${msg}`);
    return { delivered: false, error: msg };
  }
}

