'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { CheckCircle2, ShieldCheck, UploadCloud, Link as LinkIcon, Key, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type SignatureProviderKey = 'mfo' | 'docusign' | 'clicksign' | 'certisign';

const PROVIDERS = [
  {
    id: 'mfo',
    name: 'E-Sign',
    description: 'Out-of-the-Box, no external fees. Legally binding via UID hash and AES-256 telemetry locking.',
    logo: <div className="w-10 h-10 bg-[var(--brand-faint)] text-[var(--brand-primary)] border border-indigo-200 rounded-lg flex items-center justify-center font-black shadow-inner"><PenTool size={22} /></div>,
    isNative: true
  },
  {
    id: 'docusign',
    name: 'DocuSign API',
    description: 'Global standard cryptographic signatures. Connect via OAuth 2.0 and JWT Grants.',
    logo: <img src="https://media.licdn.com/dms/image/v2/D560BAQFJh4R0ibULEg/company-logo_200_200/company-logo_200_200/0/1712837162469/docusign_logo?e=2147483647&v=beta&t=u5vbhLtmJGDiBmjV8RONzoSzoIkYy0yrRQVJextQnaY" alt="DocuSign" className="w-10 h-10 object-contain rounded-md shadow-sm" />,
  },
  {
    id: 'clicksign',
    name: 'Clicksign API',
    description: 'Validade jurídica ICP-Brasil. Plug directly via restricted Access Token Rest APIs.',
    logo: <img src="https://media.licdn.com/dms/image/v2/D4D0BAQGCOKCVbsDMlA/company-logo_200_200/company-logo_200_200/0/1713842395508/clicksign_logo?e=2147483647&v=beta&t=FhpEz8PD_w8u7SzAEC3DqQz1JDbuCgNePkQIWAyKO9I" alt="Clicksign" className="w-10 h-10 object-contain rounded-md shadow-sm bg-white" />,
  },
  {
    id: 'certisign',
    name: 'Certisign',
    description: 'Certificação Digital Enterprise ICP-Brasil via assinaturas por token HSM/A1/A3.',
    logo: <img src="https://media.licdn.com/dms/image/v2/D4D0BAQFymXyCGQTpRA/company-logo_200_200/company-logo_200_200/0/1725886698974/certisign_logo?e=2147483647&v=beta&t=lHCWc_o505McP4oUDhEcBrfj4Hwk9BfV6sEfC7ATkgA" alt="Certisign" className="w-10 h-10 object-contain rounded-md shadow-sm bg-white" />,
  }
];

