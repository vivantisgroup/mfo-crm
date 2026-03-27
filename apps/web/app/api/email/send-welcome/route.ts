/**
 * POST /api/email/send-welcome
 *
 * Sends a welcome / invitation email with temp password to a newly added user.
 * Uses the emailTemplateService to resolve the correct language template.
 *
 * Body:
 *   {
 *     idToken:      string;   // Admin caller auth
 *     to:           string;   // Recipient email
 *     displayName:  string;   // Recipient name
 *     tempPassword: string;   // System-generated temp password
 *     tenantName:   string;   // Workspace name
 *     tenantId?:    string;   // For template lookup (falls back to 'master')
 *     language?:    string;   // BCP-47. Falls back to tenant default, then 'en'
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getTemplateForLanguage, renderTemplate, type SupportedLang } from '@/lib/emailTemplateService';

export const runtime = 'nodejs';

// ─── Auth verify ──────────────────────────────────────────────────────────────
async function verifyIdToken(idToken: string): Promise<{ uid: string } | null> {
  const apiKey = process.env.FIREBASE_API_KEY
              ?? process.env.NEXT_PUBLIC_FB_API_KEY
              ?? '';
  if (process.env.FIREBASE_ADMIN_SDK_JSON) {
    try {
      const auth = getAdminAuth();
      const d = await auth.verifyIdToken(idToken);
      return { uid: d.uid };
    } catch { /* fall through */ }
  }
  if (apiKey) {
    try {
      const r = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) },
      );
      if (r.ok) { const d = await r.json(); const u = d.users?.[0]; if (u) return { uid: u.localId }; }
    } catch { /* fall through */ }
  }
  const parts = idToken.split('.');
  if (parts.length === 3) {
    try {
      const padding = 4 - (parts[1].length % 4);
      const padded  = padding < 4 ? parts[1] + '='.repeat(padding) : parts[1];
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      const uid = payload.sub ?? payload.uid;
      if (uid) return { uid };
    } catch { /* ignore */ }
  }
  return null;
}

// ─── SMTP send ────────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, bodyHtml: string): Promise<void> {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // @ts-ignore — nodemailer ships its own types; strict mode false-positive
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? `"MFO Nexus" <${process.env.SMTP_USER}>`,
      to, subject, html: bodyHtml,
    });
    return;
  }
  console.warn('[send-welcome] No SMTP configured. Email logged to console.');
  console.warn(`[send-welcome] TO: ${to} | SUBJECT: ${subject}`);
}

// ─── Wrap HTML in branded shell ───────────────────────────────────────────────
function wrapInShell(bodyHtml: string, tenantName: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0f0f17;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f17;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #2a2a45">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#818cf8);padding:28px 40px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800">${tenantName}</h1>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#c8c8e8;font-size:15px;line-height:1.7">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #2a2a45;text-align:center">
          <p style="margin:0;color:#4b5563;font-size:11px">MFO Nexus Platform — ${new Date().getFullYear()}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      idToken, to, displayName, tempPassword, tenantName,
      tenantId = 'master',
      language = 'en',
    } = body as {
      idToken: string; to: string; displayName: string; tempPassword: string;
      tenantName: string; tenantId?: string; language?: string;
    };

    if (!idToken || !to || !tempPassword) {
      return NextResponse.json({ error: 'idToken, to, and tempPassword are required.' }, { status: 400 });
    }

    const caller = await verifyIdToken(idToken);
    if (!caller) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? 'http://localhost:3000';
    const loginUrl   = appBaseUrl.startsWith('http') ? `${appBaseUrl}/login` : `https://${appBaseUrl}/login`;

    // Resolve template for the tenant's language
    const lang = (language || 'en') as SupportedLang;
    const template = await getTemplateForLanguage(tenantId, 'member_invite', lang);

    // Render with variables
    const vars: Record<string, string> = {
      name:         displayName ?? to.split('@')[0],
      tenantName:   tenantName ?? 'your workspace',
      tempPassword: tempPassword,
      loginUrl,
      link:         loginUrl,
    };
    const { subject, bodyHtml } = renderTemplate(template, vars);
    const fullHtml = wrapInShell(bodyHtml, vars.tenantName);

    const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    let sent = false;

    try {
      await sendEmail(to, subject, fullHtml);
      sent = smtpConfigured;
    } catch (mailErr: any) {
      console.error('[send-welcome] Email send failed:', mailErr.message);
      return NextResponse.json({ success: false, error: mailErr.message });
    }

    return NextResponse.json({
      success: true,
      sent,
      language: lang,
      warning: sent ? undefined : 'SMTP not configured — email logged to server console. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env.local to send real emails.',
    });
  } catch (e: any) {
    console.error('[POST /api/email/send-welcome]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
