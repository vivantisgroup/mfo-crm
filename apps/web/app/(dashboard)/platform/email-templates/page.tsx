'use client';
/**
 * Platform-level email template editor — with per-language tabs.
 * Edits platform default templates (tenants/master/email_templates/).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
 getTemplatesByKey, saveTemplate, resetTemplateToDefault,
 SUPPORTED_LANGUAGES, EMAIL_TEMPLATE_DEFAULTS,
 type EmailTemplate, type EmailTemplateKey, type SupportedLang,
} from '@/lib/emailTemplateService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ConfirmDialog, type ConfirmOptions } from '@/components/ConfirmDialog';
import {
 Mail, RotateCcw, Save, Loader2,
 CheckCircle2, AlertCircle, Eye, Code2, ShieldCheck, Globe,
} from 'lucide-react';

const MASTER_TENANT_ID = 'master';

/** All template types — each appears once in the sidebar */
const TEMPLATE_KEYS = Object.keys(EMAIL_TEMPLATE_DEFAULTS) as EmailTemplateKey[];

const TEMPLATE_ICONS: Record<EmailTemplateKey, string> = {
 member_invite: '✉️',
 member_welcome: '👋',
 password_reset_custom: '🔑',
 subscription_expiry: '⏳',
 invoice_issued: '🧾',
 account_suspended: '🚫',
 account_reactivated: '✅',
};

function HtmlPreview({ html }: { html: string }) {
 return (
 <div className="border border-border rounded-xl overflow-hidden bg-white dark:bg-slate-900">
 <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/50 text-xs text-muted-foreground">
 <Eye className="w-3 h-3" /> Email Preview
 </div>
 <div className="p-6 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
 </div>
 );
}

