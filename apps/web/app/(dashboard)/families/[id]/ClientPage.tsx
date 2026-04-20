'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BALANCE_SHEETS } from '@/lib/mockData';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, getInitials, getRiskColor, formatDate } from '@/lib/utils';
import { AssetAllocationChart } from '@/components/AssetAllocationChart';
import { ContactRelationshipGraph } from '@/components/ContactRelationshipGraph';
import { SuitabilityAssessment } from '@/components/SuitabilityAssessment';
import { InvestmentAdvisory } from '@/components/InvestmentAdvisory';
import { CommunicationPanel } from '@/components/CommunicationPanel';
import { SecondaryDock } from '@/components/SecondaryDock';
import { usePageTitle } from '@/lib/PageTitleContext';
import { uploadAttachment } from '@/lib/attachmentService';
import { updateDoc, collection, query, where, orderBy, limit, getDocs, arrayUnion, setDoc, serverTimestamp } from 'firebase/firestore';
import { ProfileBanner } from '@/components/ProfileBanner';
import { StorageExplorer } from '../../documents/components/StorageExplorer';
import { FamilyProfitabilityTab } from '@/components/FamilyProfitabilityTab';
import { FamilyLgpdTab } from '@/components/FamilyLgpdTab';
import { ServiceTeamSelector } from '../../../../components/ServiceTeamSelector';
import { RelationshipManagerSelector } from '../../../../components/RelationshipManagerSelector';
import { GovernanceTab } from './GovernanceTab';
import Link from 'next/link';
import { FamilySuccessionTab } from '@/components/FamilySuccessionTab';
import { InvoicingTab } from './InvoicingTab';
import { WealthPolicyTab } from '../components/WealthPolicyTab';
import { toast } from 'sonner';

