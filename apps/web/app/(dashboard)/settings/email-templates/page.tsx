'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
 getEmailTemplates, saveEmailTemplate, resetEmailTemplate,
 EMAIL_TEMPLATE_DEFAULTS,
 type EmailTemplate, type EmailTemplateKey,
} from '@/lib/emailTemplateService';
import { ROLE_PERMISSIONS } from '@/lib/rbacService';
import { ConfirmDialog, type ConfirmOptions } from '@/components/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
 Mail, RotateCcw, Save, Loader2, ChevronRight,
 CheckCircle2, AlertCircle, Eye, Code2,
} from 'lucide-react';

// ─── Template key labels ──────────────────────────────────────────────────────
const TEMPLATE_ICONS: Record<EmailTemplateKey, string> = {
 member_invite: '✉️',
 member_welcome: '👋',
 password_reset_custom: '🔑',
 subscription_expiry: '⏳',
 invoice_issued: '🧾',
 account_suspended: '🚫',
 account_reactivated: '✅',
};

// ─── HTML Preview ─────────────────────────────────────────────────────────────
function HtmlPreview({ html }: { html: string }) {
 return (
 <div className="border border-border rounded-xl overflow-hidden bg-white dark:bg-slate-900">
 <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/50 text-xs text-muted-foreground">
 <Eye className="w-3 h-3" /> Email Preview
 </div>
 <div
 className="p-6 text-sm leading-relaxed"
 dangerouslySetInnerHTML={{ __html: html }}
 />
 </div>
 );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EmailTemplatesPage() {
 const { user, tenantRecord, isSaasMasterAdmin } = useAuth();
 const tenantId = tenantRecord?.id ?? '';

 const [templates, setTemplates] = useState<EmailTemplate[]>([]);
 const [selected, setSelected] = useState<EmailTemplateKey | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
 const [previewMode, setPreviewMode] = useState<'code' | 'preview'>('code');

 // Edit state
 const [subject, setSubject] = useState('');
 const [bodyHtml, setBodyHtml] = useState('');
 const [isActive, setIsActive] = useState(true);
 const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);

 const canEdit = isSaasMasterAdmin ||
 (user?.role ? ROLE_PERMISSIONS[user.role]?.includes('email_templates:manage') : false);


 const load = useCallback(async () => {
 if (!tenantId) return;
 setLoading(true);
 try {
 const ts = await getEmailTemplates(tenantId);
 setTemplates(ts);
 if (ts.length > 0 && !selected) setSelected(ts[0].key);
 } catch { /* ignore */ }
 finally { setLoading(false); }
 }, [tenantId, selected]);

 useEffect(() => { load(); }, [load]);

 // Load selected template into edit fields
 useEffect(() => {
 const t = templates.find(t => t.key === selected);
 if (t) { setSubject(t.subject); setBodyHtml(t.bodyHtml); setIsActive(t.isActive); }
 }, [selected, templates]);

 function showToast(type: 'ok' | 'err', msg: string) {
 setToast({ type, msg });
 setTimeout(() => setToast(null), 3500);
 }

 async function handleSave() {
 if (!selected || !user || !tenantId) return;
 setSaving(true);
 try {
 await saveEmailTemplate(tenantId, { key: selected, subject, bodyHtml, isActive }, { uid: user.uid, name: user.name });
 await load();
 showToast('ok', 'Template saved successfully.');
 } catch (e: any) {
 showToast('err', e?.message ?? 'Failed to save template.');
 } finally { setSaving(false); }
 }

 function handleReset() {
 if (!selected || !tenantId) return;
 setConfirmOpts({
 title: 'Reset Template',
 message: 'Reset this template to the platform default? Your customization will be lost.',
 confirmLabel: 'Reset',
 variant: 'warning',
 onConfirm: async () => {
 setSaving(true);
 try {
 await resetEmailTemplate(tenantId, selected);
 await load();
 showToast('ok', 'Template reset to default.');
 } catch (e: any) {
 showToast('err', e?.message ?? 'Failed to reset template.');
 } finally { setSaving(false); }
 },
 onCancel: () => setConfirmOpts(null),
 });
 }

 const current = templates.find(t => t.key === selected);
 const vars = current?.variables ?? [];

 return (
 <div className="p-6 w-full px-4 lg:px-8 space-y-6">
 {confirmOpts && <ConfirmDialog {...confirmOpts} />}
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
 <span>Settings</span>
 <ChevronRight className="w-4 h-4" />
 <span>Email Templates</span>
 </div>
 <h1 className="text-2xl font-bold flex items-center gap-2">
 <Mail className="w-6 h-6 text-primary" />
 Email Templates
 </h1>
 <p className="text-muted-foreground text-sm mt-1">
 Customize the notification emails sent to users in this workspace.
 </p>
 </div>
 </div>

 {/* Toast */}
 {toast && (
 <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium animate-in slide-in-from-top-2 duration-300 ${
 toast.type === 'ok'
 ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
 : 'bg-destructive/10 border-destructive/20 text-destructive'
 }`}>
 {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
 {toast.msg}
 </div>
 )}

 {loading ? (
 <div className="flex items-center justify-center h-64 text-muted-foreground">
 <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading templates…
 </div>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
 {/* Template list */}
 <div className="lg:col-span-1 space-y-1">
 {templates.map(t => (
 <button
 key={t.key}
 onClick={() => setSelected(t.key)}
 className={`w-full text-left px-4 py-3 rounded-xl border transition-all hover:bg-muted/50 ${
 selected === t.key
 ? 'bg-primary/10 border-primary/30 text-primary'
 : 'border-transparent text-foreground'
 }`}
 >
 <div className="flex items-center gap-2">
 <span className="text-lg">{TEMPLATE_ICONS[t.key]}</span>
 <div>
 <div className="font-semibold text-sm">{t.label}</div>
 <div className="flex items-center gap-1 mt-0.5">
 {t.isDefault ? (
 <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded font-medium uppercase tracking-wide">Default</span>
 ) : (
 <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium uppercase tracking-wide">Custom</span>
 )}
 {!t.isActive && (
 <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded font-medium uppercase tracking-wide">Off</span>
 )}
 </div>
 </div>
 </div>
 </button>
 ))}
 </div>

 {/* Editor */}
 {current && (
 <div className="lg:col-span-3 space-y-4">
 <Card>
 <CardHeader className="pb-4">
 <div className="flex items-start justify-between">
 <div>
 <CardTitle className="flex items-center gap-2 text-lg">
 <span>{TEMPLATE_ICONS[current.key]}</span>
 {current.label}
 </CardTitle>
 <CardDescription className="mt-1">{current.description}</CardDescription>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setIsActive(!isActive)}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
 isActive
 ? 'bg-green-500/10 border-green-500/20 text-green-600'
 : 'bg-muted border-border text-muted-foreground'
 }`}
 disabled={!canEdit}
 >
 {isActive ? '● Active' : '○ Inactive'}
 </button>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Variables */}
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

 {/* Subject */}
 <div className="space-y-1.5">
 <Label htmlFor="subject">Email Subject</Label>
 <Input
 id="subject"
 value={subject}
 onChange={e => setSubject(e.target.value)}
 className="h-11 font-mono text-sm"
 placeholder="Subject line…"
 disabled={!canEdit}
 />
 </div>

 {/* Body */}
 <div className="space-y-1.5">
 <div className="flex items-center justify-between">
 <Label>Email Body (HTML)</Label>
 <div className="flex gap-1 p-1 bg-muted rounded-lg">
 <button
 onClick={() => setPreviewMode('code')}
 className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${previewMode === 'code' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
 >
 <Code2 className="w-3 h-3" /> HTML
 </button>
 <button
 onClick={() => setPreviewMode('preview')}
 className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${previewMode === 'preview' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
 >
 <Eye className="w-3 h-3" /> Preview
 </button>
 </div>
 </div>
 {previewMode === 'code' ? (
 <textarea
 value={bodyHtml}
 onChange={e => setBodyHtml(e.target.value)}
 rows={14}
 className="w-full font-mono text-xs p-3 bg-muted/50 border border-border rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
 placeholder="HTML body…"
 disabled={!canEdit}
 />
 ) : (
 <HtmlPreview html={bodyHtml} />
 )}
 </div>

 {/* Actions */}
 {canEdit && (
 <div className="flex items-center justify-between pt-2 border-t border-border">
 <Button
 variant="outline"
 size="sm"
 onClick={handleReset}
 disabled={saving || current.isDefault}
 className="gap-2 text-muted-foreground"
 >
 <RotateCcw className="w-4 h-4" />
 Reset to Default
 </Button>
 <Button onClick={handleSave} disabled={saving} className="gap-2">
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 {saving ? 'Saving…' : 'Save Template'}
 </Button>
 </div>
 )}
 {!canEdit && (
 <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
 You need the <code className="text-primary">email_templates:manage</code> permission to edit templates.
 </p>
 )}
 </CardContent>
 </Card>
 </div>
 )}
 </div>
 )}
 </div>
 );
}
