/**
 * emailTemplateService.ts
 *
 * Manages per-tenant email template overrides with multi-language support.
 *
 * Storage layout:
 *   Platform defaults:  tenants/master/email_templates/{key}_{lang}
 *   Tenant overrides:   tenants/{tenantId}/email_templates/{key}_{lang}
 *
 * Lookup chain: tenant override (lang) → platform default (lang) → platform default (en)
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
} from 'firebase/firestore';

const db = getFirestore(firebaseApp);

// ─── Supported Languages ───────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
] as const;

export type SupportedLang = typeof SUPPORTED_LANGUAGES[number]['code'];

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmailTemplateKey =
  | 'member_invite'
  | 'member_welcome'
  | 'password_reset_custom'
  | 'subscription_expiry'
  | 'invoice_issued'
  | 'account_suspended'
  | 'account_reactivated';

export interface EmailTemplate {
  key:           EmailTemplateKey;
  language:      SupportedLang;
  label:         string;
  description:   string;
  subject:       string;
  bodyHtml:      string;           // supports {{name}}, {{tenantName}}, {{tempPassword}}, {{link}}, {{date}}
  variables:     string[];
  isActive:      boolean;
  isDefault:     boolean;
  updatedAt:     string;
  updatedBy:     string;
  updatedByName: string;
}

// ─── Default templates (EN) ────────────────────────────────────────────────────

export const EMAIL_TEMPLATE_DEFAULTS: Record<
  EmailTemplateKey,
  Omit<EmailTemplate, 'updatedAt' | 'updatedBy' | 'updatedByName' | 'isDefault' | 'language'>
> = {
  member_invite: {
    key:         'member_invite',
    label:       'Member Invitation',
    description: 'Sent when a user is added to a tenant workspace (contains temp password).',
    subject:     'Your {{tenantName}} account is ready — action required',
    bodyHtml:    `<p>Hello <strong>{{name}}</strong>,</p>
<p>An administrator has added you to <strong>{{tenantName}}</strong>.</p>
<p>Use the temporary password below to sign in for the first time:</p>
<div style="font-family:monospace;font-size:18px;font-weight:800;background:#f0f0ff;padding:16px;border-radius:8px;margin:16px 0;letter-spacing:0.1em">
  {{tempPassword}}
</div>
<p>⚠️ You will be required to change this password immediately after your first login.</p>
<p><a href="{{loginUrl}}" style="background:#6366f1;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:8px 0">Sign In Now →</a></p>
<p>— The {{tenantName}} Team</p>`,
    variables:   ['name', 'tenantName', 'tempPassword', 'loginUrl'],
    isActive:    true,
  },
  member_welcome: {
    key:         'member_welcome',
    label:       'Welcome Email',
    description: 'Sent after a new member completes their first login.',
    subject:     'Welcome to {{tenantName}}',
    bodyHtml:    `<p>Hello <strong>{{name}}</strong>,</p>
<p>Welcome to <strong>{{tenantName}}</strong>! Your account is now active.</p>
<p>Access your workspace at: <a href="{{loginUrl}}">{{loginUrl}}</a></p>
<p>— The {{tenantName}} Team</p>`,
    variables:   ['name', 'tenantName', 'loginUrl'],
    isActive:    true,
  },
  password_reset_custom: {
    key:         'password_reset_custom',
    label:       'Password Reset',
    description: 'Custom-branded wrapper for password reset. {{link}} is the Firebase reset link.',
    subject:     'Reset your {{tenantName}} password',
    bodyHtml:    `<p>Hello <strong>{{name}}</strong>,</p>
<p>We received a request to reset your <strong>{{tenantName}}</strong> password.</p>
<p><a href="{{link}}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a></p>
<p>This link expires in 1 hour. If you did not request this, please ignore.</p>
<p>— The {{tenantName}} Team</p>`,
    variables:   ['name', 'tenantName', 'link'],
    isActive:    false,
  },
  subscription_expiry: {
    key:         'subscription_expiry',
    label:       'Subscription Expiry Notice',
    description: 'Sent when a trial or subscription is about to expire.',
    subject:     'Your {{tenantName}} subscription expires on {{date}}',
    bodyHtml:    `<p>Hello <strong>{{name}}</strong>,</p>
<p>This is a reminder that your <strong>{{tenantName}}</strong> subscription will expire on <strong>{{date}}</strong>.</p>
<p>Please contact your administrator to renew before access is suspended.</p>
<p>— MFO Nexus Platform</p>`,
    variables:   ['name', 'tenantName', 'date'],
    isActive:    true,
  },
  invoice_issued: {
    key:         'invoice_issued',
    label:       'Invoice Issued',
    description: 'Sent when a new invoice is generated.',
    subject:     'Invoice {{invoiceNumber}} — {{tenantName}}',
    bodyHtml:    `<p>Hello <strong>{{name}}</strong>,</p>
<p>A new invoice of <strong>{{amount}}</strong> has been issued for <strong>{{tenantName}}</strong>.</p>
<p>Invoice number: <strong>{{invoiceNumber}}</strong></p>
<p>Due date: <strong>{{dueDate}}</strong></p>
<p>Please contact your account manager if you have any questions.</p>
<p>— MFO Nexus Platform</p>`,
    variables:   ['name', 'tenantName', 'amount', 'invoiceNumber', 'dueDate'],
    isActive:    true,
  },
  account_suspended: {
    key:         'account_suspended',
    label:       'Account Suspended',
    description: 'Sent when a user account is suspended.',
    subject:     'Your {{tenantName}} account has been suspended',
    bodyHtml:    `<p>Hello <strong>{{name}}</strong>,</p>
<p>Your <strong>{{tenantName}}</strong> account has been suspended by an administrator.</p>
<p>Please contact your administrator for more information.</p>
<p>— The {{tenantName}} Team</p>`,
    variables:   ['name', 'tenantName'],
    isActive:    true,
  },
  account_reactivated: {
    key:         'account_reactivated',
    label:       'Account Reactivated',
    description: 'Sent when a suspended user account is reactivated.',
    subject:     'Your {{tenantName}} account has been reactivated',
    bodyHtml:    `<p>Hello <strong>{{name}}</strong>,</p>
<p>Good news — your <strong>{{tenantName}}</strong> account has been reactivated.</p>
<p>You can sign in again at: <a href="{{loginUrl}}">{{loginUrl}}</a></p>
<p>— The {{tenantName}} Team</p>`,
    variables:   ['name', 'tenantName', 'loginUrl'],
    isActive:    true,
  },
};

// ─── Portuguese templates ─────────────────────────────────────────────────────

export const EMAIL_TEMPLATE_DEFAULTS_PT: Partial<Record<
  EmailTemplateKey,
  Omit<EmailTemplate, 'updatedAt' | 'updatedBy' | 'updatedByName' | 'isDefault' | 'language'>
>> = {
  member_invite: {
    key:         'member_invite',
    label:       'Convite de Membro',
    description: 'Enviado quando um usuário é adicionado a um espaço de trabalho.',
    subject:     'Sua conta {{tenantName}} está pronta — ação necessária',
    bodyHtml:    `<p>Olá, <strong>{{name}}</strong>,</p>
<p>Um administrador adicionou você ao espaço de trabalho <strong>{{tenantName}}</strong>.</p>
<p>Use a senha temporária abaixo para fazer login pela primeira vez:</p>
<div style="font-family:monospace;font-size:18px;font-weight:800;background:#f0f0ff;padding:16px;border-radius:8px;margin:16px 0;letter-spacing:0.1em">
  {{tempPassword}}
</div>
<p>⚠️ Você deverá alterar esta senha imediatamente após o primeiro acesso.</p>
<p><a href="{{loginUrl}}" style="background:#6366f1;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:8px 0">Entrar Agora →</a></p>
<p>— Equipe {{tenantName}}</p>`,
    variables:   ['name', 'tenantName', 'tempPassword', 'loginUrl'],
    isActive:    true,
  },
};

// ─── Storage key helper ────────────────────────────────────────────────────────

function templateDocId(key: EmailTemplateKey, lang: SupportedLang): string {
  return `${key}_${lang}`;
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Get the effective template for a given key + language.
 * Lookup order: tenant override → platform default for that lang → platform default EN
 */
