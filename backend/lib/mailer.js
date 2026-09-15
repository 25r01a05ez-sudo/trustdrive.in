/**
 * Mailer — Uses Resend (https://resend.com) HTTP API.
 *
 * WHY RESEND INSTEAD OF NODEMAILER/SMTP:
 * Render's free tier blocks all outbound SMTP ports (25, 465, 587).
 * Resend sends email over HTTPS (port 443) which is always open.
 *
 * SETUP (one-time, 2 minutes):
 * 1. Sign up free at https://resend.com
 * 2. Go to API Keys → Create API Key → copy it
 * 3. In Render Dashboard → Environment → add:
 *      RESEND_API_KEY = re_xxxxxxxxxxxx
 *
 * SENDER ADDRESS:
 * By default Resend lets you send from onboarding@resend.dev (sandbox).
 * To send from trustdrive.co.in@gmail.com you need to verify your domain
 * at resend.com/domains. Until then, use the sandbox sender below.
 */

const { Resend } = require("resend");

let _resend = null;

function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

/**
 * Send a 6-digit OTP to the given email address via Resend HTTP API.
 * Falls back gracefully if RESEND_API_KEY is not set.
 *
 * @param {string} toEmail  Recipient email address
 * @param {string} otp      The 6-digit OTP string
 * @returns {{ delivered: boolean, error?: string }}
 */
async function sendOtpEmail(toEmail, otp) {
  const resend = getResend();

  // Sender: use your verified domain if set, otherwise Resend sandbox
  const senderEmail = process.env.RESEND_FROM_EMAIL || "TrustDrive <onboarding@resend.dev>";

  console.log(
    `\n==============================================\n📬 [OTP GENERATED] Email: ${toEmail} | Code: ${otp}\n==============================================\n`
  );

  if (!resend) {
    console.warn(
      "[mailer] RESEND_API_KEY not set — OTP printed to console only.\n" +
        "Sign up free at https://resend.com and add RESEND_API_KEY to Render env vars."
    );
    return {
      delivered: false,
      error:
        "RESEND_API_KEY not configured. Go to https://resend.com → API Keys and add it to Render → Environment.",
    };
  }

  try {
    const { error } = await resend.emails.send({
      from: senderEmail,
      to: toEmail,
      subject: `${otp} — Your TrustDrive verification code`,
      html: `
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
      text: `Your TrustDrive verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    });

    if (error) {
      console.warn(`[mailer] Resend error: ${JSON.stringify(error)}`);
      return { delivered: false, error: error.message || JSON.stringify(error) };
    }

    console.log(`[mailer] OTP email sent via Resend to ${toEmail}`);
    return { delivered: true };
  } catch (err) {
    console.warn(`[mailer] Resend exception: ${err.message}`);
    return { delivered: false, error: err.message };
  }
}

module.exports = { sendOtpEmail };
