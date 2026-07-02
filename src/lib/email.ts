// Email notification channel (Gmail SMTP via nodemailer). Mirrors the push
// channel's contract: best-effort fan-out that silently no-ops when the
// feature is off or unconfigured, and never throws into the caller — an email
// failure must never break the in-app notification feed.
//
// Config (all in .env):
//   EMAIL_NOTIFICATIONS_ENABLED  global on/off switch ("true" to enable)
//   GMAIL_USER                   the sending Gmail address
//   GMAIL_APP_PASSWORD           a Gmail App Password (needs 2FA on the account)
//   APP_URL                      absolute base URL used in email links
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

function emailEnabled(): boolean {
  return (
    process.env.EMAIL_NOTIFICATIONS_ENABLED === "true" &&
    !!process.env.GMAIL_USER &&
    !!process.env.GMAIL_APP_PASSWORD
  );
}

// Lazy singleton — only built once, and only if the feature is on.
let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export type EmailPayload = {
  subject: string;
  body: string;
  // App-relative link (e.g. /incidents/abc) rendered as the action button.
  url?: string;
};

// Sends one message BCC'd to every recipient (addresses stay private and it
// is a single SMTP call). Returns the number of recipients, 0 when disabled.
export async function sendEmailToUsers(
  userIds: string[],
  { subject, body, url }: EmailPayload,
): Promise<number> {
  if (!emailEnabled() || userIds.length === 0) return 0;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { email: true },
  });
  const recipients = users.map(u => u.email).filter(Boolean);
  if (recipients.length === 0) return 0;

  const link = url ? new URL(url, APP_URL).toString() : APP_URL;

  try {
    await getTransporter().sendMail({
      from: `"Federated Relief" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER, // required "to"; real recipients ride in bcc
      bcc: recipients,
      subject,
      text: `${body}\n\nOpen: ${link}`,
      html: renderHtml(subject, body, link),
    });
    return recipients.length;
  } catch (err) {
    console.error("[email] send failed:", err);
    return 0;
  }
}

function renderHtml(subject: string, body: string, link: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#f5f8fc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:linear-gradient(135deg,#0aa5c2,#0672a0);padding:18px 24px;">
        <span style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">◆ Federated Relief</span>
      </div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 10px;font-size:18px;color:#15212e;">${escapeHtml(subject)}</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#56687a;">${escapeHtml(body)}</p>
        <a href="${link}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">Open Federated Relief</a>
      </div>
      <div style="padding:14px 24px;border-top:1px solid #eef2f7;">
        <p style="margin:0;font-size:11px;color:#8fa1b3;">You're receiving this because you're part of a relief NGO on this platform.</p>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