export async function getTemplateForLanguage(
  tenantId: string,
  key: EmailTemplateKey,
  lang: SupportedLang = 'en',
): Promise<EmailTemplate> {
  const docId = templateDocId(key, lang);
  const fallbackDocId = templateDocId(key, 'en');
  const now = new Date().toISOString();

  const makeDefault = (l: SupportedLang): EmailTemplate => {
    const defaults = l === 'pt' && EMAIL_TEMPLATE_DEFAULTS_PT[key]
      ? EMAIL_TEMPLATE_DEFAULTS_PT[key]!
      : EMAIL_TEMPLATE_DEFAULTS[key];
    return {
      ...defaults,
      language:      l,
      isDefault:     true,
      updatedAt:     now,
      updatedBy:     'system',
      updatedByName: 'System Default',
    };
  };

  // 1. Try tenant override for requested lang
  if (tenantId !== 'master') {
    const tenantSnap = await getDoc(doc(db, 'tenants', tenantId, 'email_templates', docId));
    if (tenantSnap.exists()) return tenantSnap.data() as EmailTemplate;
  }

  // 2. Try platform default for requested lang
  const platformSnap = await getDoc(doc(db, 'tenants', 'master', 'email_templates', docId));
  if (platformSnap.exists()) return platformSnap.data() as EmailTemplate;

  // 3. Try tenant override for English
  if (tenantId !== 'master' && lang !== 'en') {
    const tenantEnSnap = await getDoc(doc(db, 'tenants', tenantId, 'email_templates', fallbackDocId));
    if (tenantEnSnap.exists()) return tenantEnSnap.data() as EmailTemplate;
  }

  // 4. Try platform default for English
  if (lang !== 'en') {
    const platformEnSnap = await getDoc(doc(db, 'tenants', 'master', 'email_templates', fallbackDocId));
    if (platformEnSnap.exists()) return platformEnSnap.data() as EmailTemplate;
  }

  // 5. Hard-coded default
  return makeDefault(lang);
}

