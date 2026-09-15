/**
 * Mailer — Gmail SMTP via Nodemailer.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  WHERE TO ADD YOUR GMAIL CREDENTIALS
 *  Add these two lines to  backend/.env  (copy from .env.example):
 *
 *    GMAIL_USER="your-app-email@gmail.com"
 *    GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
 *
 *  How to get a Gmail App Password (takes ~2 min):
 *    1. Enable 2-Step Verification on your Google account.
 *    2. Visit https://myaccount.google.com/apppasswords
 *    3. Choose App = "Mail", Device = "Other" (name it "TrustDrive").
 *    4. Copy the 16-character code — paste it as GMAIL_APP_PASSWORD.
 *
 *  NOTE: Never commit the real .env file to git. It is already in .gitignore.
 * ──────────────────────────────────────────────────────────────────────────
 */

const nodemailer = require("nodemailer");

// Lazy-initialise so the server still boots even if the env vars are missing
// (falls back to console-logging the OTP for local dev).
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const user = process.env.GMAIL_USER || process.env.EMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;
  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : undefined;

  if (!user || !pass) {
    console.warn(
      "[mailer] Email credentials not set (GMAIL_USER/EMAIL_USER or GMAIL_APP_PASSWORD/EMAIL_PASS) — OTPs will be printed to the server console instead of emailed."
    );
    return null;
  }

  if (host && host !== "smtp.gmail.com") {
    _transporter = nodemailer.createTransport({
      host,
      port: port || 587,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });
  } else {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });
  }

  return _transporter;
}

/**
 * Send a 6-digit OTP to the given email address.
 * Falls back to console.log if Gmail credentials are not configured.
 *
 * @param {string} toEmail  Recipient email address
 * @param {string} otp      The 6-digit OTP string
 */
async function sendOtpEmail(toEmail, otp) {
  const senderEmail = process.env.GMAIL_USER || process.env.EMAIL_USER || "noreply@trustdrive.in";
  const transporter = getTransporter();

  if (!transporter) {
    // Dev fallback — log OTP to server console
    console.warn(`\n📬 [mailer] EMAIL_USER / EMAIL_PASS not configured in environment variables. OTP for ${toEmail}: ${otp}\n`);
    return { delivered: false, error: "Email credentials not configured on server (EMAIL_USER / EMAIL_PASS missing in Render environment variables)" };
  }

  const mailOptions = {
    from: `"TrustDrive Security" <${senderEmail}>`,
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
              <!-- Header -->
              <tr>
                <td style="background:#1a1a2e;padding:28px 40px;">
                  <span style="font-size:22px;font-weight:700;color:#d4af37;letter-spacing:-0.5px;">TrustDrive</span>
                </td>
              </tr>
              <!-- Body -->
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
              <!-- Footer -->
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
  };

  console.log(`\n==============================================\n📬 [OTP GENERATED] Email: ${toEmail} | Code: ${otp}\n==============================================\n`);

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[mailer] OTP email sent successfully to ${toEmail}`);
    return { delivered: true };
  } catch (err) {
    console.warn(`[mailer] Failed to send email via SMTP (${err.message}). Logging OTP to console fallback.`);
    return { delivered: false, error: err.message };
  }
}

module.exports = { sendOtpEmail };
