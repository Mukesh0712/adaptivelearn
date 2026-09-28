import nodemailer from 'nodemailer';
import { env, isProduction } from '../config/env.js';

// Real email only when SMTP credentials are configured. For Gmail, SMTP_PASS
// must be an "App Password" (Google Account → Security → App passwords),
// not your normal Gmail password.
const transporter =
  env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465, // 465 = TLS from the start; 587 = STARTTLS
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : null;

export const isEmailConfigured = transporter !== null;

// Called once at startup: logs in to the SMTP server so a wrong App Password
// or blocked port shows up immediately, not when someone forgets a password.
export async function verifyEmailConfig(): Promise<void> {
  if (!transporter) return;
  try {
    await transporter.verify();
    console.log(`Email: SMTP login OK (${env.SMTP_USER} via ${env.SMTP_HOST}:${env.SMTP_PORT})`);
  } catch (err) {
    console.error(
      `Email: SMTP login FAILED for ${env.SMTP_USER}: ${err instanceof Error ? err.message : err}\n` +
        '  Check SMTP_USER/SMTP_PASS in .env (SMTP_PASS must be a 16-character Gmail App Password).',
    );
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendPasswordResetEmail(to: string, name: string, link: string) {
  const minutes = env.PASSWORD_RESET_TTL_MINUTES;

  if (!transporter) {
    if (isProduction) {
      console.error('Password reset requested but SMTP is not configured; no email sent.');
    } else {
      // Development fallback: print the link so the flow can still be tested.
      console.log(`\n[dev email] Password reset link for ${to} (valid ${minutes} min):\n${link}\n`);
    }
    return;
  }

  const info = await transporter.sendMail({
    from: env.MAIL_FROM ?? `AdaptiveLearn <${env.SMTP_USER}>`,
    to,
    subject: 'Reset your AdaptiveLearn password',
    text:
      `Hi ${name},\n\nWe received a request to reset your AdaptiveLearn password.\n` +
      `Open this link to choose a new one (valid for ${minutes} minutes):\n\n${link}\n\n` +
      `If you didn't request this, you can ignore this email; your password won't change.`,
    html:
      `<p>Hi ${escapeHtml(name)},</p>` +
      `<p>We received a request to reset your AdaptiveLearn password.</p>` +
      `<p><a href="${link}">Choose a new password</a> (valid for ${minutes} minutes)</p>` +
      `<p>If you didn't request this, you can ignore this email; your password won't change.</p>`,
  });
  console.log(`Email: password reset link sent to ${to} (message id ${info.messageId})`);
}
