'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import type { TenantMember, UserRole } from '@/lib/types';
// import { useTranslation } from 'react-i18next';
const useTranslation = () => ({ t: (k: string, fall?: string) => fall || k });
import {
  FirmAdminDashboard,
  CIODashboard,
  RelationshipManagerDashboard,
  ControllerDashboard,
  ComplianceOfficerDashboard,
  ReportViewerDashboard
} from './HubDashboards';

const ROLE_LABELS: Record<string, string> = {
  firm_admin: 'Firm Admin',
  cio: 'Chief Investment Officer',
  relationship_manager: 'Relationship Manager',
  controller: 'Controller',
  compliance_officer: 'Compliance',
  report_viewer: 'Reports',
  // Map platform roles to equivalent tenant roles if lacking
  tenant_admin: 'Firm Admin',
};

const ROLE_WIDGETS: Record<string, React.FC> = {
  firm_admin: FirmAdminDashboard,
  cio: CIODashboard,
  relationship_manager: RelationshipManagerDashboard,
  controller: ControllerDashboard,
  compliance_officer: ComplianceOfficerDashboard,
  report_viewer: ReportViewerDashboard,
  tenant_admin: FirmAdminDashboard,
};

export default function DashboardHub({ user, platformRole }: { user: any; platformRole: string }) {
  const { tenant } = useAuth();
  const db = getFirestore(firebaseApp);
  const [member, setMember] = useState<TenantMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');
  const { t } = useTranslation();

  useEffect(() => {
    if (tenant?.id && user?.uid) {
      getDoc(doc(db, 'tenants', tenant.id, 'members', user.uid))
        .then(snap => {
          if (snap.exists()) {
            setMember(snap.data() as TenantMember);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [tenant?.id, user?.uid, db]);

  if (loading) {
     return <div className="p-8 text-center text-sm text-secondary animate-pulse">Loading Workspace...</div>;
  }

  // 1. Gather all authorized roles
  // We combine the primary role from AuthContext (platformRole) and additionalRoles from TenantMember
  const memberPrimary = member?.role;
  const additional = member?.additionalRoles || [];
  
  // Clean up roles to form the final pool
  let rawRoles = [platformRole, memberPrimary, ...additional].filter(Boolean) as string[];
  
  if (rawRoles.includes('tenant_admin') || rawRoles.includes('saas_master_admin')) {
    const allWidgets = ['tenant_admin', 'cio', 'relationship_manager', 'controller', 'compliance_officer', 'report_viewer'];
    rawRoles = Array.from(new Set([...rawRoles, ...allWidgets]));
  }

  let uniqueRoles = Array.from(new Set(rawRoles)).filter(r => ROLE_WIDGETS[r]);
  // Deduplicate firm_admin if tenant_admin is already present
  if (uniqueRoles.includes('tenant_admin')) {
    uniqueRoles = uniqueRoles.filter(r => r !== 'firm_admin');
  }

  if (uniqueRoles.length === 0) {
     // User has no valid widgets mapped for their roles, add a fallback
     uniqueRoles.push('report_viewer');
  }

  // 2. Apply personalization
  const prefs = member?.dashboardPreferences || [];
  
  let allowedTabs = uniqueRoles.filter(role => {
     const pref = prefs.find(p => p.roleId === role);
     if (pref && pref.visible === false) return false;
     return true;
  });

  if (allowedTabs.length === 0) allowedTabs = [uniqueRoles[0]]; // Fallback if they hide everything

  allowedTabs.sort((a, b) => {
     const prefA = prefs.find(p => p.roleId === a)?.order ?? 99;
     const prefB = prefs.find(p => p.roleId === b)?.order ?? 99;
     return prefA - prefB;
  });

  const currentTab = activeTab && allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0];
  const ActiveWidget = ROLE_WIDGETS[currentTab] || ReportViewerDashboard;

  const handleTabChange = (role: string) => setActiveTab(role);

  return (
    <div className="page-wrapper animate-fade-in mx-auto w-full px-4 lg:px-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end w-full justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">{t('Command Center', 'Command Center')}</h1>
          <p className="text-secondary text-sm mt-1">{t('Your personalized operational hubs', 'Your personalized operational hubs')}</p>
        </div>
      </div>
      
      {allowedTabs.length > 1 && (
        <div className="flex border-b border-[var(--border)] overflow-x-auto no-scrollbar gap-6 mt-4">
          {allowedTabs.map(role => {
             const label = t(ROLE_LABELS[role] ?? role, ROLE_LABELS[role] ?? role);
             const isActive = activeTab === role || currentTab === role;
             return (
               <button
                 key={role}
                 onClick={() => handleTabChange(role)}
                 className={`pb-3 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${isActive ? 'border-brand-500 text-brand-600' : 'border-transparent text-secondary hover:text-primary hover:border-border'}`}
               >
                 {label}
               </button>
             );
          })}
        </div>
      )}
      
      {/* 3. Render Active Widget */}
      <div className="pt-4">
         <ActiveWidget />
      </div>
    </div>
  );
}