function InlineSearchSelector({ 
  tenantId, 
  familyId, 
  type, 
  onClose,
  onLinked 
}: { 
  tenantId: string; 
  familyId: string; 
  type: 'contact' | 'organization'; 
  onClose: () => void;
  onLinked?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    
    const searchStr = search.trim();
    const capitalized = searchStr.charAt(0).toUpperCase() + searchStr.slice(1);
    const field = type === 'contact' ? 'firstName' : 'name';
    const coll = collection(db, 'tenants', tenantId, type === 'contact' ? 'contacts' : 'organizations');

    const qLower = query(
      coll,
      where(field, '>=', searchStr),
      where(field, '<=', searchStr + '\uf8ff'),
      limit(20)
    );
    
    const qUpper = query(
      coll,
      where(field, '>=', capitalized),
      where(field, '<=', capitalized + '\uf8ff'),
      limit(20)
    );

    setLoading(true);
    Promise.all([getDocs(qLower), getDocs(qUpper)]).then(([snap1, snap2]) => {
      const merged = [...snap1.docs, ...snap2.docs];
      const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
      let parsed = unique.map((d: any) => ({id: d.id, ...d.data()}));
      
      // Do not allow assigning another Family Group as a corporate entity
      if (type === 'organization') {
        parsed = parsed.filter(r => r.type !== 'family' && r.isFamily !== true && r.id !== familyId);
      }
      
      setResults(parsed.slice(0, 10)); // Limit visual results to 10
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [search, tenantId, type, familyId]);

  const handleSelect = async (selected: any) => {
    try {
      if (type === 'contact') {
        await updateDoc(doc(db, 'tenants', tenantId, 'contacts', selected.id), {
          linkedFamilyIds: arrayUnion(familyId)
        });
      } else {
        await updateDoc(doc(db, 'tenants', tenantId, 'organizations', selected.id), {
          parentFamilyId: familyId
        });
      }
      onLinked?.();
      onClose();
    } catch (err) {
      toast.error('Failed to link');
    }
  };

  return (
    <div className="p-3 border-b border-tremor-border bg-indigo-50/30">
      <div className="relative">
        <input 
          autoFocus 
          type="text" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder={`Search ${type} by name...`}
          className="w-full text-sm px-3 py-2 border border-indigo-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow bg-white"
        />
        {loading && <div className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">...</div>}
        {search.trim().length > 0 && !loading && results.length === 0 && (
           <div className="absolute top-10 w-full left-0 bg-white border border-slate-200 shadow-xl rounded-md overflow-hidden z-20 p-4 text-center text-sm text-slate-500">
             No {type}s found matching "{search}"
           </div>
        )}
        {results.length > 0 && (
          <div className="absolute top-10 w-full left-0 bg-white border border-slate-200 shadow-xl rounded-md overflow-hidden z-20 max-h-60 overflow-y-auto">
            {results.map(r => (
               <div key={r.id} onClick={() => handleSelect(r)} className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b last:border-b-0 text-sm">
                 <div className="font-semibold text-slate-800">{type === 'contact' ? `${r.firstName} ${r.lastName || ''}` : r.name}</div>
                 <div className="text-xs text-slate-500">{type === 'contact' ? r.email : r.jurisdiction || 'Entity'}</div>
               </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end mt-2">
        <button className="text-xs font-semibold text-slate-500 hover:text-slate-700" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

export default function FamilyDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const familyId = params.id as string;
  const bs       = BALANCE_SHEETS.find(b => b.familyId === familyId);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [subTabWealth, setSubTabWealth] = useState('entities');
  const [tenantId, setTenantId]   = useState('');
  const [family, setFamily] = useState<any>(null);
  
  // Custom states for local UI updates
  const [localRmId, setLocalRmId] = useState<string | undefined>();
  const [localRmName, setLocalRmName] = useState<string | undefined>();
  
  const [contacts, setContacts] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [linkingOrg, setLinkingOrg] = useState(false);
  const [linkingContact, setLinkingContact] = useState(false);
  const [portfolioConfig, setPortfolioConfig] = useState<any>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id) setTenantId(t.id);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!tenantId || !familyId) return;
    
    // 1. Family Core Fetch
    const unsubFamily = onSnapshot(doc(db, 'tenants', tenantId, 'organizations', familyId), snap => {
      if(snap.exists()) setFamily({ id: snap.id, ...snap.data() });
      setLoading(false);
    });

    // 2. Contacts Fetch
    const qContacts = query(collection(db, 'tenants', tenantId, 'contacts'), where('linkedFamilyIds', 'array-contains', familyId));
    const unsubContacts = onSnapshot(qContacts, snap => {
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Organizations (Entities) Fetch
    const qOrgs = query(collection(db, 'tenants', tenantId, 'organizations'), where('parentFamilyId', '==', familyId));
    const unsubOrgs = onSnapshot(qOrgs, snap => {
      setOrganizations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 4. Tasks Fetch
    const qTasks = query(collection(db, 'tenants', tenantId, 'tasks'), where('familyId', '==', familyId), orderBy('createdAt', 'desc'), limit(50));
    const unsubTasks = onSnapshot(qTasks, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 5. Portfolio Fetch
    const unsubPortfolio = onSnapshot(doc(db, 'tenants', tenantId, 'portfolios', familyId), snap => {
      if(snap.exists()) setPortfolioConfig({ id: snap.id, ...snap.data() });
      else setPortfolioConfig(false);
      setLoadingPortfolio(false);
    });

    return () => {
      unsubFamily();
      unsubContacts();
      unsubOrgs();
      unsubTasks();
      unsubPortfolio();
    };
  }, [tenantId, familyId]);

  const { setTitle, setCrumbOverrides } = usePageTitle();
  useEffect(() => {
    if (family && setCrumbOverrides) {
      setTitle('Family Profile');
      setCrumbOverrides({ [familyId]: family.name });
    }
  }, [family, familyId, setTitle, setCrumbOverrides]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading Family Group...</div>;
  }

  if (!family) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Family Group Not Found</div>
        <button className="btn btn-secondary mt-4" onClick={() => router.push('/families')}>← Back to Families</button>
      </div>
    );
  }

  const handleAvatarUpload = async (file: File) => {
    if (!tenantId || !familyId) return;
    const { url } = await uploadAttachment(tenantId, file);
    await updateDoc(doc(db, 'tenants', tenantId, 'organizations', familyId), { avatarUrl: url });
  };

  const handleBannerUpload = async (file: File) => {
    if (!tenantId || !familyId) return;
    const { url } = await uploadAttachment(tenantId, file);
    await updateDoc(doc(db, 'tenants', tenantId, 'organizations', familyId), { bannerUrl: url });
  };

  return (
    <div className="page animate-fade-in" style={{ width: '100%', padding: '0 24px', paddingBottom: 60 }}>
      {/* LinkedIn-Style Entity Header */}
      <ProfileBanner 
        title={family.name}
        subtitle="Family Group"
        avatarUrl={family.avatarUrl || family.logoUrl}
        bannerUrl={family.bannerUrl}
        onAvatarUpload={handleAvatarUpload}
        onBannerUpload={handleBannerUpload}
      >
        <div className="flex items-center gap-8 pl-6 border-l border-[var(--border-subtle)]">
           <div>
             <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#94a3b8] mb-1.5 flex items-center justify-between">
                <span>Coverage Team</span>
             </div>
             <div style={{ minWidth: 240 }}>
               <ServiceTeamSelector
                 familyId={familyId}
                 value={family.serviceTeamId || ''}
               />
             </div>
           </div>

           <div>
             <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#94a3b8] mb-1.5 flex items-center justify-between">
                <span>Relationship Manager</span>
             </div>
             <div style={{ minWidth: 240 }}>
               <RelationshipManagerSelector
                 familyId={familyId}
                 teamId={family.serviceTeamId}
                 value={family.relationshipManagerId || ''}
               />
             </div>
           </div>

           <div>
             <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#94a3b8] mb-1.5 flex items-center justify-between">
                <span>Compliance</span>
             </div>
             <div className="flex items-center gap-2">
               <Link href={`/compliance?familyId=${familyId}`} title={`KYC Status: ${family.kycStatus || 'Pending'}\nClick to view Compliance Dockets`} className="hover:opacity-80 transition-opacity">
                 <StatusBadge status={family.kycStatus || 'pending'} label={`KYC`} />
               </Link>
               <Link href={`/compliance?familyId=${familyId}`} title={`AML Status: ${family.amlStatus || 'Pending'}\nClick to view Compliance Dockets`} className="hover:opacity-80 transition-opacity">
                 <StatusBadge status={family.amlStatus || 'pending'} label={`AML`} />
               </Link>
             </div>
           </div>

           <div>
             <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#94a3b8] mb-1.5 flex items-center justify-between">
                <span>Activity</span>
             </div>
             <div className="text-[13px] font-semibold text-[var(--text-secondary)] whitespace-nowrap bg-[var(--bg-canvas)] px-3 py-1.5 rounded-md border border-[var(--border-subtle)]">
               {family.lastActivityAt ? formatDate(family.lastActivityAt) : 'No recent'}
             </div>
           </div>
        </div>
      </ProfileBanner>


      <div style={{ marginBottom: 24, paddingBottom: 16 }}>
        <SecondaryDock 
          tabs={[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'members', label: 'Members & Stakeholders', icon: '👥' },
            { id: 'wealth', label: 'Wealth', icon: '🏛️' },
            { id: 'documents', label: 'Documents', icon: '📄' },
            { id: 'communications', label: 'Comms', icon: '💬' },
            { id: 'profitability', label: 'Profitability', icon: '💎' },
            { id: 'billing', label: 'Billing', icon: '💰' },
            { id: 'settings', label: 'Settings', icon: '⚙️' }
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <div style={{ marginTop: 24, flex: 1, minHeight: 0 }}>
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6 w-full">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="grid-2">
                <StatCard label="Total AUM" value={formatCurrency(family.aum || 0, family.currency || 'USD', true)} />
                <StatCard label="Risk Profile" value={(family.riskProfile || 'moderate').toUpperCase()} 
                  icon={<span style={{ color: getRiskColor(family.riskProfile || 'moderate') }}>●</span>} 
                />
              </div>
              <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6">
                <div className="card-header">
                  <h2 className="card-title">Allocation Overview</h2>
                </div>
                <div className="card-body">
                  {bs ? <AssetAllocationChart data={bs.allocation} /> : <div className="text-secondary">No allocation data</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="flex flex-col gap-6">
            <div className="grid md:grid-cols-2 gap-6">
            {/* Contacts/Members List only */}
            <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-tremor-border">
                <div className="font-bold text-sm">Family Members</div>
                <button className="text-xs text-indigo-600 font-medium hover:text-indigo-800" onClick={() => setLinkingContact(true)}>+ Add Member</button>
              </div>
              {linkingContact && (
                <InlineSearchSelector 
                  tenantId={tenantId}
                  familyId={familyId}
                  type="contact"
                  onClose={() => setLinkingContact(false)}
                />
              )}
              <div className="p-0 flex-1 overflow-y-auto">
                {contacts.length === 0 ? (
                  <div className="p-10 text-center text-slate-400">
                    <span className="text-3xl block mb-2">👥</span>
                    <div>No members linked to this family yet.</div>
                  </div>
                ) : contacts.map((c: any, i: number) => (
                  <div key={c.id || i} className="p-3 border-b border-tremor-border flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => router.push(`/relationships/contacts/${c.id}`)}>
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold overflow-hidden shadow-sm">
                      {c.avatarUrl ? <img src={c.avatarUrl} alt={c.firstName} className="w-full h-full object-cover" /> : getInitials(`${c.firstName || '?'} ${c.lastName || ''}`)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate text-slate-900">{c.firstName} {c.lastName}</div>
                      <div className="text-xs text-slate-500 truncate">{c.primaryRole || c.email || 'No role mapped'}</div>
                    </div>
                    {c.kycStatus && <StatusBadge status={c.kycStatus} />}
                  </div>
                ))}
              </div>
            </div>
          </div>

            {/* Unified Network View */}
            {tenantId ? (
              <div className="rounded-tremor-default border border-tremor-border bg-white shadow-tremor-card flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-tremor-border">
                  <div className="font-bold text-sm">Members Network</div>
                </div>
                <div style={{ height: 600, background: '#f8fafc' }}>
                  <ContactRelationshipGraph tenantId={tenantId} familyId={familyId} />
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading graph…</div>
            )}
          </div>
        )}

        {activeTab === 'wealth' && (
          <div className="flex flex-col gap-6 w-full">
            <SecondaryDock 
              tabs={[
                { id: 'entities', label: 'Structuring', icon: '🏛️' },
                { id: 'ips', label: 'IPS', icon: '⚖️' },
                { id: 'succession', label: 'Succession', icon: '⚖️' },
                { id: 'governance', label: 'Governance', icon: '🏛️' },
                { id: 'tax', label: 'Tax & Fiscal', icon: '🧾' },
                { id: 'insurance', label: 'Insurance & Risk', icon: '🛡️' },
                { id: 'philanthropy', label: 'Philanthropy', icon: '🕊️' }
              ]}
              activeTab={subTabWealth}
              onTabChange={setSubTabWealth}
            />
            {subTabWealth === 'entities' && (
              <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-tremor-border">
                  <div>
                    <div className="font-bold text-lg text-slate-800">Wealth Structuring</div>
                    <div className="text-sm text-slate-500">Corporate entities, offshores, PICs and trusts belonging to the family group.</div>
                  </div>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700" onClick={() => setLinkingOrg(true)}>+ Add Entity</button>
                </div>
                
                {linkingOrg && (
                  <div className="p-4 bg-slate-50 border-b border-tremor-border">
                    <InlineSearchSelector 
                      tenantId={tenantId}
                      familyId={familyId}
                      type="organization"
                      onClose={() => setLinkingOrg(false)}
                    />
                  </div>
                )}
                
                <div className="p-0 flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                        <th className="p-4 font-semibold">Entity Name</th>
                        <th className="p-4 font-semibold">Jurisdiction</th>
                        <th className="p-4 font-semibold">Type</th>
                        <th className="p-4 font-semibold">Status</th>
                        <th className="p-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {organizations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-10 text-center text-slate-400">
                            <span className="text-3xl block mb-2">🏢</span>
                            <div>No corporate entities linked yet.</div>
                          </td>
                        </tr>
                      ) : organizations.map((o: any, i: number) => (
                        <tr key={o.id || i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="p-4 cursor-pointer" onClick={() => router.push(`/relationships/organizations/${o.id}`)}>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold overflow-hidden shadow-sm">
                                {o.avatarUrl ? <img src={o.avatarUrl} alt={o.name} className="w-full h-full object-cover" /> : getInitials(o.name || '?')}
                              </div>
                              <div className="font-semibold text-sm text-indigo-900 hover:underline">{o.name}</div>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-600 font-medium">
                             <div className="flex items-center gap-2">
                                {o.jurisdiction === 'BVI' ? '🇻🇬' : o.jurisdiction === 'Cayman' ? '🇰🇾' : o.jurisdiction === 'Brazil' ? '🇧🇷' : '🌎'}
                                {o.jurisdiction || 'N/A'}
                             </div>
                          </td>
                          <td className="p-4 text-sm text-slate-600">
                             <span className="px-2 py-1 bg-slate-100 rounded-md text-xs font-semibold">{o.type?.replace('_', ' ') || 'Corporate'}</span>
                          </td>
                          <td className="p-4 text-sm">
                            <StatusBadge status={o.status || 'active'} />
                          </td>
                          <td className="p-4 text-right">
                            <button className="text-slate-400 hover:text-indigo-600 transition-colors p-2 text-sm font-semibold">View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {subTabWealth === 'ips' && (
              <WealthPolicyTab tenantId={tenantId} familyId={familyId} />
            )}
            {subTabWealth === 'succession' && (
              <div className="py-2">
                <FamilySuccessionTab tenantId={tenantId} familyId={familyId} />
              </div>
            )}
            {subTabWealth === 'governance' && (
              <GovernanceTab family={family} />
            )}
            {subTabWealth === 'tax' && (
              <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: '400px' }}>
                <span className="text-4xl block mb-4">🧾</span>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Tax & Fiscal Planning</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                  Manage the family's tax residency, fiscal structures, optimization strategies, and historical tax returns.
                </p>
                <div className="flex gap-4">
                   <button className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">Add Tax Event</button>
                   <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-200">View Documents</button>
                </div>
              </div>
            )}
            {subTabWealth === 'insurance' && (
              <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: '400px' }}>
                <span className="text-4xl block mb-4">🛡️</span>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Insurance & Risk Management</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                  Track life insurance policies, property/casualty coverage, health plans, and overall risk mitigation strategies.
                </p>
                <div className="flex gap-4">
                   <button className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">Add Policy</button>
                </div>
              </div>
            )}
            {subTabWealth === 'philanthropy' && (
              <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: '400px' }}>
                <span className="text-4xl block mb-4">🕊️</span>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Philanthropy & Endowment</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                  Govern charitable givings, foundations, endowments, and the family's social impact projects.
                </p>
                <div className="flex gap-4">
                   <button className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">Add Philanthropic Project</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'suitability' && (
          <SuitabilityAssessment 
            familyId={familyId} 
          />
        )}

        {activeTab === 'billing' && (
          <div className="py-2">
             <InvoicingTab tenantId={tenantId} familyId={familyId} />
          </div>
        )}

        {activeTab === 'advisory' && (
          <InvestmentAdvisory 
            family={{...family, totalAum: family.aum}} 
            balanceSheet={bs}
          />
        )}

        {activeTab === 'profitability' && (
          <FamilyProfitabilityTab 
             tenantId={tenantId}
             familyId={familyId}
             aum={family.totalAum || family.estAumUsd || family.aum || 50000000} 
          />
        )}
        

        
        {activeTab === 'compliance' && (
          <div className="py-2">
             <FamilyLgpdTab tenantId={tenantId} familyId={familyId} />
          </div>
        )}

        {activeTab === 'documents' && (
          <div style={{ height: 'calc(100vh - 12rem)', overflow: 'hidden', margin: '-24px' }}>
            <StorageExplorer tenantId={tenantId} embedded contextFamilyId={familyId} />
          </div>
        )}

        {activeTab === 'communications' && (
          <div style={{ height: 600 }}>
            <CommunicationPanel
              familyId={family.id}
              familyName={family.name}
              relatedIds={[...contacts.map(c => c.id), ...organizations.map(o => o.id)]}
            />
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-0" style={{ overflow: 'hidden' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--border)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="card-title m-0">Family Tickets & Tasks</h2>
                <button className="btn btn-primary btn-sm" onClick={() => router.push('/tasks')}>New Ticket</button>
              </div>
            </div>
            {tasks.length === 0 ? (
               <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🎫</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>No tasks found for this family.</div>
               </div>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 {tasks.map(t => (
                   <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 16, borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => router.push(`/tasks?task=${t.id}`)}>
                     <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                       <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{t.title}</div>
                       <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                         <span>{t.priority?.toUpperCase()} Priority</span>
                         {t.dueDate && <span>· Due: {formatDate(t.dueDate)}</span>}
                         {t.assignedUserName && <span>· Assigned: {t.assignedUserName}</span>}
                       </div>
                     </div>
                     <StatusBadge status={t.status || 'open'} label={t.status || 'open'} />
                   </div>
                 ))}
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