export function DigitalSignatureWizard() {
  const { tenant } = useAuth();
  const [activeProvider, setActiveProvider] = useState<SignatureProviderKey>('mfo');
  const [credentials, setCredentials] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // In a real implementation, you would load these from /api/admin/tenant-config 
  // mimicking the StorageConfigurationWizard's hook useEffect

  const handleSave = async () => {
     setLoading(true);
     setIsSaved(false);
     
     // Mocking an API call
     await new Promise(r => setTimeout(r, 1000));
     
     setLoading(false);
     setIsSaved(true);
     setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full max-w-4xl mx-auto">
      <Card className="shadow-sm border-border">
         <CardHeader className="py-4 border-b">
           <CardTitle className="text-lg font-semibold">Active Signature Engine</CardTitle>
         </CardHeader>
         <CardContent className="p-6">
            <p className="text-[0.875rem] text-[var(--text-secondary)] mb-6">MFO-CRM offers a robust Out-of-the-Box signature system using HTML5 Canvas & Public Hashes natively. Alternatively, you can seamlessly connect to external APIs.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
               {PROVIDERS.map(p => (
                 <div key={p.id} onClick={() => setActiveProvider(p.id as SignatureProviderKey)} className={`p-4 border rounded-[var(--radius-sm)] flex flex-col cursor-pointer transition-colors ${activeProvider === p.id ? 'border-[var(--brand-primary)] bg-[var(--brand-faint)] ring-1 ring-[var(--brand-primary)]' : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]'}`}>
                    <div className="flex items-center justify-between mb-4">
                       {p.logo}
                       {activeProvider === p.id && <CheckCircle2 size={18} className="text-[var(--color-green)]" />}
                    </div>
                    <h4 className="font-bold text-[0.875rem] text-[var(--text-primary)]">{p.name}</h4>
                    <p className="text-[0.7rem] text-[var(--text-secondary)] mt-1 line-clamp-3 leading-relaxed">{p.description}</p>
                 </div>
               ))}
            </div>

            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
               {activeProvider === 'mfo' && (
                 <div className="flex items-start gap-4 text-emerald-800">
                    <ShieldCheck size={24} className="text-emerald-500 shrink-0"/>
                    <div>
                        <h5 className="font-bold text-[0.875rem] mb-1">Globally Active: Native Integrity</h5>
                        <p className="text-[0.8rem] text-emerald-700/80">No additional configuration required. All signatures inherit platform-level telemetry, hashing, and email dispatch.</p>
                    </div>
                 </div>
               )}

               {activeProvider === 'docusign' && (
                 <div>
                    <h5 className="font-bold text-[0.875rem] mb-4 text-[#32363a] flex items-center gap-2"><Key size={16}/> DocuSign OAuth App Credentials</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6" >
                       <div className="flex flex-col gap-2"><label className="text-sm font-medium">Integration Key (Client ID)</label><Input value={credentials.dsClient || ''} onChange={e => setCredentials({...credentials, dsClient: e.target.value})} placeholder="xxxxxxxx-xxxx-xxxx..." /></div>
                       <div className="flex flex-col gap-2"><label className="text-sm font-medium">User ID (Impersonated Info)</label><Input value={credentials.dsUser || ''} onChange={e => setCredentials({...credentials, dsUser: e.target.value})} placeholder="xxxxxxxx-xxxx-xxxx..." /></div>
                       <div className="flex flex-col gap-2 md:col-span-2"><label className="text-sm font-medium">RSA Private Key</label><div className="w-full h-24 border-dashed border-2 border-[var(--border-strong)] bg-white rounded flex items-center justify-center text-[0.75rem] text-[var(--text-secondary)] uppercase font-bold cursor-pointer hover:bg-[var(--bg-surface)]"><UploadCloud size={20} className="mr-2 text-blue-500"/> Drop RSA PEM Key Format File here</div></div>
                    </div>
                 </div>
               )}
               
               {activeProvider === 'clicksign' && (
                 <div>
                    <h5 className="font-bold text-[0.875rem] mb-4 text-[#32363a] flex items-center gap-2"><Key size={16}/> Clicksign Environment</h5>
                    <div className="grid grid-cols-1 gap-6" >
                       <div className="flex flex-col gap-2"><label className="text-sm font-medium">Access Token</label><Input type="password" value={credentials.csToken || ''} onChange={e => setCredentials({...credentials, csToken: e.target.value})} placeholder="**********************" /></div>
                    </div>
                 </div>
               )}

               {activeProvider === 'certisign' && (
                 <div>
                    <h5 className="font-bold text-[0.875rem] mb-4 text-[#32363a] flex items-center gap-2"><Key size={16}/> Certisign PKI Gateway</h5>
                    <div className="grid grid-cols-1 gap-6" >
                       <div className="flex flex-col gap-2"><label className="text-sm font-medium">API Token (Portal V3)</label><Input type="password" value={credentials.certToken || ''} onChange={e => setCredentials({...credentials, certToken: e.target.value})} placeholder="**********************" /></div>
                       <div className="text-xs text-slate-500 -mt-2">Supports A1 and A3 physical remote token mappings.</div>
                    </div>
                 </div>
               )}
            </div>
            
            <div className="flex justify-end mt-6 pt-4 border-t border-[var(--border)]">
               {activeProvider !== 'mfo' ? (
                 <Button onClick={handleSave} disabled={loading} className="w-48 bg-blue-600 hover:bg-blue-700 text-white font-bold">{loading ? 'Deploying Engine...' : isSaved ? 'Bound Successfully' : 'Apply Configuration'}</Button>
               ) : (
                 <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest pt-2 flex items-center gap-1"><CheckCircle2 size={14}/> Engine Already Sealed</div>
               )}
            </div>

         </CardContent>
      </Card>
    </div>
  );
}
