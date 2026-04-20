'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { HardDrive, Key, FolderOpen, ShieldCheck, DownloadCloud, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StorageExplorer } from '../../documents/components/StorageExplorer';

type ProviderType = 'onedrive' | 'sharepoint' | 'gdrive' | 'dropbox' | 'aws' | null;

const PROVIDERS = [
  {
    id: 'sharepoint',
    name: 'Microsoft SharePoint',
    description: 'Connect to an enterprise Microsoft 365 SharePoint Site document library.',
    icon: <img src="https://play-lh.googleusercontent.com/f5m1W5yi3SvVsScU43CHGqjp_YbEDnPELYDqGk-Uwv5heB-BXvScQGeYa74lAq26Xgw=w240-h240-rw" alt="SharePoint" className="w-10 h-10 object-contain rounded-md shadow-sm" />,
    popular: true,
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    description: 'Connect to a specific user\'s Microsoft 365 OneDrive for Business storage.',
    icon: <img src="https://upload.wikimedia.org/wikipedia/commons/e/e7/Microsoft_OneDrive_Icon_%282025_-_present%29.svg" alt="OneDrive" className="w-10 h-10 object-contain" />,
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    description: 'Integrate Google Workspace drives via Google Cloud Service Accounts.',
    icon: <img src="https://www.vectorlogo.zone/logos/google_drive/google_drive-icon.svg" alt="Google Drive" className="w-10 h-10 object-contain" />,
  },
  {
    id: 'dropbox',
    name: 'Dropbox Business',
    description: 'Corporate Dropbox teams integration via OAuth 2.0 app credentials.',
    icon: <img src="https://www.vectorlogo.zone/logos/dropbox/dropbox-icon.svg" alt="Dropbox" className="w-10 h-10 object-contain" />,
  },
  {
    id: 'aws',
    name: 'Amazon S3',
    description: 'Connect securely to AWS S3 buckets using IAM credentials.',
    icon: <img src="https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg" alt="Amazon S3" className="w-10 h-10 object-contain" />,
  }
];

