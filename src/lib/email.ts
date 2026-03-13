import nodemailer from "nodemailer";

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const FROM = process.env.EMAIL_FROM || `Mess Manager <${process.env.EMAIL_USER}>`;

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Gmail App Password (16 chars)
    },
  });
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${token}`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: FROM,
    to,
    subject: "✅ Verify your Mess Manager account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px;">
        <div style="background:#ffffff;padding:28px;border-radius:10px;border:1px solid #e5e7eb;">
          <h2 style="color:#4f46e5;margin:0 0 8px;">Welcome, ${name}! 👋</h2>
          <p style="color:#374151;margin:0 0 20px;">Click the button below to verify your email address and activate your Mess Manager account.</p>
          <a href="${link}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
            ✅ Verify Email
          </a>
          <p style="color:#9ca3af;font-size:12px;margin:20px 0 0;">This link expires in <strong>24 hours</strong>. If you didn't sign up, ignore this email.</p>
          <hr style="border:none;border-top:1px solid #f3f4f6;margin:16px 0;">
          <p style="color:#9ca3af;font-size:11px;margin:0;word-break:break-all;">Or copy: ${link}</p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: FROM,
    to,
    subject: "🔑 Reset your Mess Manager password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px;">
        <div style="background:#ffffff;padding:28px;border-radius:10px;border:1px solid #e5e7eb;">
          <h2 style="color:#4f46e5;margin:0 0 8px;">Password Reset 🔑</h2>
          <p style="color:#374151;margin:0 0 20px;">Hi <strong>${name}</strong>, we received a request to reset your Mess Manager password.</p>
          <a href="${link}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
            🔑 Reset Password
          </a>
          <p style="color:#9ca3af;font-size:12px;margin:20px 0 0;">This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email — your password won't change.</p>
          <hr style="border:none;border-top:1px solid #f3f4f6;margin:16px 0;">
          <p style="color:#9ca3af;font-size:11px;margin:0;word-break:break-all;">Or copy: ${link}</p>
        </div>
      </div>
    `,
  });
}
