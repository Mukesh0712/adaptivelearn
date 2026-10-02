import nodemailer from 'nodemailer';
import { env, isProduction } from '../config/env.js';

// Sends email through one of two providers, chosen from the environment:
//
//  1. Brevo HTTPS API (BREVO_API_KEY). Used in production on Render, whose
//     free plan blocks outgoing SMTP ports; an HTTPS API call isn't blocked.
//  2. SMTP (SMTP_USER + SMTP_PASS), e.g. Gmail with an App Password. Handy for
//     local development.
//
// With neither, development prints the email to the console so flows can
// still be tested; production logs an error.

type Provider = 'brevo' | 'smtp' | 'none';

const BREVO_API = 'https://api.brevo.com/v3';

export const emailProvider: Provider = env.BREVO_API_KEY
  ? 'brevo'
  : env.SMTP_USER && env.SMTP_PASS
    ? 'smtp'
    : 'none';

const fromEmail = env.MAIL_FROM_EMAIL ?? env.SMTP_USER;

const smtp =
  emailProvider === 'smtp'
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465, // 465 = TLS from the start; 587 = STARTTLS
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : null;

export interface Email {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html: string;
}

// Sends one email and returns the provider's message id. Throws on failure,
// so callers decide what to do (log it, or show a fallback to the user).
export async function sendEmail(email: Email): Promise<string> {
  if (emailProvider === 'brevo') {
    if (!fromEmail) throw new Error('MAIL_FROM_EMAIL is required when using Brevo');
    const res = await fetch(`${BREVO_API}/smtp/email`, {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: fromEmail, name: env.MAIL_FROM_NAME },
        to: [{ email: email.to, ...(email.toName ? { name: email.toName } : {}) }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${body.message ?? res.statusText}`);
    return body.messageId ?? 'unknown';
  }

  if (emailProvider === 'smtp') {
    const info = await smtp!.sendMail({
      from: `${env.MAIL_FROM_NAME} <${fromEmail}>`,
      to: email.toName ? `${email.toName} <${email.to}>` : email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    return info.messageId;
  }

  if (isProduction) throw new Error('No email provider is configured');
  console.log(`\n[dev email] To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`);
  return 'dev-console';
}

// Called once at startup so a wrong key/password or a blocked port shows up
// in the logs immediately, not when someone first needs an email.
export async function verifyEmailConfig(): Promise<void> {
  try {
    if (emailProvider === 'brevo') {
      if (!fromEmail) throw new Error('MAIL_FROM_EMAIL is not set (must be a verified Brevo sender)');
      const res = await fetch(`${BREVO_API}/account`, {
        headers: { 'api-key': env.BREVO_API_KEY!, accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as { email?: string; message?: string };
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${body.message ?? res.statusText}`);
      console.log(`Email: Brevo API OK (account ${body.email}), sending as ${fromEmail}`);
    } else if (emailProvider === 'smtp') {
      await smtp!.verify();
      console.log(`Email: SMTP login OK (${env.SMTP_USER} via ${env.SMTP_HOST}:${env.SMTP_PORT})`);
    } else {
      console.log(
        isProduction
          ? 'Email: NOT configured; set BREVO_API_KEY and MAIL_FROM_EMAIL'
          : 'Email: not configured; emails will be printed here',
      );
    }
  } catch (err) {
    console.error(`Email: ${emailProvider.toUpperCase()} check FAILED: ${err instanceof Error ? err.message : err}`);
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendPasswordResetEmail(to: string, name: string, link: string) {
  const minutes = env.PASSWORD_RESET_TTL_MINUTES;
  const id = await sendEmail({
    to,
    toName: name,
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
  console.log(`Email: password reset link sent to ${to} (message id ${id})`);
}

export async function sendInviteEmail(
  to: string,
  name: string,
  roleLabel: string,
  invitedByName: string,
  link: string,
) {
  const hours = env.INVITE_TTL_HOURS;
  await sendEmail({
    to,
    toName: name,
    subject: `You're invited to join AdaptiveLearn as ${roleLabel === 'Instructor' ? 'an' : 'a'} ${roleLabel}`,
    text:
      `Hi ${name},\n\n${invitedByName} has invited you to join AdaptiveLearn as ${roleLabel}.\n` +
      `Open this link to set your password and activate your account (valid for ${hours} hours):\n\n${link}\n\n` +
      `If you weren't expecting this, you can ignore this email.`,
    html:
      `<p>Hi ${escapeHtml(name)},</p>` +
      `<p>${escapeHtml(invitedByName)} has invited you to join AdaptiveLearn as <strong>${escapeHtml(roleLabel)}</strong>.</p>` +
      `<p><a href="${link}">Set your password and activate your account</a> (valid for ${hours} hours)</p>` +
      `<p>If you weren't expecting this, you can ignore this email.</p>`,
  });
  console.log(`Email: invite sent to ${to}`);
}

export async function sendApprovalEmail(to: string, name: string, loginLink: string) {
  await sendEmail({
    to,
    toName: name,
    subject: 'Your AdaptiveLearn account is approved',
    text:
      `Hi ${name},\n\nGood news: an administrator approved your AdaptiveLearn account.\n` +
      `You can log in now:\n\n${loginLink}\n`,
    html:
      `<p>Hi ${escapeHtml(name)},</p>` +
      `<p>Good news: an administrator approved your AdaptiveLearn account.</p>` +
      `<p><a href="${loginLink}">Log in to AdaptiveLearn</a></p>`,
  });
  console.log(`Email: approval sent to ${to}`);
}
