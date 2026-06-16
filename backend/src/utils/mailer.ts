import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

const transportOptions: SMTPTransport.Options & { family?: number } = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  family: 4,
  auth: {
    user: process.env['SMTP_USER'],
    pass: process.env['SMTP_PASS'],
  },
  connectionTimeout: 8000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
};

const transporter = nodemailer.createTransport(transportOptions);

function buildOtpHtml(otp: string, username?: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F2EB;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:#FF5722;padding:28px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:1px">guised up</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px">real people. real moments.</p>
    </div>
    <div style="background:#fff;padding:36px 32px">
      <h2 style="color:#1A1917;margin:0 0 8px;font-size:22px">Password Reset OTP</h2>
      <p style="color:#4D4B47;margin:0 0 24px;font-size:15px">
        ${username ? `Hi <strong>${username}</strong>,<br><br>` : ''}
        Use the code below to reset your password. It expires in <strong>10 minutes</strong>.
      </p>
      <div style="background:#FAF9F6;border:2px dashed #FF5722;border-radius:12px;padding:28px;text-align:center;margin:0 0 24px">
        <span style="font-size:42px;font-weight:bold;letter-spacing:16px;color:#FF5722;font-family:monospace">${otp}</span>
      </div>
      <p style="color:#9A9690;font-size:13px;margin:0">
        If you didn't request this, you can safely ignore this email.
        Your password will remain unchanged.
      </p>
    </div>
    <div style="background:#F0EEE9;padding:16px 32px;text-align:center">
      <p style="color:#9A9690;font-size:12px;margin:0">© 2026 Guised Up · All rights reserved</p>
    </div>
  </div>
</body>
</html>`;
}

export async function verifySmtpConnection(): Promise<void> {
  const smtpUser = process.env['SMTP_USER'];
  const smtpPass = process.env['SMTP_PASS'];
  if (!smtpUser || !smtpPass) {
    console.log('[MAILER] No SMTP credentials — OTP codes will be logged to console (dev mode)');
    return;
  }
  try {
    await transporter.verify();
    console.log('[MAILER] Gmail SMTP connection verified ✓');
  } catch (err) {
    console.warn('[MAILER] Gmail SMTP unreachable (port 587 may be blocked by your network/firewall)');
    console.warn('[MAILER] OTP codes will be logged to the backend console as fallback');
  }
}

export async function sendOtpEmail(to: string, otp: string, username?: string): Promise<void> {
  const smtpUser = process.env['SMTP_USER'];
  const smtpPass = process.env['SMTP_PASS'];

  if (!smtpUser || !smtpPass) {
    logOtpToConsole(to, otp);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Guised Up" <${smtpUser}>`,
      to,
      subject: `${otp} is your Guised Up reset code`,
      html: buildOtpHtml(otp, username),
      text: `Your Guised Up password reset OTP is: ${otp}\nIt expires in 10 minutes.`,
    });
    console.log(`[MAILER] OTP email sent to ${to}`);
  } catch {
    // SMTP blocked by network — fall back to console so the flow still works
    console.warn('[MAILER] SMTP send failed — falling back to console');
    logOtpToConsole(to, otp);
  }
}

function logOtpToConsole(to: string, otp: string): void {
  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║  OTP for ${to}`);
  console.log(`║  Code: ${otp}`);
  console.log('╚══════════════════════════════════════╝\n');
}
