'use client';

import React, { useState, useMemo } from 'react';
import { Database, Link2, CheckCircle2, ArrowRight, Loader2, ArrowDownCircle, Settings, CheckSquare, X, Network } from 'lucide-react';
import { getFirestore, writeBatch, doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { OdooSchemaDiagram } from './OdooSchemaDiagram';

interface OdooMigrationProps {
  tenantId: string;
  initialTargetType?: 'contacts' | 'tasks' | 'projects' | 'employees' | 'departments';
  hideTargetSelection?: boolean;
  onClose?: () => void;
}

export function OdooMigrationUtility({ tenantId, initialTargetType, hideTargetSelection, onClose }: OdooMigrationProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'source_selection' | 'connect' | 'catalog_erd' | 'mapping' | 'selection' | 'migrating' | 'done'>('source_selection');
  const [activeSource, setActiveSource] = useState<string | null>(null);
  
  // ERD Catalog State
  const [catalogModels, setCatalogModels] = useState<any[]>([]);
  const [catalogRelations, setCatalogRelations] = useState<any[]>([]);
  const [erdSelectedModels, setErdSelectedModels] = useState<string[]>([]);
  
  // Preview Modal State
  const [previewModal, setPreviewModal] = useState<{isOpen: boolean, modelId: string | null}>({isOpen: false, modelId: null});
  const [previewGridData, setPreviewGridData] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Connection Form
  const [url, setUrl] = useState('');
  const [dbName, setDbName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  React.useEffect(() => {
    if (!user?.uid || !activeSource) return;
    const fetchCreds = async () => {
       try {
           const snap = await getDoc(doc(getFirestore(), 'users', user.uid, 'settings', `data_sources_${activeSource}`));
           if (snap.exists()) {
               const data = snap.data();
               if (data.url) setUrl(data.url);
               if (data.db) setDbName(data.db);
               if (data.username) setUsername(data.username);
               if (data.password) setPassword(data.password);
           }
       } catch (e) {
           console.error("Failed to load saved source credentials", e);
       }
    };
    fetchCreds();
  }, [user?.uid, activeSource]);
  
  // Connection State
  const [authData, setAuthData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Target Config
  const [targetType, setTargetType] = useState<'contacts' | 'tasks' | 'projects' | 'employees' | 'departments'>(initialTargetType || 'contacts');
  const [customTarget, setCustomTarget] = useState('');
  const [overwriteMode, setOverwriteMode] = useState(false);
  
  // Mapping State
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [advancedMappingMode, setAdvancedMappingMode] = useState<Record<string, boolean>>({});
  const [transformations, setTransformations] = useState<Record<string, {type: string}[]>>({});
  const [odooFields, setOdooFields] = useState<any[]>([]); // Dynamic fields
  
  // Selection State
  const [previewRecords, setPreviewRecords] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Migration State
  const [progress, setProgress] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const MODELS = {
    contacts: { odooModel: 'res.partner', mfoPath: `tenants/${tenantId}/contacts`, 
                fields: { 
                    name: 'Name', email: 'Email', phone: 'Phone', mobile: 'Mobile', 
                    is_company: 'Is Company (Boolean)', vat: 'VAT/Tax ID', 
                    website: 'Website', street: 'Street', city: 'City', zip: 'Zip', 
                    category_id: 'Tags', comment: 'Notes', parent_id: 'Parent Company'
                },
                crmConfig: { 
                    name: 'name', email: 'email', phone: 'phone', taxId: 'vat', 
                    isCompany: 'is_company', website: 'website', street: 'street', 
                    city: 'city', notes: 'comment', parentId: 'parent_id'
                } 
              },
    tasks: { odooModel: 'project.task', mfoPath: `tenants/${tenantId}/tasks`, 
                fields: { name: 'Task Name', date_deadline: 'Deadline', description: 'Description' },
                crmConfig: { title: 'name', description: 'description', dueDate: 'date_deadline' } },
    projects: { odooModel: 'project.project', mfoPath: `tenants/${tenantId}/projects`, 
                fields: { name: 'Project Name', active: 'Is Active' },
                crmConfig: { name: 'name' } },
    employees: { odooModel: 'hr.employee', mfoPath: `tenants/${tenantId}/employees`, 
                fields: { name: 'Name', work_email: 'Work Email', work_phone: 'Work Phone', job_id: 'Job Title', department_id: 'Department', image_128: 'Avatar' },
                crmConfig: { name: 'name', email: 'work_email', phone: 'work_phone', jobTitle: 'job_id', department: 'department_id', avatarUrl: 'image_128' } },
    departments: { odooModel: 'hr.department', mfoPath: `tenants/${tenantId}/departments`,
                fields: { name: 'Department Name', parent_id: 'Parent Department', manager_id: 'Manager' },
                crmConfig: { name: 'name', parentDepartment: 'parent_id', manager: 'manager_id' } }
  };

  const handlePreviewData = async (modelId: string) => {
    setPreviewModal({ isOpen: true, modelId });
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/odoo/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           url, session_id: authData?.session_id, model: modelId, limit: 50
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewGridData(data.records || []);
    } catch (e: any) {
      console.error(e);
      setPreviewGridData([{ error: e.message || 'Failed to fetch preview' }]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/odoo/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, db: dbName, username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection failed');
      
      // Fetch the full catalog of models & relations for the ERD instead of immediately mapping
      addLog("Fetching Odoo data dictionary & referential integrity graph...");
      const catalogRes = await fetch('/api/odoo/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, session_id: data.session_id })
      });
      const catalogData = await catalogRes.json();
      if (!catalogRes.ok) throw new Error(catalogData.error || 'Failed to fetch Odoo Catalog');
      
      setCatalogModels(catalogData.models || []);
      setCatalogRelations(catalogData.relations || []);
      // Pre-select the targetType's corresponding model just so something is selected
      const initialModel = MODELS[targetType]?.odooModel;
      if (initialModel) setErdSelectedModels([initialModel]);
      
      setAuthData(data);
      setStep('catalog_erd');
      
      try {
        if (user?.uid) {
           await setDoc(doc(getFirestore(), 'users', user.uid, 'settings', `data_sources_${activeSource}`), {
             url, db: dbName, username, password
           }, { merge: true });
        }
      } catch (saveErr) {
        console.error("Failed to save credentials to user settings", saveErr);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProceedFromErd = async () => {
      if (erdSelectedModels.length === 0) {
         setError("Please select at least one model from the ERD diagram.");
         return;
      }
      
      setLoading(true); setError('');
      try {
          addLog(`Fetching schema for ${erdSelectedModels.length} selected models...`);
          
          const primaryModel = erdSelectedModels[0];
          let allFields: any[] = [];

          // Fetch schema for all selected models
          const promises = erdSelectedModels.map(async (mod) => {
             const res = await fetch('/api/odoo/schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, session_id: authData.session_id, model: mod })
             });
             const data = await res.json();
             if (!res.ok) throw new Error(data.error || `Failed to fetch schema for ${mod}`);
             
             // Prefix the field IDs so we know which model they belong to
             return (data.fields || []).map((f: any) => ({
                 ...f,
                 id: `${mod}.${f.id}`,
                 label: `${mod} ➔ ${f.label}`
             }));
          });

          const results = await Promise.all(promises);
          results.forEach(resArray => {
             allFields = [...allFields, ...resArray];
          });
          
          setOdooFields(allFields);
          setStep('mapping');
          
          // If we matched a known target targetType, populate default CRM map
          const knownConfigKey = Object.keys(MODELS).find(k => MODELS[k as keyof typeof MODELS].odooModel === primaryModel);
          if (knownConfigKey) {
             const conf = MODELS[knownConfigKey as keyof typeof MODELS].crmConfig;
             const initialMap: Record<string, string> = {};
             // We must prefix the initial map values with the primary model
             Object.entries(conf).forEach(([crmField, odooField]) => { initialMap[crmField] = `${primaryModel}.${odooField}`; });
             setMapping(initialMap);
             // Ensure target type aligns if it was automatically mapped
             setTargetType(knownConfigKey as any);
          } else {
             setMapping({});
             // Custom route
             setCustomTarget(primaryModel.replace('.', '_'));
          }
      } catch (err: any) {
          setError(err.message);
      } finally {
          setLoading(false);
      }
  };

  const fetchPreview = async () => {
    setLoading(true); setError('');
    const { session_id } = authData;
    const { odooModel } = MODELS[targetType];
    
    try {
      const extractedFields = new Set<string>();
      Object.values(mapping).forEach(val => {
         if (val === 'IGNORE') return;
         
         // Extract anything inside {{ }}
         const matches = [...val.matchAll(/\{\{([^}]+)\}\}/g)];
         if (matches.length > 0) {
             matches.forEach(m => {
                // If it contains a dot (e.g. res.partner.name), strip the model part for now to fetch from main model
                // In a true deep fetch, we would need subsequent calls. For now we assume base fields.
                const fieldName = m[1].includes('.') ? m[1].split('.').pop()! : m[1];
                extractedFields.add(fieldName);
             });
         } else {
             // It's a direct mapping like "res.partner.name" or "name"
             const fieldName = val.includes('.') ? val.split('.').pop()! : val;
             extractedFields.add(fieldName);
         }
      });

      const mappedOdooFields = Array.from(extractedFields);
      if (!mappedOdooFields.includes('id')) mappedOdooFields.push('id');
      if (targetType === 'contacts' && !mappedOdooFields.includes('name')) mappedOdooFields.push('name');
      if (targetType === 'contacts' && !mappedOdooFields.includes('email')) mappedOdooFields.push('email');

      const res = await fetch('/api/odoo/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url, session_id, model: odooModel, 
          domain: [], // Could inject pre-filters here
          fields: mappedOdooFields, limit: 1500 
        })
      });
      
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      
      setPreviewRecords(data.records || []);
      setSelectedIds(new Set()); // start unselected
      setStep('selection');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const executeMigration = async () => {
    if (selectedIds.size === 0) {
       setError("Por favor, selecione pelo menos um registro.");
       return;
    }
    
    setStep('migrating');
    const { mfoPath } = MODELS[targetType];
    const recordsToMigrate = previewRecords.filter(r => selectedIds.has(r.id));
    
    try {
      addLog(`Preparing to migrate ${recordsToMigrate.length} selected records...`);
      setTotalRecords(recordsToMigrate.length);
      
      const db = getFirestore();
      
      const BATCH_SIZE = 400;
      for (let i = 0; i < recordsToMigrate.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = recordsToMigrate.slice(i, i + BATCH_SIZE);
        
        chunk.forEach((rec: any) => {
           let targetCollection = mfoPath;
           const newId = String(rec.id);
           const payload: any = {
             id: newId,
             legacyId: rec.id,
             tenantId: tenantId, 
             createdAt: new Date().toISOString()
           };

           Object.entries(mapping).forEach(([crmKey, odooKey]) => {
               if (odooKey !== 'IGNORE') {
                 let val: any = '';

                 if (typeof odooKey === 'string' && odooKey.includes('{{')) {
                     // Advanced Expression Mode
                     val = odooKey.replace(/\{\{([^}]+)\}\}/g, (match, fieldPath) => {
                         const fieldName = fieldPath.includes('.') ? fieldPath.split('.').pop()! : fieldPath;
                         let v = rec[fieldName];
                         if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number') v = v[1];
                         return v === null || v === undefined || v === false ? '' : String(v);
                     });
                 } else {
                     // Standard Field Mapping Mode
                     const fieldName = odooKey.includes('.') ? odooKey.split('.').pop()! : odooKey;
                     val = rec[fieldName];
                     if (Array.isArray(val) && val.length === 2 && typeof val[0] === 'number') val = val[1];
                 }
                 
                 // Apply ETL Transformations
                 const fieldTransforms = transformations[crmKey] || [];
                 fieldTransforms.forEach(t => {
                    if (val == null || val === false) return;
                    if (t.type === 'uppercase' && typeof val === 'string') val = val.toUpperCase();
                    else if (t.type === 'lowercase' && typeof val === 'string') val = val.toLowerCase();
                    else if (t.type === 'trim' && typeof val === 'string') val = val.trim();
                    else if (t.type === 'number_only' && typeof val === 'string') val = val.replace(/\D/g, '');
                    else if (t.type === 'boolean') val = !!val;
                 });
                 
                 // If it's the avatar image from Odoo and it's a base64 string, format it
                 if (crmKey === 'avatarUrl' && val && typeof val === 'string' && !val.startsWith('http') && !val.startsWith('data:')) {
                    val = `data:image/jpeg;base64,${val}`;
                 }
                 
                 // Odoo evaluates missing strings/booleans as false in some Python logic, we normalize it
                 if (val === false) val = '';
                 
                 payload[crmKey] = val;
               }
           });
           
           // Target Type Enforcements
           if (targetType === 'tasks') {
              payload.status = 'open';
           } else if (targetType === 'contacts') {
              const isComp = payload.isCompany || rec.is_company;
              
              if (isComp) {
                  // Route to Organizations
                  targetCollection = `tenants/${tenantId}/organizations`;
                  payload.status = 'active';
              } else {
                  // Route to Contacts
                  targetCollection = `tenants/${tenantId}/contacts`;
                  payload.role = 'other';
                  
                  // Parent company relationship mapping from Odoo's parent_id tuple [id, "Name"]
                  if (rec.parent_id && Array.isArray(rec.parent_id)) {
                      payload.linkedOrgIds = [String(rec.parent_id[0])];
                      payload.linkedOrgNames = [rec.parent_id[1]];
                  } else {
                      payload.linkedOrgIds = [];
                      payload.linkedOrgNames = [];
                  }
                  
                  payload.linkedFamilyIds = [];
                  payload.linkedFamilyNames = [];
                  
                  // CRM Contacts require split firstName and lastName
                  if (payload.name) {
                     const parts = payload.name.trim().split(' ');
                     payload.firstName = parts[0];
                     payload.lastName = parts.length > 1 ? parts.slice(1).join(' ') : '(Migrated)';
                     delete payload.name;
                  } else {
                     payload.firstName = 'Unknown';
                     payload.lastName = '(Migrated)';
                  }
              }
              delete payload.isCompany; // cleanup transit field
           } else if (targetType === 'employees') {
               // CRM Employees require split firstName and lastName
               if (payload.name) {
                  const parts = payload.name.trim().split(' ');
                  payload.firstName = parts[0];
                  payload.lastName = parts.length > 1 ? parts.slice(1).join(' ') : '(Migrated)';
                  delete payload.name;
               } else {
                  payload.firstName = 'Unknown';
                  payload.lastName = '(Migrated)';
               }
           }

           if (customTarget) {
               targetCollection = `tenants/${tenantId}/${customTarget}`;
           }

           const docRef = doc(db, targetCollection, newId);
           batch.set(docRef, payload, overwriteMode ? {} : { merge: true });
        });
        
        await batch.commit();
        setProgress(Math.min(i + BATCH_SIZE, recordsToMigrate.length));
        addLog(`Committed batch ${Math.floor(i/BATCH_SIZE) + 1}...`);
      }
      
      addLog(`Migration complete! Successfully migrated ${recordsToMigrate.length} records.`);
      setStep('done');
    } catch (err: any) {
      addLog(`ERROR: ${err.message}`);
      setStep('selection');
      setError(err.message);
    }
  };

  const addLog = (msg: string) => setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // Handle Search & Selection 
  const filteredPreview = useMemo(() => {
    if (!searchQuery) return previewRecords;
    const lowerQ = searchQuery.toLowerCase();
    return previewRecords.filter(r => 
       r.name?.toString().toLowerCase().includes(lowerQ) ||
       r.email?.toString().toLowerCase().includes(lowerQ)
    );
  }, [previewRecords, searchQuery]);

  const toggleAll = () => {
    if (selectedIds.size === filteredPreview.length) {
       setSelectedIds(new Set()); // Deselect all
    } else {
       setSelectedIds(new Set(filteredPreview.map(r => r.id))); // Select all filtered
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="w-full flex flex-col gap-6 p-2 h-full max-h-full relative">
      {onClose && (
        <button onClick={onClose} className="absolute top-2 right-2 p-2 bg-gray-100/50 hover:bg-gray-100 rounded-full text-gray-500 z-50">
          <X size={20} />
        </button>
      )}
      {/* Header Pipeline */}
      <div className="flex items-center gap-2 md:gap-4 border-b border-[var(--border)] pb-4 overflow-x-auto shrink-0">
        <div className={`flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold whitespace-nowrap ${step === 'connect' ? 'text-indigo-600' : 'text-[var(--text-tertiary)]'}`}>
          <Database size={16} /> 1. Conexão
        </div>
        <ArrowRight size={14} className="text-gray-300" />
        <div className={`flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold whitespace-nowrap ${step === 'catalog_erd' ? 'text-indigo-600' : 'text-[var(--text-tertiary)]'}`}>
          <Network size={16} /> 2. Modelos & ERD
        </div>
        <ArrowRight size={14} className="text-gray-300" />
        <div className={`flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold whitespace-nowrap ${step === 'mapping' ? 'text-indigo-600' : 'text-[var(--text-tertiary)]'}`}>
          <Settings size={16} /> 3. Mapeamento
        </div>
        <ArrowRight size={14} className="text-gray-300" />
        <div className={`flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold whitespace-nowrap ${step === 'selection' ? 'text-indigo-600' : 'text-[var(--text-tertiary)]'}`}>
          <CheckSquare size={16} /> 4. Seleção de Dados
        </div>
        <ArrowRight size={14} className="text-gray-300" />
        <div className={`flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold whitespace-nowrap ${['migrating', 'done'].includes(step) ? 'text-indigo-600' : 'text-[var(--text-tertiary)]'}`}>
          <ArrowDownCircle size={16} /> 5. Execução
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
      
        {/* Step 0: Source Selection */}
        {step === 'source_selection' && (
          <div className="max-w-3xl animate-fade-in text-center mx-auto mt-6 relative">
            <h2 className="text-xl font-black text-gray-800 tracking-tight mb-2">Select Data Source</h2>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto text-sm">Choose the system you wish to migrate records from. Configurations are loaded from your user profile.</p>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 text-left">
               <button onClick={() => { setActiveSource('odoo'); setStep('connect'); }} className="p-6 rounded-2xl border bg-white flex flex-col gap-4 items-center hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/20 transition-all border-gray-200">
                  <img src="https://www.google.com/s2/favicons?domain=odoo.com&sz=128" alt="Odoo ERP" className="w-12 h-12 object-contain" />
                  <div className="font-bold text-gray-800 text-sm">Odoo ERP</div>
               </button>
               <button disabled className="p-6 rounded-2xl border bg-white flex flex-col gap-4 items-center border-gray-200 relative overflow-hidden transition-all hover:border-indigo-400 hover:shadow-lg">
                  <div className="absolute top-0 right-0 bg-indigo-50 text-indigo-500 text-[10px] uppercase font-bold py-1 px-2 rounded-bl-xl shadow-sm">SOON</div>
                  <img src="https://www.google.com/s2/favicons?domain=salesforce.com&sz=128" alt="Salesforce" className="w-12 h-12 object-contain" />
                  <div className="font-bold text-gray-800 text-sm">Salesforce</div>
               </button>
               <button disabled className="p-6 rounded-2xl border bg-white flex flex-col gap-4 items-center border-gray-200 relative overflow-hidden transition-all hover:border-indigo-400 hover:shadow-lg">
                  <div className="absolute top-0 right-0 bg-indigo-50 text-indigo-500 text-[10px] uppercase font-bold py-1 px-2 rounded-bl-xl shadow-sm">SOON</div>
                  <img src="https://www.google.com/s2/favicons?domain=hubspot.com&sz=128" alt="HubSpot" className="w-12 h-12 object-contain" />
                  <div className="font-bold text-gray-800 text-sm">HubSpot</div>
               </button>
               <button disabled className="p-6 rounded-2xl border bg-white flex flex-col gap-4 items-center border-gray-200 relative overflow-hidden transition-all hover:border-indigo-400 hover:shadow-lg">
                  <div className="absolute top-0 right-0 bg-indigo-50 text-indigo-500 text-[10px] uppercase font-bold py-1 px-2 rounded-bl-xl shadow-sm">SOON</div>
                  <img src="https://www.google.com/s2/favicons?domain=servicenow.com&sz=128" alt="ServiceNow" className="w-12 h-12 object-contain" />
                  <div className="font-bold text-gray-800 text-sm">ServiceNow</div>
               </button>
               <button disabled className="p-6 rounded-2xl border bg-white flex flex-col gap-4 items-center border-gray-200 relative overflow-hidden transition-all hover:border-indigo-400 hover:shadow-lg">
                  <div className="absolute top-0 right-0 bg-indigo-50 text-indigo-500 text-[10px] uppercase font-bold py-1 px-2 rounded-bl-xl shadow-sm">SOON</div>
                  <img src="https://www.google.com/s2/favicons?domain=microsoft.com&sz=128" alt="Microsoft Excel" className="w-12 h-12 object-contain" />
                  <div className="font-bold text-gray-800 text-sm">Excel</div>
               </button>
               <button disabled className="p-6 rounded-2xl border bg-white flex flex-col gap-4 items-center border-gray-200 relative overflow-hidden transition-all hover:border-indigo-400 hover:shadow-lg">
                  <div className="absolute top-0 right-0 bg-indigo-50 text-indigo-500 text-[10px] uppercase font-bold py-1 px-2 rounded-bl-xl shadow-sm">SOON</div>
                  <img src="https://www.google.com/s2/favicons?domain=sheets.google.com&sz=128" alt="Google Sheets" className="w-12 h-12 object-contain" />
                  <div className="font-bold text-gray-800 text-sm">Sheets</div>
               </button>
            </div>
          </div>
        )}

        {/* Step 1: Connect */}
        {step === 'connect' && (
          <form onSubmit={handleConnect} className="max-w-md w-full flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-1 block">Odoo SaaS URL</label>
              <input type="url" required placeholder="https://mycompany.odoo.com" value={url} onChange={e => setUrl(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)]" />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-1 block">Database Name</label>
              <input type="text" required placeholder="mycompany_db" value={dbName} onChange={e => setDbName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)]" />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-1 block">Username / Email</label>
              <input type="text" required placeholder="admin@mycompany.com" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)]" />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-1 block">Password / API Key</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
               {!hideTargetSelection && (
                 <div>
                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-1 block">Odoo Source (Migration Preset)</label>
                    <select value={targetType} onChange={(e: any) => setTargetType(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-sm font-bold text-indigo-700">
                      <option value="contacts">Organizações & Contatos (res.partner)</option>
                      <option value="employees">Equipe & Agentes (hr.employee)</option>
                      <option value="departments">Estrutura Orgânica & Departamentos (hr.department)</option>
                      <option value="tasks">Tarefas (project.task)</option>
                      <option value="projects">Projetos (project.project)</option>
                    </select>
                 </div>
               )}
               {hideTargetSelection && (
                 <div>
                    {/* Preserve layout space or indicate locked target if needed, but since it's hidden we just show the locked mode */}
                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-1 block">Target Import Object</label>
                    <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm font-bold text-gray-500 capitalize">{targetType}</div>
                 </div>
               )}
               <div>
                  <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-1 block">Modo de Gravação</label>
                  <select value={overwriteMode ? "overwrite" : "merge"} onChange={(e) => setOverwriteMode(e.target.value === "overwrite")} className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-xs">
                     <option value="merge">Mesclar Dados</option>
                     <option value="overwrite">Substituição Total</option>
                  </select>
               </div>
            </div>

            {!hideTargetSelection && (
              <div>
                  <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-1 block">Tabela CRM Exata (Opcional)</label>
                  <select value={customTarget} onChange={(e: any) => setCustomTarget(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-xs">
                    <option value="">Roteamento Automático (Padrão)</option>
                    <option value="contacts">Contatos (`contacts` Forçado)</option>
                    <option value="organizations">Organizações (`organizations` Forçado)</option>
                    <option value="tasks">Tarefas (`tasks` Forçado)</option>
                    <option value="projects">Projetos (`projects` Forçado)</option>
                    <option value="employees">Equipe (`employees` Forçado)</option>
                  </select>
              </div>
            )}

            {error && <div className="text-red-500 text-xs font-bold p-3 bg-red-50 rounded-lg">{error}</div>}

            <button type="submit" disabled={loading} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Link2 size={16} />} 
              Autenticar e Conectar
            </button>
          </form>
        )}

        {/* Step 1.5: Schema Diagram Catalog */}
        {step === 'catalog_erd' && authData && (
          <div className="w-full flex flex-col gap-4 animate-fade-in h-[calc(100vh-250px)]">
            <div className="flex justify-between items-end gap-4 shrink-0">
               <div>
                  <h3 className="text-xl font-bold text-[var(--text-primary)]">Dicionário de Dados Dinâmico</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Visualize e selecione os modelos relacionalmente. Os nós selecionados definirão o escopo do mapeamento.
                  </p>
               </div>
               
               <button onClick={handleProceedFromErd} disabled={erdSelectedModels.length === 0 || loading} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-6 py-3 rounded-lg disabled:opacity-50 flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : 'Prosseguir para Mapeamento'}
                  <ArrowRight size={16} />
               </button>
            </div>
            
            {error && <div className="text-red-500 text-xs font-bold p-3 bg-red-50 rounded-lg">{error}</div>}

            <OdooSchemaDiagram 
              models={catalogModels} 
              relations={catalogRelations} 
              selectedModels={erdSelectedModels} 
              onSelectionChange={setErdSelectedModels} 
              onPreview={handlePreviewData}
            />
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 'mapping' && authData && (
          <div className="max-w-2xl w-full flex flex-col gap-6">
            <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
               <h4 className="font-bold flex items-center gap-2"><CheckCircle2 size={18} /> Modelos Carga Selecionados</h4>
               <p className="text-sm mt-1">Mapeando modelo principal: <strong>{erdSelectedModels[0]}</strong>. Você pode configurar os campos que deseja trazer deste objeto.</p>
            </div>

            <div>
               <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Mapeamento de Campos: {erdSelectedModels[0]} ➔ CRM</h3>
               <div className="flex flex-col gap-3">
                  {Object.keys(MODELS[targetType].crmConfig).map(crmField => (
                     <div key={crmField} className="flex items-center gap-4 border p-3 rounded-lg bg-[var(--bg-surface)]">
                        <div className="flex-[1.5]">
                          <div className="flex items-center justify-between mb-1">
                             <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase flex items-center gap-1">
                               Campo Fonte (Odoo)
                             </label>
                             <label className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded cursor-pointer border border-indigo-100 hover:bg-indigo-100">
                                <input type="checkbox" className="w-2 h-2 accent-indigo-600" 
                                   checked={!!advancedMappingMode[crmField]} 
                                   onChange={e => setAdvancedMappingMode(p => ({...p, [crmField]: e.target.checked}))} 
                                />
                                Expr
                             </label>
                          </div>
                          
                          {!advancedMappingMode[crmField] ? (
                             <select 
                               value={mapping[crmField] || 'IGNORE'} 
                               onChange={(e) => setMapping(prev => ({...prev, [crmField]: e.target.value}))}
                               className="w-full text-xs p-2 border rounded shadow-sm bg-white font-mono"
                             >
                                <option value="IGNORE">Ignorar (Não importar)</option>
                                {odooFields.map((f: any) => (
                                   <option key={f.id} value={f.id}>{f.label} ({f.id}) - {f.type}</option>
                                ))}
                             </select>
                          ) : (
                             <input 
                               type="text"
                               placeholder="{{res.partner.name}} - {{res.partner.vat}}"
                               value={mapping[crmField] === 'IGNORE' ? '' : mapping[crmField] || ''}
                               onChange={(e) => setMapping(prev => ({...prev, [crmField]: e.target.value}))}
                               className="w-full text-xs p-2 border border-indigo-300 ring-1 ring-indigo-50 rounded shadow-inner bg-indigo-50/30 font-mono text-indigo-700 placeholder-indigo-300"
                             />
                          )}
                        </div>
                        <ArrowRight size={18} className="text-indigo-500 shrink-0" />
                        <div className="flex-1">
                           <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase mb-1">Campo Destino (CRM)</label>
                           <div className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded border border-emerald-200 flex items-center justify-between">
                             {crmField}
                             {transformations[crmField]?.length > 0 && (
                               <span className="text-[9px] bg-emerald-200 text-emerald-800 px-1 rounded-full">{transformations[crmField].length} ETL</span>
                             )}
                           </div>
                        </div>
                        <div className="flex-[1.5] border-l pl-4 border-[var(--border)] min-h-[46px] flex flex-col justify-center">
                           <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase mb-1">Filtros ETL (Runtime)</label>
                           <div className="flex gap-2 items-center flex-wrap">
                              {(transformations[crmField] || []).map((t, idx) => (
                                  <div key={idx} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 border border-indigo-100">
                                     {t.type}
                                     <X size={10} className="cursor-pointer hover:scale-110" onClick={() => {
                                       setTransformations(prev => {
                                          const n = [...(prev[crmField] || [])];
                                          n.splice(idx, 1);
                                          return {...prev, [crmField]: n};
                                       })
                                     }}/>
                                  </div>
                              ))}
                              <select 
                                className="text-[10px] p-1 border rounded shadow-sm bg-gray-50 text-gray-600 outline-none"
                                value=""
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  setTransformations(prev => ({
                                     ...prev,
                                     [crmField]: [...(prev[crmField] || []), { type: e.target.value }]
                                  }));
                                }}
                              >
                                 <option value="">+ Add ETL Rule</option>
                                 <option value="uppercase">Uppercase</option>
                                 <option value="lowercase">Lowercase</option>
                                 <option value="trim">Limpar Espaços</option>
                                 <option value="number_only">Apenas Números</option>
                                 <option value="boolean">To Boolean</option>
                              </select>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            {error && <div className="text-red-500 text-xs font-bold p-3 bg-red-50 rounded-lg">{error}</div>}

            <div className="flex justify-end mt-4">
              <button disabled={loading} onClick={fetchPreview} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-lg flex justify-center items-center gap-2">
                {loading && <Loader2 className="animate-spin" size={16} />}
                Buscar Registros para Seleção
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Selection */}
        {step === 'selection' && (
           <div className="w-full flex flex-col gap-4 h-full max-h-full">
              <div className="flex justify-between items-end gap-4 shrink-0">
                 <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Selecione os Dados para Importar</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Foram encontrados {previewRecords.length} registros. Filtre e marque checkboxes para aprovar a migração.</p>
                 </div>
                 
                 <div className="flex items-center gap-3">
                    <input 
                      type="text" 
                      placeholder="Pesquisar por Nome/Email..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-xs min-w-[250px]"
                    />
                    <button onClick={executeMigration} disabled={selectedIds.size === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50">
                       Iniciar Migração ({selectedIds.size})
                    </button>
                 </div>
              </div>

              {error && <div className="text-red-500 text-xs font-bold p-3 bg-red-50 rounded-lg shrink-0">{error}</div>}

              <div className="border border-[var(--border)] rounded-xl overflow-y-auto flex-1 bg-[var(--bg-surface)] mt-2">
                 <table className="w-full text-left border-collapse text-xs">
                    <thead>
                       <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border)] sticky top-0">
                          <th className="p-3 w-12 text-center">
                             <input 
                               type="checkbox" 
                               checked={filteredPreview.length > 0 && selectedIds.size === filteredPreview.length}
                               onChange={toggleAll}
                               className="w-4 h-4 cursor-pointer"
                             />
                          </th>
                          <th className="p-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider">ID</th>
                          <th className="p-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Nome</th>
                          
                          {targetType === 'contacts' && (
                             <>
                               <th className="p-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Email</th>
                               <th className="p-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Tipo (Odoo)</th>
                             </>
                          )}
                          
                          {targetType === 'employees' && (
                             <>
                               <th className="p-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Email Corporativo</th>
                               <th className="p-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Cargo</th>
                             </>
                          )}

                          {targetType === 'departments' && (
                             <>
                               <th className="p-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Departamento Pai</th>
                               <th className="p-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Líder (Gerente)</th>
                             </>
                          )}

                          {(targetType === 'tasks' || targetType === 'projects') && (
                             <th className="p-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider">Métrica</th>
                          )}
                       </tr>
                    </thead>
                    <tbody>
                       {filteredPreview.slice(0, 100).map(rec => (
                          <tr key={rec.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-muted)] cursor-pointer" onClick={() => toggleOne(rec.id)}>
                             <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={selectedIds.has(rec.id)} 
                                  onChange={() => toggleOne(rec.id)}
                                  className="w-4 h-4 cursor-pointer"
                                />
                             </td>
                             <td className="p-3 text-[var(--text-tertiary)] font-mono">{rec.id}</td>
                             <td className="p-3 font-bold">{rec.name || '-'}</td>
                             
                             {targetType === 'contacts' && (
                                <>
                                  <td className="p-3 text-[var(--text-secondary)]">{rec.email || '-'}</td>
                                  <td className="p-3">
                                     {rec.is_company ? (
                                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold">Empresa</span>
                                     ) : (
                                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">Pessoa</span>
                                     )}
                                  </td>
                                </>
                             )}
                             
                             {targetType === 'employees' && (
                                <>
                                  <td className="p-3 text-[var(--text-secondary)]">{rec.work_email || '-'}</td>
                                  <td className="p-3">
                                     <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{rec.job_id?.[1] || rec.job_id || 'Servidor'}</span>
                                  </td>
                                </>
                             )}

                             {targetType === 'departments' && (
                                <>
                                  <td className="p-3 text-[var(--text-secondary)]">{rec.parent_id?.[1] || '-'}</td>
                                  <td className="p-3">
                                     <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{rec.manager_id?.[1] || '-'}</span>
                                  </td>
                                </>
                             )}

                             {(targetType === 'tasks' || targetType === 'projects') && (
                                <td className="p-3 text-[var(--text-secondary)]">Importável</td>
                             )}
                          </tr>
                       ))}
                       {filteredPreview.length > 100 && (
                          <tr><td colSpan={5} className="p-4 text-center text-xs font-bold text-[var(--text-tertiary)] bg-[var(--bg-elevated)]">
                             Mostrando os primeiros 100 resultados de {filteredPreview.length}. Use o filtro para refinar.
                          </td></tr>
                       )}
                       {filteredPreview.length === 0 && (
                          <tr><td colSpan={7} className="p-8 text-center text-[var(--text-secondary)]">Nenhum registro encontrado.</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {/* Step 4: Migration Execution */}
        {['migrating', 'done'].includes(step) && (
          <div className="max-w-2xl w-full flex flex-col gap-4">
             <div className="p-4 bg-[var(--bg-elevated)] border rounded-xl">
                <h3 className="font-bold text-sm mb-4">Progresso da Migração ({targetType})</h3>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
                   <div className="bg-indigo-600 h-3 rounded-full transition-all duration-300" style={{ width: `${totalRecords > 0 ? (progress / totalRecords) * 100 : 0}%` }}></div>
                </div>
                <div className="text-xs text-[var(--text-tertiary)] text-right font-mono">
                   {progress} / {totalRecords} Registros Importados
                </div>
             </div>

             <div className="bg-black text-green-400 font-mono text-xs p-4 rounded-xl h-64 overflow-y-auto shadow-inner border border-gray-800">
                {logs.map((log, i) => (
                   <div key={i} className="mb-1">{log}</div>
                ))}
             </div>

             {step === 'done' && (
                <button onClick={() => { setStep('connect'); setProgress(0); setLogs([]); }} className="mt-6 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold px-8 py-3 rounded-xl m-auto transition-colors">
                   Finalizar e Fazer Nova Importação
                </button>
             )}
          </div>
        )}

      </div>

      {previewModal.isOpen && (
         <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-8 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
               <div className="bg-slate-900 px-6 py-4 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3 text-white">
                     <Database className="text-indigo-400" size={24} />
                     <div>
                        <h3 className="font-bold">Data Preview: {previewModal.modelId}</h3>
                        <p className="text-xs text-slate-400">Sample fetch of up to 50 records directly from Odoo via XML-RPC</p>
                     </div>
                  </div>
                  <button onClick={() => setPreviewModal({isOpen: false, modelId: null})} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-lg">
                     <X size={20} />
                  </button>
               </div>
               
               <div className="flex-1 overflow-auto bg-slate-50 p-6">
                  {previewLoading ? (
                     <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <p>Fetching real-time sample data...</p>
                     </div>
                  ) : previewGridData.length > 0 && previewGridData[0].error ? (
                     <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 font-mono text-sm max-w-2xl mx-auto mt-10">
                        <strong>Error:</strong> {previewGridData[0].error}
                     </div>
                  ) : previewGridData.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Database size={48} className="mb-4 opacity-50" />
                        <p>No records found in this model.</p>
                     </div>
                  ) : (
                     <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                           <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200">
                              <tr>
                                 {Object.keys(previewGridData[0]).map(k => (
                                    <th key={k} className="p-3 font-bold text-[10px] uppercase text-slate-500 tracking-wider">
                                       {k}
                                    </th>
                                 ))}
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 text-slate-700">
                              {previewGridData.map((row, i) => (
                                 <tr key={i} className="hover:bg-slate-50">
                                    {Object.values(row).map((val: any, j) => (
                                       <td key={j} className="p-3">
                                          {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                                       </td>
                                    ))}
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