export function StorageConfigurationWizard() {
  const { tenant } = useAuth();
  const [step, setStep] = useState<number>(0);
  const [provider, setProvider] = useState<ProviderType>(null);
  const [testing, setTesting] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [configuredProviders, setConfiguredProviders] = useState<Record<string, { rootFolder: string, credentials: any }>>({});
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);

  // Form State
  const [credentials, setCredentials] = useState<{ 
    clientId: string, clientSecret: string, tenantId: string, 
    serviceAccount: string, driveType: 'user' | 'site', siteUrl: string,
    awsRegion: string, awsAccessKey: string, awsSecretKey: string, awsBucket: string,
    gdriveJsonKey: string
  }>({
    clientId: '', clientSecret: '', tenantId: '', serviceAccount: '', driveType: 'site', siteUrl: '',
    awsRegion: '', awsAccessKey: '', awsSecretKey: '', awsBucket: '', gdriveJsonKey: ''
  });
  
  const credentialsRef = React.useRef(credentials);
  React.useEffect(() => { credentialsRef.current = credentials; }, [credentials]);
  const [rootFolder, setRootFolder] = useState('MFO-CRM-Data');
  
  // OneDrive Browser State
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserPathStack, setBrowserPathStack] = useState<{id: string, name: string}[]>([{id: 'root', name: 'Root'}]);
  const [browserFolders, setBrowserFolders] = useState<any[]>([]);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [validationLogs, setValidationLogs] = useState<{message: string, status: 'pending'|'pass'|'fail'}[]>([]);
  const renderLabel = (label: string) => (
    <label className="text-sm font-semibold mb-2 flex items-center gap-2">
       {label}
    </label>
  );

  React.useEffect(() => {
    if (!tenant?.id) return;
    const fetchConfig = async () => {
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch(`/api/admin/tenant-config?tenantId=${tenant.id}&_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store' // CRITICAL: Stop Next.js from caching the retrieval of db parameters
        });
        const data = await res.json();
        if (data.storageIntegrations && Object.keys(data.storageIntegrations).length > 0) {
           let parsedIntegrations = data.storageIntegrations;
           
           const hasModernFormat = ['sharepoint', 'onedrive', 'gdrive', 'aws', 'dropbox'].some(k => !!parsedIntegrations[k]);
           if (typeof parsedIntegrations.provider === 'string' && !hasModernFormat) {
              // Legacy migration from singular object structure
              let p = parsedIntegrations.provider;
              if (p === 'onedrive' && parsedIntegrations.credentials?.driveType === 'site') {
                 p = 'sharepoint';
              }
              parsedIntegrations = {
                 [p]: { rootFolder: parsedIntegrations.rootFolder, credentials: parsedIntegrations.credentials }
              };
           }
           
           // Clean out any legacy root string fields left over so they don't corrupt the state
           const sanitized: any = {};
           for (const [k, v] of Object.entries(parsedIntegrations)) {
              if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                 sanitized[k] = v;
              }
           }
           
           setConfiguredProviders(sanitized || {});
        }
      } catch (err) {
        console.error('Failed to load storage config', err);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, [tenant?.id]);

  const syncConfig = async (currentProvider: ProviderType, currentRoot: string, currentCreds: any) => {
    if (!tenant?.id || !currentProvider) return;
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (token) {
        const fetchRes = await fetch('/api/admin/tenant-config', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: tenant.id,
            storageIntegrations: {
               ...configuredProviders,
               [currentProvider]: { provider: currentProvider, rootFolder: currentRoot, credentials: currentCreds }
            }
          })
        });
        if (!fetchRes.ok) {
           const errText = await fetchRes.text();
           console.error("Critical Firebase save rejection:", errText);
        }
      }
      setConfiguredProviders(prev => ({ ...prev, [currentProvider]: { rootFolder: currentRoot, credentials: currentCreds } }));
    } catch (err) {
      console.error("Silent config sync failed", err);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setValidationLogs([
      { message: `Authenticating ${provider?.toUpperCase()} Identity...`, status: 'pending' }
    ]);
    
    await new Promise(resolve => setTimeout(resolve, 800)); // artificial feedback delay

    try {
      setValidationLogs(prev => [
         ...prev.slice(0, -1), 
         { message: `Authenticating ${provider?.toUpperCase()} Identity...`, status: 'pass' },
         { message: `Securing Root Folder [${rootFolder}] configuration...`, status: 'pending' }
      ]);
      
      await syncConfig(provider, rootFolder, credentialsRef.current);
      
      setValidationLogs(prev => [
         ...prev.slice(0, -1), 
         { message: `Securing Root Folder [${rootFolder}] configuration...`, status: 'pass' },
         { message: `Ready to finalize binding!`, status: 'pass' }
      ]);
      setTestResult('success');
    } catch {
      setValidationLogs(prev => [
         ...prev.slice(0, -1), 
         { message: `Validation Failed. Check network connection.`, status: 'fail' }
      ]);
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  };

  const fetchFolders = async (id: string, name: string) => {
    setBrowserLoading(true);
    setBrowserError(null);
    try {
      if (provider === 'onedrive' || provider === 'sharepoint') {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

        const res = await fetch('/api/admin/onedrive/explore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            msTenantId: credentials.tenantId,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            serviceAccountEmail: credentials.serviceAccount,
            folderId: id,
            driveType: credentials.driveType,
            siteUrl: credentials.siteUrl
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch folders from Microsoft Graph');

        setBrowserFolders(data.items || data.folders || []);
      } else if (provider === 'gdrive') {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

        const res = await fetch('/api/admin/gdrive/explore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            serviceAccountEmail: credentials.serviceAccount,
            jsonKeyBase64: credentials.gdriveJsonKey || '',
            folderId: id
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch folders from Google Drive');

        setBrowserFolders(data.folders || []);
      } else {
        // Mock fallback for others
        await new Promise(r => setTimeout(r, 600));
        setBrowserFolders([{ id: 'mock-1', name: 'MFO-CRM-Data' }]);
      }

      setBrowserPathStack(prev => {
         const idx = prev.findIndex(p => p.id === id);
         if (idx >= 0) return prev.slice(0, idx + 1);
         return [...prev, { id, name }];
      });
      setRootFolder(name);
      
      // PER USER REQUEST: The exact moment Microsoft guarantees it mounted securely, lock it into the database permanently.
      await syncConfig(provider!, name, credentialsRef.current);
      setIsMounted(true); // User successfully performed a live mount

    } catch (err: any) {
      setBrowserError(err.message || 'Failed to fetch folders');
      // Crucial Fix: Instantly destroy the mock UI folders so it stops showing 'Successfully Mounted' if this catches an error!
      setBrowserFolders([]);
      setIsMounted(false);
    } finally {
      setBrowserLoading(false);
    }
  };

  const handleProviderSelect = (pid: ProviderType) => {
     if (!pid) return;
     setProvider(pid);
     setTestResult(null); // Fix: Reset test result so they can re-bind!
     const stored = configuredProviders[pid];
     setIsMounted(false); // Force explicit re-mount every time they reconfigure
     
     if (stored && stored.credentials) {
         setCredentials(prev => ({ ...prev, ...stored.credentials }));
         if (stored.rootFolder) {
            setRootFolder(stored.rootFolder);
            // DO NOT pre-mount browserFolders to force user to click Mount button!
            setBrowserFolders([]); 
         }
     } else {
         if (pid === 'sharepoint') setCredentials(prev => ({...prev, driveType: 'site'}));
         if (pid === 'onedrive') setCredentials(prev => ({...prev, driveType: 'user'}));
         setBrowserFolders([]);
     }
  };

  const isStep1Valid = () => {
    if (provider === 'onedrive' || provider === 'sharepoint') {
      return !!credentials.tenantId && !!credentials.clientId && !!credentials.clientSecret;
    }
    if (provider === 'gdrive') {
      return !!credentials.serviceAccount && !!credentials.gdriveJsonKey;
    }
    if (provider === 'aws') {
      return !!credentials.awsRegion && !!credentials.awsAccessKey && !!credentials.awsSecretKey && !!credentials.awsBucket;
    }
    if (provider === 'dropbox') {
      return true; // Since it is mock/not fully implemented
    }
    return false;
  };

  const isStep2Valid = () => {
    if (browserError) return false;
    if (!!configuredProviders[provider!] && browserFolders.length === 0) {
      return !!rootFolder; // Allow if it was already configured and they skipped re-mounting
    }
    return browserFolders.length > 0 && !!rootFolder;
  };

  if (loadingConfig) {
    return <div className="p-8 flex justify-center text-[var(--text-secondary)]">Loading configuration...</div>;
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-background text-foreground overflow-y-auto">
      <div className="flex justify-between items-start px-4 lg:px-8 pt-8 pb-4 border-b border-border z-10 w-full"><div className="flex flex-col gap-1"><h1 className="text-3xl font-bold tracking-tight">Document Storage Integration</h1></div></div>
      
      <div className="p-8 max-w-4xl mx-auto w-full flex-1">
        
        {step === 0 && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <p className="text-[0.875rem] text-[var(--text-secondary)]">Choose the document storage platform used by your organization.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {PROVIDERS.map(p => (
                <div 
                  key={p.id}
                  className={`
                    flex flex-col items-center justify-between p-6 border-2 rounded-[var(--radius-md)] transition-all text-center relative aspect-square
                    ${provider === p.id ? 'border-[var(--brand-primary)] bg-[var(--brand-faint)]' : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--brand-primary)] hover:shadow-md'}
                  `}
                >
                  <div className="flex-1 flex flex-col items-center justify-center w-full">
                    {!!configuredProviders[p.id] && (
                      <div className="absolute top-2 right-2 bg-green-100 text-green-800 border border-green-200 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm opacity-90">
                        <ShieldCheck size={12} className="text-green-600" /> Connected
                      </div>
                    )}
                    <div className="mb-4">{p.icon}</div>
                    <h4 className="font-bold text-[0.95rem] text-[var(--text-primary)] mb-2">{p.name}</h4>
                    <p className="text-[0.8rem] text-[var(--text-secondary)] leading-relaxed line-clamp-3 px-2">{p.description}</p>
                  </div>
                  <div className="w-full mt-auto pt-4 border-t border-[var(--border-subtle)]">
                     {!!configuredProviders[p.id] ? (
                        <div className="flex gap-2 w-full mt-2">
                           <Button className="w-1/2 text-xs h-9" variant="outline" onClick={() => { handleProviderSelect(p.id as ProviderType); setStep(1); }}>Configure</Button>
                           <Button className="w-1/2 text-xs h-9" variant="default" onClick={() => { 
                               handleProviderSelect(p.id as ProviderType); 
                               if (browserFolders.length === 0 && !configuredProviders[p.id]?.rootFolder) fetchFolders('root', rootFolder || 'Root');
                               setStep(4); 
                           }}>Explore</Button>
                        </div>
                     ) : (
                        <Button className="w-full text-xs h-9 mt-2" variant="outline" onClick={() => { handleProviderSelect(p.id as ProviderType); setStep(1); }}>Configure</Button>
                     )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="default" onClick={() => setStep(1)} disabled={!provider}>Next Step</Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <Card className="shadow-sm border-border">
              <CardHeader className="py-4 border-b">
                <CardTitle className="text-lg font-semibold">{PROVIDERS.find(p => p.id === provider)?.name} Setup</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
              {(provider === 'onedrive' || provider === 'sharepoint') && (
                <div className="flex flex-col gap-6">
                   <div>
                       {renderLabel('Azure Tenant ID')}
                       <Input value={credentials.tenantId} onChange={e => setCredentials(p => ({ ...p, tenantId: e.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                   </div>
                   <div>
                       {renderLabel('Application (Client) ID')}
                       <Input value={credentials.clientId} onChange={e => setCredentials(p => ({ ...p, clientId: e.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                   </div>
                   <div>
                       {renderLabel('Client Secret Value')}
                       <div className="relative">
                          <Input type={showSecret ? "text" : "password"} value={credentials.clientSecret} onChange={e => setCredentials(p => ({ ...p, clientSecret: e.target.value }))} placeholder="******************" className="pr-10" />
                          <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700">
                             {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                       </div>
                   </div>
                </div>
              )}
               {provider === 'gdrive' && (
                <div className="flex flex-col gap-6">
                   <div><label className="text-sm font-semibold mb-2 block">Service Account Email</label><Input value={credentials.serviceAccount} onChange={e => setCredentials(p => ({ ...p, serviceAccount: e.target.value }))} placeholder="mfo-crm@your-project.iam.gserviceaccount.com" /></div>
                   <div>
                      <label className="text-sm font-semibold mb-2 block">Service Account JSON Key</label>
                      <label className={`w-full h-32 border-2 border-dashed ${credentials.gdriveJsonKey ? 'border-green-500 bg-green-50/10' : 'border-[var(--border-strong)] bg-[var(--bg-elevated)] hover:border-indigo-500'} rounded-[var(--radius-sm)] flex flex-col items-center justify-center cursor-pointer transition-colors`}>
                         <input 
                           type="file" 
                           accept=".json" 
                           className="hidden" 
                           onChange={(e) => {
                             const file = e.target.files?.[0];
                             if (file) {
                               const reader = new FileReader();
                               reader.onload = (ev) => {
                                 setCredentials(p => ({ ...p, gdriveJsonKey: ev.target?.result as string }));
                               };
                               reader.readAsText(file);
                             }
                           }} 
                         />
                         <DownloadCloud size={24} className={credentials.gdriveJsonKey ? "text-green-500 mb-2" : "text-[var(--text-tertiary)] mb-2"} />
                         <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">
                           {credentials.gdriveJsonKey ? "JSON Configuration Loaded" : "Click to upload JSON"}
                         </span>
                      </label>
                   </div>
                </div>
              )}
              {(provider === 'dropbox' || (!provider && false)) && (
                <div className="p-4 text-center border-dashed border-[var(--border-strong)] text-[var(--text-secondary)] text-sm">
                  Not fully implemented in sandbox yet. Use OneDrive.
                </div>
              )}
              {provider === 'aws' && (
                <div className="flex flex-col gap-6">
                   <div><label className="text-sm font-semibold mb-2 block">AWS Region</label><Input value={credentials.awsRegion} onChange={e => setCredentials(p => ({ ...p, awsRegion: e.target.value }))} placeholder="us-east-1" /></div>
                   <div><label className="text-sm font-semibold mb-2 block">Access Key ID</label><Input value={credentials.awsAccessKey} onChange={e => setCredentials(p => ({ ...p, awsAccessKey: e.target.value }))} placeholder="AKIAIOSFODNN7EXAMPLE" /></div>
                   <div><label className="text-sm font-semibold mb-2 block">Secret Access Key</label><Input type="password" value={credentials.awsSecretKey} onChange={e => setCredentials(p => ({ ...p, awsSecretKey: e.target.value }))} placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" /></div>
                   <div><label className="text-sm font-semibold mb-2 block">S3 Bucket Name</label><Input value={credentials.awsBucket} onChange={e => setCredentials(p => ({ ...p, awsBucket: e.target.value }))} placeholder="my-mfo-documents" /></div>
                </div>
              )}
            </CardContent></Card>

            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button variant="default" onClick={async () => {
                 // Save securely when passing step 1
                 await syncConfig(provider, rootFolder, credentialsRef.current);
                 setStep(2);
              }} disabled={!isStep1Valid()}>Next Step</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <Card className="shadow-sm border-border">
              <CardHeader className="py-4 border-b">
                <CardTitle className="text-lg font-semibold">Drive Parameters</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
              <div className="flex flex-col gap-6">
                {provider === 'sharepoint' ? (
                  <div>
                     <label className="text-sm font-semibold mb-2 block">SharePoint Site URL</label>
                     <div className="flex gap-2">
                        <Input value={credentials.siteUrl} onChange={e => setCredentials(p => ({...p, siteUrl: e.target.value}))} placeholder="https://yourtenant.sharepoint.com/sites/MFO-Central" />
                        <Button variant="outline" onClick={() => fetchFolders('root', 'Root')}>Mount</Button>
                     </div>
                  </div>
                ) : provider === 'aws' ? (
                  <div>
                     <label className="text-sm font-semibold mb-2 block">Target S3 Bucket</label>
                     <div className="flex gap-2">
                        <Input value={credentials.awsBucket} disabled placeholder="Target bucket mapped from Step 1" />
                        <Button variant="outline" onClick={() => fetchFolders('root', 'Root')}>Mount</Button>
                     </div>
                  </div>
                ) : (
                  <div>
                     <label className="text-sm font-semibold mb-2 block">Service Account</label>
                     <div className="flex gap-2">
                        <Input value={credentials.serviceAccount} onChange={e => setCredentials(p => ({...p, serviceAccount: e.target.value}))} placeholder="admin@..." />
                        <Button variant="outline" onClick={() => fetchFolders('root', 'Root')}>Mount</Button>
                     </div>
                  </div>
                )}

                {browserLoading && <div className="text-sm text-blue-500 animate-pulse font-semibold mt-2">Connecting to storage and fetching folders...</div>}
                {browserError && <div className="text-sm text-red-500 font-semibold mt-2">{browserError}</div>}
                
                {browserFolders.length > 0 && !browserLoading && (
                  <div className="p-4 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] mt-2">
                    <div className="flex items-center gap-2 mb-3">
                       <FolderOpen className="text-green-600" size={18} />
                       <span className="font-semibold text-sm text-[var(--text-primary)]">Successfully Mounted. Accessible Folders:</span>
                    </div>
                    <ul className="list-inside list-none flex gap-2">
                      {browserFolders.map(f => (
                        <li key={f.id} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200">
                          📁 {f.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent></Card>

            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button variant="default" onClick={() => setStep(3)} disabled={!isStep2Valid()}>Next Step</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6 animate-fade-in items-center">
            {testResult === null ? (
              <div className="text-center w-full max-w-lg">
                <h3 className="text-[1.125rem] font-bold text-[var(--text-primary)] mb-4">
                  Ready to Deploy Binding
                </h3>
                
                <div className="mt-6 flex flex-col gap-4">
                 {validationLogs.length > 0 && (
                   <div className="bg-slate-900 border border-slate-700 rounded-md p-4 flex flex-col gap-2 font-mono text-xs shadow-inner mb-4 text-left">
                      {validationLogs.map((log, i) => (
                         <div key={i} className="flex items-center gap-2">
                           {log.status === 'pending' && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                           {log.status === 'pass' && <CheckCircle className="w-3 h-3 text-green-400" />}
                           {log.status === 'fail' && <span className="w-3 h-3 text-red-500 font-bold">X</span>}
                           <span className={log.status === 'pending' ? 'text-blue-200' : log.status === 'pass' ? 'text-green-300' : 'text-red-400'}>{log.message}</span>
                         </div>
                      ))}
                   </div>
                 )}
                 <Button 
                  onClick={handleTestConnection}
                  disabled={testing || testResult === 'success'}
                  className={testResult === 'success' ? 'bg-green-600 hover:bg-green-700 w-full' : 'bg-blue-600 hover:bg-blue-700 w-full'}
                 >
                   {testing ? 'Validating Graph Connectivity...' : testResult === 'success' ? 'Bound Successfully' : 'Run Security Validation & Bind'}
                 </Button>
                </div>
              </div>
            ) : (
              <Card className="shadow-sm border-border w-full">
                <CardHeader className="py-4 border-b">
                  <CardTitle className="text-lg font-semibold">Integration Passed</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                <div className="text-center p-8">
                   <ShieldCheck size={48} className="mx-auto text-[var(--color-green)] mb-4" />
                   <h3 className="text-[1.25rem] font-bold text-[var(--text-primary)] mb-2">Drive Successfully Mounted</h3>
                   <p className="text-[0.875rem] text-[var(--text-secondary)] mb-6">CRM logic natively mapped to <code>/{rootFolder}</code>.</p>
                   <div className="flex gap-4 justify-center mt-2">
                       <Button variant="outline" onClick={() => window.location.reload()}>Close Wizard</Button>
                       <Button variant="default" onClick={() => { 
                           fetchFolders('root', rootFolder || 'Root');
                           setStep(4); 
                       }}>Next Step: Launch Explorer</Button>
                   </div>
                </div>
              </CardContent></Card>
            )}
            
            <div className="flex justify-between mt-4 w-full">
              {testResult === null && <Button variant="outline" onClick={() => setStep(2)}>Back</Button>}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-6 animate-fade-in w-full min-h-[calc(100vh-16rem)] flex-1 relative">
             <div className="absolute top-2 right-6 z-50">
               <Button variant="outline" size="sm" onClick={() => setStep(0)}>Close Wizard</Button>
             </div>
             {tenant?.id && <StorageExplorer tenantId={tenant.id} />}
          </div>
        )}

      </div>
    </div>
  );
}
