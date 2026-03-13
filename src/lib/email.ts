import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM = process.env.EMAIL_FROM || "Mess Manager <onboarding@resend.dev>";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: "✅ Verify your Mess Manager account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;">
        <h2 style="color:#4f46e5;margin-bottom:8px;">Welcome, ${name}! 👋</h2>
        <p style="color:#374151;">Please verify your email address to activate your account.</p>
        <a href="${link}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
          Verify Email
        </a>
        <p style="color:#9ca3af;font-size:12px;">This link expires in 24 hours. If you didn&apos;t sign up, ignore this email.</p>
        <p style="color:#9ca3af;font-size:12px;">Or copy this link: ${link}</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: "🔑 Reset your Mess Manager password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;">
        <h2 style="color:#4f46e5;margin-bottom:8px;">Password Reset</h2>
        <p style="color:#374151;">Hi ${name}, we received a request to reset your password.</p>
        <a href="${link}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
          Reset Password
        </a>
        <p style="color:#9ca3af;font-size:12px;">This link expires in 1 hour. If you didn&apos;t request this, ignore this email — your password won&apos;t change.</p>
        <p style="color:#9ca3af;font-size:12px;">Or copy this link: ${link}</p>
      </div>
    `,
  });
}
