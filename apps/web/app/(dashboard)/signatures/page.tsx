'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { useAuth } from '@/lib/AuthContext';
import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { uploadAttachment } from '@/lib/attachmentService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { FileSignature, ShieldCheck, Mail, CheckCircle2, Check, Clock, Settings, UploadCloud, Link as LinkIcon, Plus, X, ArrowRight, UserPlus, Send, History, Fingerprint, Download, DownloadCloud, Users, Lock, Eye } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
const PdfTagEditor = dynamic(() => import('./components/PdfTagEditor').then(mod => mod.PdfTagEditor), { ssr: false });

export default function SignaturesHub() {
  usePageTitle('MFO Sign');
  const { tenant, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'inbox' | 'completed' | 'settings'>('inbox');
  const [provider, setProvider] = useState<'mfo' | 'docusign' | 'clicksign'>('mfo');
  const [envelopes, setEnvelopes] = useState<any[]>([]);

  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerStep, setDrawerStep] = useState<1 | 2 | 3>(1);
  const [draftTitle, setDraftTitle] = useState('');
  const [recipients, setRecipients] = useState<any[]>([{ name: '', email: '', role: 'Signer' }]);
  const [requireOtp, setRequireOtp] = useState(false);
  const [crmContacts, setCrmContacts] = useState<any[]>([]);
  const [crmEmployees, setCrmEmployees] = useState<any[]>([]);
  const [tenantBranding, setTenantBranding] = useState<any>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    const db = getFirestore(firebaseApp);
    
    // Contacts
    const qContacts = query(collection(db, 'tenants', tenant.id, 'contacts'), orderBy('lastName', 'asc'));
    const unsubContacts = onSnapshot(qContacts, snap => {
      setCrmContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Employees
    const qEmployees = query(collection(db, 'tenants', tenant.id, 'employees'), orderBy('name', 'asc'));
    const unsubEmployees = onSnapshot(qEmployees, snap => {
      setCrmEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Tenant Config/Branding for Regional settings
    const unsubTenant = onSnapshot(doc(db, 'tenants', tenant.id), docData => {
      const data = docData.data();
      if (data?.branding) setTenantBranding(data.branding);
    });

    return () => {
      unsubContacts();
      unsubEmployees();
      unsubTenant();
    };
  }, [tenant?.id]);

  // Audit Trail State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedAuditEnv, setSelectedAuditEnv] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);

  // Tracking Modal State
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [selectedTrackingEnv, setSelectedTrackingEnv] = useState<any>(null);

  // Resend State
  const [isResendOpen, setIsResendOpen] = useState(false);
  const [selectedResendEnv, setSelectedResendEnv] = useState<any>(null);
  const [resendSigners, setResendSigners] = useState<any[]>([]);
  const [isResending, setIsResending] = useState(false);

  const fetchAuditLogs = async (env: any, openModal = false) => {
    if (!tenant?.id) return;
    setAuditLogLoading(true);
    try {
      const db = getFirestore(firebaseApp);
      const q = query(collection(db, 'tenants', tenant.id, 'envelopes', env.id, 'audit_trail'), orderBy('timestamp', 'asc'));
      const snap = await getDocs(q);
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (openModal) {
        setSelectedAuditEnv(env);
        setAuditModalOpen(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not fetch audit trail.');
    } finally {
      setAuditLogLoading(false);
    }
  };

  // Action Handlers
  const handleCancel = async (envId: string) => {
    if (!tenant?.id) return;
    if (!confirm('Are you sure you want to cancel this envelope? Signers will no longer be able to access it.')) return;
    try {
      const db = getFirestore(firebaseApp);
      await updateDoc(doc(db, 'tenants', tenant.id, 'envelopes', envId), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to cancel the envelope.');
    }
  };

  const handleOpenResend = (env: any) => {
    setSelectedResendEnv(env);
    setResendSigners(env.signers ? [...env.signers] : []);
    setIsResendOpen(true);
  };

  const handleResendExecute = async () => {
    if (!tenant?.id || !user || !selectedResendEnv) return;
    setIsResending(true);
    try {
      const payload = {
        tenantId: tenant.id,
        envelopeId: selectedResendEnv.id,
        userEmail: user.email,
        userId: user.uid,
        signers: resendSigners,
        reason: 'Internal typo correction and resend requested via MFO UI.'
      };

      const res = await fetch('/api/signatures/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'The Resend dispatch failed.');
      }

      setIsResendOpen(false);
      setSelectedResendEnv(null);
      setResendSigners([]);
    } catch (e: any) {
      console.error(e);
      toast.error(`System Error during resend: ${e.message}`);
    } finally {
      setIsResending(false);
    }
  };

  const handleDelete = async (envId: string) => {
    if (!tenant?.id) return;
    if (!confirm('Are you sure you want to permanently delete this envelope record?')) return;
    try {
      const db = getFirestore(firebaseApp);
      await deleteDoc(doc(db, 'tenants', tenant.id, 'envelopes', envId));
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete the envelope.');
    }
  };

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSending, setIsSending] = useState<false | string>(false);

  // Email Composer State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [pendingTags, setPendingTags] = useState<any[]>([]);
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string>('');

  useEffect(() => {
    if (!tenant?.id) return;
    const db = getFirestore(firebaseApp);
    const q = query(collection(db, 'tenants', tenant.id, 'envelopes'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        let parsedDate = new Date().toISOString().split('T')[0];
        if (d.createdAt) {
          parsedDate = typeof d.createdAt.toDate === 'function'
            ? d.createdAt.toDate().toISOString().split('T')[0]
            : new Date(d.createdAt).toISOString().split('T')[0];
        }
        return {
          id: doc.id,
          ...d,
          date: parsedDate
        };
      });
      setEnvelopes(data);
    });

    return () => unsubscribe();
  }, [tenant?.id]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsHovering(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsHovering(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0];
      if (f.size <= 20 * 1024 * 1024) setFile(f);
      else toast.error('File is too large. Maximum size is 20MB.');
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      if (f.size <= 20 * 1024 * 1024) setFile(f);
      else toast.error('File is too large. Maximum size is 20MB.');
    }
  };

  const handleActualSend = async (tags: any[]) => {
    if (!tenant || !user || !file) return;
    try {
      setIsSending('Executing secure backend node dispatch...');

      const payload = {
        tenantId: tenant.id,
        userEmail: user.email,
        userId: user.uid,
        draftTitle,
        provider,
        fileName: file.name,
        fileSize: file.size,
        recipients,
        requireOtp,
        tags,
        composeSubject,
        composeBody
      };

      const formData = new FormData();
      formData.append('file', file);
      formData.append('payload', JSON.stringify(payload));

      const res = await fetch('/api/signatures/dispatch', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'The Node dispatch route returned an invalid status.');
      }

      setIsComposeOpen(false);
      setDrawerStep(1);
      setDraftTitle('');
      setRecipients([{ name: '', email: '', role: 'Signer' }]);
      setFile(null);
      setPendingTags([]);
    } catch (e: any) {
      console.error(e);
      toast.error(`System Error during dispatch: ${e.message || 'Unknown rejection'}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-background text-foreground overflow-y-auto">
      <div className="flex justify-between items-start px-4 lg:px-8 pt-8 pb-4 border-b border-border z-10 w-full mb-6 relative">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">E-Signatures</h1>
          <div className="flex gap-4 mt-4">
            <button onClick={() => setActiveTab('inbox')} className={`pb-2 border-b-2 text-[0.875rem] font-bold ${activeTab === 'inbox' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              Pending & Sent
            </button>
            <button onClick={() => setActiveTab('completed')} className={`pb-2 border-b-2 text-[0.875rem] font-bold ${activeTab === 'completed' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              Completed
            </button>
          </div>
        </div>
        <Button variant="default" onClick={() => { window.dispatchEvent(new Event('mfo-collapse-right')); setIsDrawerOpen(true); }}><Plus size={16} className="mr-2" />New Envelope</Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-8"><div className="max-w-[1200px] w-full mx-auto flex flex-col gap-6">

        {/* TAB 1 & 2: INBOX / COMPLETED - SmartTable */}
        {(activeTab === 'inbox' || activeTab === 'completed') && (
          <div className="overflow-x-auto w-full border border-border rounded-lg">
            <table>
              <thead>
                <tr>
                  <th>Envelope ID</th>
                  <th>Document Title</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Date Issued</th>

                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {envelopes.filter(e => activeTab === 'completed' ? e.status === 'completed' : e.status !== 'completed').map(env => (
                  <tr key={env.id}>
                    <td className="font-bold text-[0.75rem] text-[var(--text-secondary)] tracking-wider uppercase">{env.id.substring(0, 8)}</td>
                    <td className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <FileSignature size={16} className="text-[#0a6ed1]" />
                      {env.title}
                    </td>
                    <td>
                      <StatusBadge status={env.status} />
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-[0.75rem] font-bold text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-1 rounded">
                          {env.completed !== undefined ? env.completed : (env.signers?.filter((s: any) => s.status === 'completed')?.length || 0)} / {env.recipients} Signed
                        </span>
                        {env.status !== 'completed' && env.signers?.length > 0 && (
                          <span className="text-[0.65rem] text-slate-500 max-w-[150px] truncate" title={env.signers.filter((s: any) => s.status !== 'completed').map((s: any) => s.name).join(', ')}>
                            Pending: {env.signers.filter((s: any) => s.status !== 'completed').map((s: any) => s.name).join(', ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-[var(--text-secondary)]">{env.date || new Date(env.createdAt).toISOString().split('T')[0]}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">

                        {(env.status === 'pending' || env.status === 'in-progress') && (
                          <>
                            <Button variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 hover:text-amber-800" onClick={() => handleCancel(env.id)}>
                              Cancel
                            </Button>
                            <Button variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 hover:text-blue-800 flex items-center gap-1" onClick={() => handleOpenResend(env)}>
                              <Send size={14} /> Resend
                            </Button>
                          </>
                        )}
                        <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
                          <Button variant="ghost" size="icon" onClick={() => window.open(`/api/signatures/document?url=${encodeURIComponent(env.originalDocumentUrl || env.documentUrl)}`, '_blank')} title="Download Original">
                            <DownloadCloud size={16} className="text-slate-500 hover:text-blue-600" />
                          </Button>
                          <Button variant="outline" className={env.status === 'completed' ? 'text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 font-bold' : ''} onClick={() => { document.dispatchEvent(new CustomEvent('mfo-collapse-right')); setSelectedTrackingEnv(env); setIsTrackingModalOpen(true); setAuditLogs([]); fetchAuditLogs(env, false); }}>
                            {env.status === 'completed' ? <><Check size={14} className="mr-1 inline" /> Document Dashboard</> : <><Eye size={14} className="mr-1 inline" /> View Progress</>}
                          </Button>
                        </div>
                        <Button variant="outline" className="text-red-700 bg-red-50 border-red-200 hover:bg-red-100 hover:text-red-800" onClick={() => handleDelete(env.id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeTab === 'completed' && envelopes.filter(e => e.status === 'completed').length === 0 && (
              <div className="p-8 text-center text-[var(--text-secondary)]">No completed documents yet.</div>
            )}
          </div>
        )}

      </div></div>

      {/* Sending Drawer */}
      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="fixed right-[48px] top-0 bottom-0 w-[480px] bg-[var(--bg-background)] border-l border-[var(--border-subtle)] shadow-2xl z-50 flex flex-col transform animate-slide-in-right">
            <div className="h-16 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-[1.125rem] font-bold text-[var(--text-primary)] tracking-tight">Prepare Envelope</h2>
                <p className="text-[0.65rem] uppercase tracking-widest text-[var(--text-tertiary)] font-bold">MFO Native Sign</p>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-secondary)]">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-background)]">
              {/* Visual Progress Map */}
              <div className="flex items-center gap-2 mb-8">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[0.75rem] font-bold ${drawerStep >= 1 ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] bg-gray-200'}`}>1</div>
                <div className={`flex-1 h-1 rounded ${drawerStep >= 2 ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-subtle)]'}`}></div>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[0.75rem] font-bold ${drawerStep >= 2 ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] bg-gray-200'}`}>2</div>
                <div className={`flex-1 h-1 rounded ${drawerStep >= 3 ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-subtle)]'}`}></div>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[0.75rem] font-bold ${drawerStep >= 3 ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] bg-gray-200'}`}>3</div>
              </div>

              {drawerStep === 1 && (
                <div className="animate-fade-in flex flex-col gap-6">
                  <div>
                    <label className="block text-[0.75rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Subject / Title</label>
                    <Input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder="e.g., NDA - Project X" />
                  </div>
                  <div>
                    <label className="block text-[0.75rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Source Document</label>
                    {!file ? (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full h-32 border-2 border-dashed ${isHovering ? 'border-[var(--brand-primary)] bg-[var(--brand-faint)]' : 'border-[var(--border-strong)] bg-[var(--bg-surface)]'} hover:bg-[var(--bg-elevated)] transition-colors rounded-xl flex flex-col items-center justify-center cursor-pointer text-[var(--text-tertiary)]`}
                      >
                        <UploadCloud size={32} className={`mb-2 ${isHovering ? 'text-[var(--brand-primary)]' : ''}`} />
                        <span className="text-[0.875rem] font-semibold text-[var(--text-primary)]">Drop PDF or Document File here</span>
                        <span className="text-[0.75rem] mt-1">Maximum size 20MB</span>
                      </div>
                    ) : (
                      <div className="w-full p-4 border border-[var(--brand-primary)] bg-[var(--brand-faint)] rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileSignature size={24} className="text-[var(--brand-primary)]" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[0.875rem] font-bold text-[var(--text-primary)] truncate max-w-[250px]">{file.name}</div>
                            <div className="text-[0.75rem] text-[var(--text-secondary)]">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setFile(null); fileInputRef.current && (fileInputRef.current.value = ''); }} className="p-2 hover:bg-white rounded-full text-red-500 transition-colors shrink-0">
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileSelect} />
                  </div>
                </div>
              )}

              {drawerStep === 2 && (
                <div className="animate-fade-in flex flex-col gap-6">
                  <div className="flex flex-col items-center gap-2 mb-2">
                    <label className="block text-[0.75rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider text-center">Signers & Recipients</label>
                  </div>
                  <div className="flex flex-col gap-4">
                    {recipients.map((rec, i) => (
                      <div key={i} className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl flex flex-col gap-3">
                        <div className="flex justify-between items-center pb-2 border-b border-[var(--border-subtle)]">
                          <div className="text-[0.75rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                            <span className="bg-[var(--brand-primary)] text-white w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                            Signer Detalhes
                          </div>
                          {recipients.length > 1 && (
                            <button onClick={() => setRecipients(recipients.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-md p-1 px-2 flex items-center text-[0.65rem] font-bold uppercase tracking-wider transition-colors">
                              <X size={12} className="mr-1"/> Remover
                            </button>
                          )}
                        </div>

                        <div className="flex justify-between items-center bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 mb-2">
                          <div className="text-[0.65rem] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1"><Users size={12} /> Auto-fill Details</div>
                          <select
                            className="text-xs bg-white border border-indigo-200 rounded px-2 py-1 outline-none text-indigo-900 font-medium"
                            onChange={e => {
                              const val = e.target.value;
                              if (!val) return;
                              const n = [...recipients];
                              if (val === 'self') {
                                n[i].name = user?.name || '';
                                n[i].email = user?.email || '';
                                n[i].role = 'Self';
                              } else if (val.startsWith('emp_')) {
                                const empId = val.replace('emp_', '');
                                const emp = crmEmployees.find((e: any) => e.id === empId);
                                if (emp) {
                                  n[i].name = emp.name;
                                  n[i].email = emp.email || '';
                                  n[i].role = 'Employee';
                                  // @ts-ignore
                                  n[i].contactId = emp.id;
                                  // @ts-ignore
                                  n[i].language = emp.language || tenantBranding?.language || undefined;
                                  // @ts-ignore
                                  n[i].dateFormat = emp.dateFormat || tenantBranding?.dateFormat || undefined;
                                }
                              } else {
                                const contact = crmContacts.find((c: any) => c.id === val);
                                if (contact) {
                                  n[i].name = `${contact.firstName} ${contact.lastName}`;
                                  n[i].email = contact.email || '';
                                  n[i].role = 'Customer';
                                  // @ts-ignore
                                  n[i].contactId = contact.id;
                                  // @ts-ignore
                                  n[i].language = contact.language || tenantBranding?.language || undefined;
                                  // @ts-ignore
                                  n[i].dateFormat = contact.dateFormat || tenantBranding?.dateFormat || undefined;
                                }
                              }
                              setRecipients(n);
                              e.target.value = ''; // reset after selection
                            }}
                          >
                            <option value="" disabled selected>-- Select from CRM --</option>
                            <option value="self">Myself / Sender ({user?.name})</option>
                            {crmEmployees.length > 0 && (
                              <optgroup label="Employees">
                                {crmEmployees.map((e: any) => (
                                  <option key={`emp_${e.id}`} value={`emp_${e.id}`}>{e.name} (Employee)</option>
                                ))}
                              </optgroup>
                            )}
                            {crmContacts.length > 0 && (
                              <optgroup label="Contacts">
                                {crmContacts.map((c: any) => (
                                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.role})</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div className="col-span-2">
                            <label className="block text-[0.65rem] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Full Name</label>
                            <Input value={rec.name} onChange={(e: any) => { const n = [...recipients]; n[i].name = e.target.value; setRecipients(n); }} placeholder="John Doe" />
                          </div>
                          <div>
                            <label className="block text-[0.65rem] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Email</label>
                            <Input type="email" value={rec.email} onChange={(e: any) => { const n = [...recipients]; n[i].email = e.target.value; setRecipients(n); }} placeholder="john@example.com" />
                          </div>
                          <div>
                            <label className="block text-[0.65rem] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Role / Type</label>
                            <select 
                              value={rec.role} 
                              onChange={(e: any) => { const n = [...recipients]; n[i].role = e.target.value; setRecipients(n); }}
                              className="w-full text-sm font-medium bg-[var(--bg-background)] border border-[var(--border-subtle)] rounded-lg px-3 h-10 outline-none focus:border-[var(--brand-primary)]"
                            >
                              <option value="Signer">Standard Signer</option>
                              <option value="Self">Self (Sender)</option>
                              <option value="Employee">Employee</option>
                              <option value="Customer">Customer</option>
                              <option value="CC">Receives Copy Only (CC)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button 
                      onClick={() => setRecipients([...recipients, { id: crypto.randomUUID(), name: '', email: '', role: 'Signer' }])}
                      className="w-full mt-2 border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-3 flex flex-col items-center justify-center text-[var(--text-tertiary)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors gap-1 group bg-gray-50/50 hover:bg-indigo-50/30"
                    >
                      <div className="bg-white p-2 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                        <Plus size={16} strokeWidth={3} />
                      </div>
                      <span className="text-[0.75rem] font-bold uppercase tracking-wider mt-1">Add Another Signer</span>
                    </button>
                  </div>

                  <div className="pt-4 border-t border-[var(--border-subtle)]">
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-white cursor-pointer hover:border-[var(--brand-primary)] transition-colors shadow-sm">
                      <input type="checkbox" checked={requireOtp} onChange={e => setRequireOtp(e.target.checked)} className="w-4 h-4 text-[var(--brand-primary)] bg-gray-100 border-gray-300 rounded focus:ring-[var(--brand-primary)]" />
                      <div className="flex flex-col">
                        <span className="text-[0.875rem] text-[var(--text-primary)] font-bold">Require MFO-OTP Verification</span>
                        <span className="text-[0.75rem] text-[var(--text-secondary)]">Signers must enter a 6-digit email pin before viewing the document bytes.</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {drawerStep === 3 && (
                <div className="animate-fade-in h-full flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 animate-pulse ring-8 ring-emerald-50">
                    <Send size={32} />
                  </div>
                  <h3 className="text-[1.25rem] font-black text-[var(--text-primary)] mb-2">Hashing Document...</h3>
                  <p className="text-[0.875rem] text-[var(--text-secondary)]">Please wait while we secure the envelope across the MFO nodes and dispatch emails to {recipients.length} recipients.</p>
                </div>
              )}
            </div>

            {drawerStep < 3 && (
              <div className="p-6 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] shrink-0 flex justify-center gap-4">
                {drawerStep === 2 && (
                  <Button variant="outline" onClick={() => setDrawerStep(1)}>Back</Button>
                )}
                {drawerStep === 1 ? (
                  <Button disabled={!draftTitle || !file} variant="default" className="min-w-[150px]" onClick={() => setDrawerStep(2)}>Next Step <ArrowRight size={16} className="ml-2" /></Button>
                ) : (
                  <Button disabled={!recipients[0].name || !recipients[0].email} variant="default" className="min-w-[150px]" onClick={() => { setIsDrawerOpen(false); setIsEditorOpen(true); }}>Configure Document <ArrowRight size={16} className="ml-2" /></Button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {isEditorOpen && file && (
        <PdfTagEditor
          file={file}
          recipients={recipients}
          onCancel={() => { setIsEditorOpen(false); setIsDrawerOpen(true); }}
          onSend={(tags) => {
            setPendingTags(tags);
            setIsEditorOpen(false);
            setComposeSubject(`Review & Sign: ${draftTitle || 'Untitled Document'}`);
            setComposeBody(`Hello,\n\nYou have been requested to review and sign a confidential document (${file.name}) via MFO-CRM.\n\nPlease click the button below to natively review and hash your signature on the cloud.\n\nThank you.`);
            setIsComposeOpen(true);
          }}
          isSending={!!isSending}
        />
      )}

      {/* Draft & Compose Modal (Odoo-like) */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-background)] max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center"><Mail size={20} /></div>
                <div>
                  <h2 className="text-[1.125rem] font-bold text-[var(--text-primary)]">Compose Dispatch Email</h2>
                  <p className="text-[0.75rem] text-[var(--text-secondary)]">Customize the message that signers will receive</p>
                </div>
              </div>
              <button disabled={!!isSending} onClick={() => { setIsComposeOpen(false); setIsEditorOpen(true); }} className="p-2 hover:bg-[var(--bg-elevated)] rounded-xl transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[0.75rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Recipients</label>
                <div className="flex flex-wrap gap-2">
                  {recipients.map((r, i) => (
                    <div key={i} className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[0.75rem] font-medium text-slate-700">{r.name} &lt;{r.email}&gt;</div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[0.75rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Subject Line</label>
                <Input disabled={!!isSending} value={composeSubject} onChange={e => setComposeSubject(e.target.value)} />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[0.75rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Message Body</label>
                <textarea
                  disabled={!!isSending}
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  className="w-full h-40 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="p-6 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-[0.75rem] text-[var(--text-tertiary)]"><ShieldCheck size={14} className="inline mr-1" /> Document and tags are secure.</span>
              <Button disabled={!!isSending} onClick={() => handleActualSend(pendingTags)} className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-600)] transition-all">
                {isSending ? <><Send size={16} className="mr-2 animate-pulse" /> {isSending}</> : <><Send size={16} className="mr-2" /> Dispatch Envelope</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resend & Correct Email Modal */}
      {isResendOpen && selectedResendEnv && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in px-4">
          <div className="bg-[var(--bg-background)] max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center"><Mail size={20} /></div>
                <div>
                  <h2 className="text-[1.125rem] font-bold text-[var(--text-primary)]">Correct & Resend Notification</h2>
                  <p className="text-[0.75rem] text-[var(--text-secondary)]">Fix typo in email addresses and force dispatch pending signers over SMTP</p>
                </div>
              </div>
              <button disabled={Object.is(isResending, true)} onClick={() => setIsResendOpen(false)} className="p-2 hover:bg-[var(--bg-elevated)] rounded-xl transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
              <div className="text-[0.75rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Review Signer List</div>
              {resendSigners.map((rec, i) => (
                <div key={i} className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl flex flex-col gap-3 relative">
                  <div className="absolute -left-3 top-1/2 mt-[-12px] bg-[var(--brand-primary)] text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border-2 border-white shadow-sm">{i + 1}</div>
                  <div className="flex justify-between items-center">
                    <label className="block text-[0.65rem] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Full Name</label>
                    <span className={`text-[0.65rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${rec.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                      {rec.status === 'completed' ? 'Signed' : 'Pending'}
                    </span>
                  </div>
                  <Input disabled={Object.is(isResending, true) || rec.status === 'completed'} value={rec.name} onChange={(e: any) => { const n = [...resendSigners]; n[i].name = e.target.value; setResendSigners(n); }} placeholder="John Doe" />

                  <div>
                    <label className="block text-[0.65rem] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Email Address</label>
                    <Input type="email" disabled={Object.is(isResending, true) || rec.status === 'completed'} value={rec.email} onChange={(e: any) => { const n = [...resendSigners]; n[i].email = e.target.value; setResendSigners(n); }} placeholder="john@example.com" />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-[0.75rem] text-[var(--text-tertiary)]"><ShieldCheck size={14} className="inline mr-1" /> Original Document Node: {selectedResendEnv.id}</span>
              <Button disabled={Object.is(isResending, true)} onClick={handleResendExecute} className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-600)] transition-all">
                {isResending ? <><Send size={16} className="mr-2 animate-pulse" /> Resending...</> : <><Send size={16} className="mr-2" /> Save & Resend</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Dual-Column Progress Viewer & Audit Logs */}
      {isTrackingModalOpen && selectedTrackingEnv && (
        <div className="fixed inset-0 z-[150] flex bg-[var(--bg-background)] animate-fade-in font-sans">
          
          {/* Document Preview Area */}
          <div className="flex-1 bg-slate-100 flex flex-col h-full border-r border-[var(--border-subtle)] md:max-w-[calc(100vw-400px)] lg:max-w-[calc(100vw-500px)] relative overflow-hidden">
             <div className="h-[60px] shrink-0 bg-white border-b border-[var(--border-subtle)] flex items-center justify-between px-6 shadow-sm z-10 w-full absolute top-0">
               <div className="flex items-center gap-3">
                 <div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg">
                   <FileSignature size={20} />
                 </div>
                 <div className="flex flex-col">
                   <span className="font-bold text-[0.875rem] text-[var(--text-primary)] leading-tight">{selectedTrackingEnv.title}</span>
                   <span className="text-[0.65rem] text-[var(--text-secondary)] uppercase tracking-wider">{selectedTrackingEnv.id}</span>
                 </div>
               </div>
               <StatusBadge status={selectedTrackingEnv.status} />
             </div>
             {/* Note: since there's no native view for this besides standard iframes/embeds... */}
             <div className="flex-1 mt-[60px] bg-slate-100 w-full h-[calc(100%-60px)]">
               <iframe 
                 src={`/api/signatures/document?url=${encodeURIComponent(selectedTrackingEnv.documentUrl)}`} 
                 className="w-full h-full border-0" 
                 title="Document Preview"
               />
             </div>
          </div>
          
          {/* Tracking & Logging Panel */}
          <div className="w-[400px] lg:w-[500px] shrink-0 flex flex-col h-full bg-white shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.1)] relative z-20">
             <div className="h-[60px] shrink-0 border-b border-[var(--border-subtle)] flex justify-between items-center px-6 bg-[var(--bg-surface)]">
               <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold">
                 <History size={18} className="text-[var(--brand-primary)]" /> Envelope Tracking
               </div>
               <button onClick={() => setIsTrackingModalOpen(false)} className="p-2 hover:bg-[var(--bg-elevated)] rounded-full transition-colors text-[var(--text-secondary)] hover:text-red-500"><X size={20}/></button>
             </div>

             <div className="flex-1 overflow-y-auto w-full">
               
               {/* Signers Progress Section */}
               <div className="p-6 border-b border-[var(--border-subtle)] flex flex-col gap-4 bg-[var(--bg-background)]">
                 <div className="flex items-center justify-between">
                   <h3 className="font-bold text-[0.7rem] uppercase tracking-widest text-[var(--text-secondary)]">Signers Progress</h3>
                   <span className="text-[0.7rem] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                     {selectedTrackingEnv.completed !== undefined ? selectedTrackingEnv.completed : (selectedTrackingEnv.signers?.filter((s:any)=>s.status==='completed')?.length||0)} / {selectedTrackingEnv.recipients}
                   </span>
                 </div>
                 
                 <div className="flex flex-col gap-3">
                   {selectedTrackingEnv.signers?.map((s: any, idx: number) => (
                      <div key={idx} className={`p-4 border rounded-xl shadow-sm bg-white relative overflow-hidden transition-all ${s.status === 'completed' ? 'border-emerald-200' : 'border-slate-200'}`}>
                         {s.status === 'completed' && <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-[100px] -z-0"></div>}
                         <div className="relative z-10 flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                              <span className="font-bold text-[0.875rem] text-[var(--text-primary)]">{s.name}</span>
                              <span className="text-[0.75rem] text-[var(--text-tertiary)]">{s.email}</span>
                            </div>
                            <span className={`text-[0.65rem] font-bold uppercase px-2 py-0.5 rounded tracking-wide ${s.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {s.status === 'completed' ? 'Signed' : 'Pending'}
                            </span>
                         </div>
                         <div className="relative z-10 flex items-center justify-between mt-3 text-[0.7rem]">
                            <span className="text-[var(--text-tertiary)] bg-slate-100 px-2 rounded-md font-medium">{s.role || 'Signer'}</span>
                            {s.signedAt && <span className="font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 size={12}/> {new Date(s.signedAt).toLocaleString()}</span>}
                         </div>
                      </div>
                   ))}
                 </div>
               </div>

               {/* Optional OTP Rules info */}
               {selectedTrackingEnv.requireOtp && (
                 <div className="mx-6 mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                   <Lock size={14} className="text-amber-600 mt-0.5 shrink-0" />
                   <div className="text-[0.75rem] text-amber-700">
                     <span className="font-bold">MFO-OTP Protected:</span> Signers are required to enter a 6-digit email passcode to view bytes.
                   </div>
                 </div>
               )}

               {/* Audit Logs Section */}
               <div className="p-6 pb-12 flex flex-col gap-4">
                 <h3 className="font-bold text-[0.7rem] uppercase tracking-widest text-[var(--text-secondary)] mb-2">Immutable Global Audit Trail</h3>
                 
                 {selectedTrackingEnv.status === 'completed' && selectedTrackingEnv.finalHash && (
                    <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest mb-1">Final AES-256 Hash Checksum</div>
                      <code className="text-[10px] break-all text-slate-700 font-mono font-medium">{selectedTrackingEnv.finalHash}</code>
                    </div>
                 )}

                 <div className="relative space-y-5">
                   <div className="absolute top-2 bottom-2 left-[7px] w-0.5 bg-slate-200"></div>
                   
                   {auditLogs?.map((log: any) => (
                     <div key={log.id} className="relative z-10 flex gap-4">
                       <div className={`w-[16px] h-[16px] rounded-full border-4 border-white shadow-sm mt-0.5 shrink-0 ${log.type === 'signed' ? 'bg-emerald-500' : 'bg-indigo-400'}`}></div>
                       <div className="flex-1 w-full overflow-hidden">
                         <div className="flex items-center justify-between mb-0.5">
                           <span className="font-bold text-[0.8rem] uppercase text-slate-800 tracking-wide">{log.type.replace('_', ' ')}</span>
                           <span className="text-[0.65rem] text-[var(--text-tertiary)] font-mono shrink-0 pl-2">{new Date(log.timestamp).toLocaleString()}</span>
                         </div>
                         
                         <div className="text-[0.75rem] text-[var(--text-secondary)] leading-tight mb-2">
                           {log.type === 'opened' && <span>Document opened by <b className="text-slate-700">{log.clientInfo?.email}</b>.</span>}
                           {log.type === 'viewed_page' && <span>Page {log.metadata?.page} viewed by <b className="text-slate-700">{log.clientInfo?.email}</b>.</span>}
                           {log.type === 'signed' && <span className="font-bold text-emerald-700 bg-emerald-50 px-1 rounded">Electronically Signed and cryptographically sealed.</span>}
                           {log.type === 'sent' && <span>Envelope created and strict magic links dispatched.</span>}
                         </div>
                         
                         <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[0.6rem] font-mono text-slate-500 w-full break-words">
                           <div>IP: {log.clientInfo?.ip || 'Internal'}</div>
                           <div className="line-clamp-2" title={log.clientInfo?.userAgent || 'Internal System Node'}>Client: {log.clientInfo?.userAgent || 'Internal System Node'}</div>
                         </div>
                       </div>
                     </div>
                   ))}

                   {(!auditLogs || auditLogs.length === 0) && auditLogLoading && (
                     <div className="text-center p-8 font-bold text-slate-400 text-sm animate-pulse">Fetching immutable logs...</div>
                   )}
                   {(!auditLogs || auditLogs.length === 0) && !auditLogLoading && (
                     <div className="text-center p-8 font-bold text-slate-400 text-sm">No immutable logs appended yet.</div>
                   )}
                 </div>
               </div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