export default function PlatformEmailTemplatesPage() {
 const { user, isSaasMasterAdmin } = useAuth();

 const [selectedKey, setSelectedKey] = useState<EmailTemplateKey>('member_invite');
 const [selectedLang, setSelectedLang] = useState<SupportedLang>('en');
 /** Map of lang → EmailTemplate for the currently selected key */
 const [langMap, setLangMap] = useState<Record<SupportedLang, EmailTemplate> | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
 const [previewMode, setPreviewMode] = useState<'code' | 'preview'>('code');
 const [subject, setSubject] = useState('');
 const [bodyHtml, setBodyHtml] = useState('');
 const [isActive, setIsActive] = useState(true);
 const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);

 const load = useCallback(async () => {
 setLoading(true);
 try {
 const map = await getTemplatesByKey(MASTER_TENANT_ID, selectedKey);
 setLangMap(map);
 const t = map[selectedLang];
 if (t) { setSubject(t.subject); setBodyHtml(t.bodyHtml); setIsActive(t.isActive); }
 } catch { /* ignore */ }
 finally { setLoading(false); }
 }, [selectedKey, selectedLang]);

 useEffect(() => { load(); }, [load]);

 // When lang changes, populate from already-loaded map
 useEffect(() => {
 if (!langMap) return;
 const t = langMap[selectedLang];
 if (t) { setSubject(t.subject); setBodyHtml(t.bodyHtml); setIsActive(t.isActive); }
 }, [selectedLang, langMap]);

 function showToast(type: 'ok' | 'err', msg: string) {
 setToast({ type, msg });
 setTimeout(() => setToast(null), 3500);
 }

 async function handleSave() {
 if (!user || !langMap) return;
 setSaving(true);
 try {
 const existing = langMap[selectedLang];
 const updated: EmailTemplate = {
 ...existing,
 subject, bodyHtml, isActive,
 updatedAt: new Date().toISOString(),
 updatedBy: user.uid,
 updatedByName: user.name,
 isDefault: false,
 };
 await saveTemplate(MASTER_TENANT_ID, updated);
 await load();
 showToast('ok', `Platform default for ${SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.label} saved.`);
 } catch (e: any) {
 showToast('err', e?.message ?? 'Failed to save.');
 } finally { setSaving(false); }
 }

 function handleReset() {
 setConfirmOpts({
 title: 'Reset Platform Default',
 message: `Reset the ${SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.label} version to built-in? Tenant overrides for this language will still be in effect.`,
 confirmLabel: 'Reset',
 variant: 'warning',
 onConfirm: async () => {
 setSaving(true);
 try {
 await resetTemplateToDefault(MASTER_TENANT_ID, selectedKey, selectedLang);
 await load();
 showToast('ok', 'Reset to built-in default.');
 } catch (e: any) {
 showToast('err', e?.message ?? 'Failed to reset.');
 } finally { setSaving(false); }
 },
 onCancel: () => setConfirmOpts(null),
 });
 }

 if (!isSaasMasterAdmin) {
 return (
 <div className="page animate-fade-in flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
 <ShieldCheck className="w-10 h-10 opacity-30" />
 <p className="text-sm">This page requires SaaS Master Admin access.</p>
 </div>
 );
 }

 const current = langMap?.[selectedLang];
 const vars = EMAIL_TEMPLATE_DEFAULTS[selectedKey]?.variables ?? [];

 return (
 <div className="p-6 w-full px-4 lg:px-8 space-y-6">
 {confirmOpts && <ConfirmDialog {...confirmOpts} />}

 {/* Header */}
 <div>
 <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
 <span>Platform</span>
 <span className="text-border">›</span>
 <span>Email Templates</span>
 </div>
 <h1 className="text-2xl font-bold flex items-center gap-2">
 <Mail className="w-6 h-6 text-primary" />
 Platform Email Templates
 </h1>
 <p className="text-muted-foreground text-sm mt-1">
 Set platform-wide default templates in all supported languages. Individual tenants can override these in their own settings.
 </p>
 </div>

 {/* Platform notice */}
 <div className="p-3 bg-primary/8 border border-primary/20 rounded-xl flex items-center gap-3 text-sm">
 <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
 <span className="text-muted-foreground">
 Changes here set the <strong className="text-foreground">platform default</strong>. Each tenant can further customize their own copy per language.
 </span>
 </div>

 {/* Toast */}
 {toast && (
 <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium animate-in slide-in-from-top-2 ${
 toast.type === 'ok'
 ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
 : 'bg-destructive/10 border-destructive/20 text-destructive'
 }`}>
 {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
 {toast.msg}
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
 {/* ── Template list (one entry per key) ── */}
 <div className="lg:col-span-1 space-y-1">
 {TEMPLATE_KEYS.map(key => (
 <button
 key={key}
 onClick={() => { setSelectedKey(key); setSelectedLang('en'); }}
 className={`w-full text-left px-4 py-3 rounded-xl border transition-all hover:bg-muted/50 ${
 selectedKey === key
 ? 'bg-primary/10 border-primary/30 text-primary'
 : 'border-transparent text-foreground'
 }`}
 >
 <div className="flex items-center gap-2">
 <span className="text-lg">{TEMPLATE_ICONS[key]}</span>
 <div>
 <div className="font-semibold text-sm">{EMAIL_TEMPLATE_DEFAULTS[key].label}</div>
 <div className="text-[10px] text-muted-foreground mt-0.5">{EMAIL_TEMPLATE_DEFAULTS[key].description.slice(0, 40)}…</div>
 </div>
 </div>
 </button>
 ))}
 </div>

 {/* ── Editor ── */}
 <div className="lg:col-span-3 space-y-4">
 {loading ? (
 <div className="flex items-center justify-center h-64 text-muted-foreground">
 <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
 </div>
 ) : current && (
 <Card>
 <CardHeader className="pb-4">
 <div className="flex items-start justify-between">
 <div>
 <CardTitle className="flex items-center gap-2 text-lg">
 <span>{TEMPLATE_ICONS[selectedKey]}</span>
 {EMAIL_TEMPLATE_DEFAULTS[selectedKey].label}
 </CardTitle>
 <CardDescription className="mt-1">{EMAIL_TEMPLATE_DEFAULTS[selectedKey].description}</CardDescription>
 </div>
 <button
 onClick={() => setIsActive(!isActive)}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
 isActive
 ? 'bg-green-500/10 border-green-500/20 text-green-600'
 : 'bg-muted border-border text-muted-foreground'
 }`}
 >
 {isActive ? '● Active' : '○ Inactive'}
 </button>
 </div>

 {/* Language tabs */}
 <div className="flex items-center gap-2 pt-3 border-t border-border mt-3">
 <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <div className="flex gap-1 flex-wrap">
 {SUPPORTED_LANGUAGES.map(({ code, label, flag }) => (
 <button
 key={code}
 onClick={() => setSelectedLang(code)}
 className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
 selectedLang === code
 ? 'bg-primary text-primary-foreground'
 : 'bg-muted text-muted-foreground hover:bg-muted/80'
 }`}
 >
 {flag} {label}
 </button>
 ))}
 </div>
 {!current.isDefault && (
 <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium uppercase tracking-wide">Customized</span>
 )}
 {current.isDefault && (
 <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded font-medium uppercase tracking-wide">Built-in</span>
 )}
 </div>
 </CardHeader>

 <CardContent className="space-y-4">
 {vars.length > 0 && (
 <div className="p-3 bg-muted/50 rounded-lg border border-border">
 <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Available Variables</div>
 <div className="flex flex-wrap gap-2">
 {vars.map(v => (
 <code key={v} className="text-xs px-2 py-1 bg-background border border-border rounded font-mono text-primary">
 {`{{${v}}}`}
 </code>
 ))}
 </div>
 </div>
 )}

 <div className="space-y-1.5">
 <Label htmlFor="subject">Email Subject</Label>
 <input
 id="subject"
 value={subject}
 onChange={e => setSubject(e.target.value)}
 className="w-full h-11 px-3 font-mono text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
 placeholder="Subject line…"
 />
 </div>

 <div className="space-y-1.5">
 <div className="flex items-center justify-between">
 <Label>Email Body (HTML)</Label>
 <div className="flex gap-1 p-1 bg-muted rounded-lg">
 {(['code', 'preview'] as const).map(m => (
 <button key={m} onClick={() => setPreviewMode(m)}
 className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${previewMode === m ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
 >
 {m === 'code' ? <><Code2 className="w-3 h-3" /> HTML</> : <><Eye className="w-3 h-3" /> Preview</>}
 </button>
 ))}
 </div>
 </div>
 {previewMode === 'code' ? (
 <textarea
 value={bodyHtml}
 onChange={e => setBodyHtml(e.target.value)}
 rows={14}
 className="w-full font-mono text-xs p-3 bg-muted/50 border border-border rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
 placeholder="HTML body…"
 />
 ) : (
 <HtmlPreview html={bodyHtml} />
 )}
 </div>

 <div className="flex items-center justify-between pt-2 border-t border-border">
 <Button variant="outline" size="sm" onClick={handleReset} disabled={saving || current.isDefault} className="gap-2 text-muted-foreground">
 <RotateCcw className="w-4 h-4" /> Reset to Built-in
 </Button>
 <Button onClick={handleSave} disabled={saving} className="gap-2">
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 {saving ? 'Saving…' : 'Save Platform Default'}
 </Button>
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 </div>
 </div>
 );
}
