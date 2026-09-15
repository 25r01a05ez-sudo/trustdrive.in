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

const dns = require("dns");
const nodemailer = require("nodemailer");

/**
 * Resolve a hostname to an IPv4 address.
 * This is the nuclear option to prevent Render/cloud hosts from
 * attempting IPv6 connections that fail with ENETUNREACH.
 */
function resolveIPv4(hostname) {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        reject(err || new Error(`No IPv4 address found for ${hostname}`));
      } else {
        resolve(addresses[0]);
      }
    });
  });
}

/**
 * Create a fresh transporter each time, using a resolved IPv4 address.
 * This avoids Nodemailer's internal DNS resolution which may pick IPv6.
 */
async function createTransporter() {
  const user = process.env.GMAIL_USER || process.env.EMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn(
      "[mailer] Email credentials not set (GMAIL_USER/EMAIL_USER or GMAIL_APP_PASSWORD/EMAIL_PASS) — OTPs will be printed to the server console instead of emailed."
    );
    return null;
  }

  // Resolve smtp.gmail.com to a raw IPv4 address (e.g. 142.250.x.x)
  // so Nodemailer cannot accidentally use IPv6
  const smtpHost = "smtp.gmail.com";
  let ipv4Address;
  try {
    ipv4Address = await resolveIPv4(smtpHost);
    console.log(`[mailer] Resolved ${smtpHost} → ${ipv4Address} (IPv4)`);
  } catch (dnsErr) {
    console.error(`[mailer] DNS IPv4 resolution failed for ${smtpHost}:`, dnsErr.message);
    // Fallback: try connecting with hostname anyway
    ipv4Address = smtpHost;
  }

  return nodemailer.createTransport({
    host: ipv4Address,
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    tls: {
      // The TLS certificate is issued for smtp.gmail.com, not the IP,
      // so we must set servername for SNI to validate properly.
      servername: smtpHost,
      rejectUnauthorized: true,
    },
  });
}

/**
 * Send a 6-digit OTP to the given email address.
 * Falls back to console.log if Gmail credentials are not configured.
 *
 * @param {string} toEmail  Recipient email address
 * @param {string} otp      The 6-digit OTP string
 */
async function sendOtpEmail(toEmail, otp) {
  const senderEmail = process.env.GMAIL_USER || process.env.EMAIL_USER || "trustdrive.co.in@gmail.com";

  let transporter;
  try {
    transporter = await createTransporter();
  } catch (err) {
    console.error("[mailer] Failed to create transporter:", err.message);
    return { delivered: false, error: err.message };
  }

  if (!transporter) {
    console.warn(`\n📬 [mailer] EMAIL_USER / EMAIL_PASS not configured. OTP for ${toEmail}: ${otp}\n`);
    return { delivered: false, error: "Email credentials not configured on server" };
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
    console.warn(`[mailer] SMTP send failed (${err.message})`);
    return { delivered: false, error: err.message };
  }
}

module.exports = { sendOtpEmail };
