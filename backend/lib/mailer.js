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

const Brevo = require("@getbrevo/brevo");

let _apiInstance = null;

function getBrevoClient() {
  if (_apiInstance) return _apiInstance;

  const key = process.env.BREVO_API_KEY;
  if (!key) return null;

  // Set API key directly on the instance (not via ApiClient.instance)
  _apiInstance = new Brevo.TransactionalEmailsApi();
  _apiInstance.authentications["api-key"].apiKey = key;

  return _apiInstance;
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
  const senderName = "TrustDrive Security";

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: toEmail }];
  sendSmtpEmail.subject = `${otp} — Your TrustDrive verification code`;
  sendSmtpEmail.htmlContent = `
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
  `;
  sendSmtpEmail.textContent = `Your TrustDrive verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;

  try {
    await client.sendTransacEmail(sendSmtpEmail);
    console.log(`[mailer] OTP email sent via Brevo to ${toEmail}`);
    return { delivered: true };
  } catch (err) {
    const msg = err?.response?.text || err.message || JSON.stringify(err);
    console.warn(`[mailer] Brevo send failed: ${msg}`);
    return { delivered: false, error: msg };
  }
}

module.exports = { sendOtpEmail };