/**
 * Get ALL templates for a tenant (all languages). Used by the template editor.
 */
export async function getAllTemplates(tenantId: string): Promise<EmailTemplate[]> {
  const isMaster = tenantId === 'master';

  // Load platform defaults
  const platformSnap = await getDocs(collection(db, 'tenants', 'master', 'email_templates'));
  const platformMap = new Map<string, EmailTemplate>();
  platformSnap.docs.forEach(d => platformMap.set(d.id, { ...d.data(), isDefault: false } as EmailTemplate));

  // Load tenant overrides (if not master)
  const tenantMap = new Map<string, EmailTemplate>();
  if (!isMaster) {
    const tenantSnap = await getDocs(collection(db, 'tenants', tenantId, 'email_templates'));
    tenantSnap.docs.forEach(d => tenantMap.set(d.id, { ...d.data(), isDefault: false } as EmailTemplate));
  }

  // Build the full set: for each key × language, find what exists
  const result: EmailTemplate[] = [];
  const now = new Date().toISOString();

  for (const key of Object.keys(EMAIL_TEMPLATE_DEFAULTS) as EmailTemplateKey[]) {
    for (const { code } of SUPPORTED_LANGUAGES) {
      const docId = templateDocId(key, code as SupportedLang);
      if (tenantMap.has(docId)) {
        result.push(tenantMap.get(docId)!);
      } else if (platformMap.has(docId)) {
        result.push({ ...platformMap.get(docId)!, isDefault: true });
      } else if (code === 'en') {
        // Always include the EN default
        result.push({
          ...EMAIL_TEMPLATE_DEFAULTS[key],
          language:      'en',
          isDefault:     true,
          updatedAt:     now,
          updatedBy:     'system',
          updatedByName: 'System Default',
        });
      } else if (code === 'pt' && EMAIL_TEMPLATE_DEFAULTS_PT[key]) {
        result.push({
          ...EMAIL_TEMPLATE_DEFAULTS_PT[key]!,
          language:      'pt',
          isDefault:     true,
          updatedAt:     now,
          updatedBy:     'system',
          updatedByName: 'System Default',
        });
      }
      // Other languages only show if explicitly saved
    }
  }

  return result;
}

/**
 * Get templates for a specific key across all languages (for the tabbed editor).
 */
export async function getTemplatesByKey(
  tenantId: string,
  key: EmailTemplateKey,
): Promise<Record<SupportedLang, EmailTemplate>> {
  const result: Partial<Record<SupportedLang, EmailTemplate>> = {};
  await Promise.all(
    SUPPORTED_LANGUAGES.map(async ({ code }) => {
      result[code as SupportedLang] = await getTemplateForLanguage(tenantId, key, code as SupportedLang);
    }),
  );
  return result as Record<SupportedLang, EmailTemplate>;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

export async function saveTemplate(
  tenantId: string,
  template: EmailTemplate,
): Promise<void> {
  const docId = templateDocId(template.key, template.language);
  const ref = doc(db, 'tenants', tenantId, 'email_templates', docId);
  await setDoc(ref, { ...template, isDefault: false, updatedAt: new Date().toISOString() });
}

export async function resetTemplateToDefault(
  tenantId: string,
  key: EmailTemplateKey,
  lang: SupportedLang,
): Promise<void> {
  const docId = templateDocId(key, lang);
  // Delete tenant override so the platform default shows through
  const tenantRef = doc(db, 'tenants', tenantId, 'email_templates', docId);
  await deleteDoc(tenantRef);
}

// ─── Template variable substitution ──────────────────────────────────────────

export function renderTemplate(
  template: EmailTemplate,
  vars: Record<string, string>,
): { subject: string; bodyHtml: string } {
  let subject  = template.subject;
  let bodyHtml = template.bodyHtml;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
    subject  = subject.replace(re, v);
    bodyHtml = bodyHtml.replace(re, v);
  }
  return { subject, bodyHtml };
}

// ─── Legacy aliases (used by platform/email-templates/page.tsx) ───────────────
// The page imports these names; they are aliases of the canonical functions above.

export async function getEmailTemplates(tenantId: string): Promise<EmailTemplate[]> {
  return getAllTemplates(tenantId);
}

export async function saveEmailTemplate(
  tenantId: string,
  patch: Pick<EmailTemplate, 'key' | 'subject' | 'bodyHtml' | 'isActive'>,
  performer: { uid: string; name: string },
): Promise<void> {
  const existing = await getTemplateForLanguage(tenantId, patch.key, 'en');
  const merged: EmailTemplate = {
    ...existing,
    subject:       patch.subject,
    bodyHtml:      patch.bodyHtml,
    isActive:      patch.isActive,
    updatedAt:     new Date().toISOString(),
    updatedBy:     performer.uid,
    updatedByName: performer.name,
  };
  return saveTemplate(tenantId, merged);
}

export async function resetEmailTemplate(
  tenantId: string,
  key: EmailTemplateKey,
  lang: SupportedLang = 'en',
): Promise<void> {
  return resetTemplateToDefault(tenantId, key, lang);
}
