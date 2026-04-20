'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePageTitle } from '@/lib/PageTitleContext';
import { collection, doc, onSnapshot, setDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StatementTrackerGrid, PeriodData, Bank, Client } from '@/components/StatementTrackerGrid';
import { StatementCellDrawer } from '@/components/StatementCellDrawer';
import { toast } from 'sonner';

export default function StatementTrackerPage() {
  const { setTitle } = usePageTitle();
  const { tenant } = useAuth();
  
  // Dynamic Data
  const [banksList, setBanksList] = useState<Bank[]>([]);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [cyclesData, setCyclesData] = useState<any[]>([]); // Array of cycles from Firestore
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<{ clientId: string, bankId: string } | null>(null);

  useEffect(() => {
    setTitle('Statement Tracker');
  }, [setTitle]);

  // Combined listener for Entities and Statement Cycles
  useEffect(() => {
    if (!tenant?.id) return;

    // 1. Fetch Entities (Banks and Clients)
    const qOrgs = query(collection(db, 'tenants', tenant.id, 'organizations'));
    const unsubOrgs = onSnapshot(qOrgs, snap => {
       const orgs = snap.docs.map(d => ({id: d.id, ...d.data() as any}));
       const fetchedBanks = orgs
          .filter(o => o.type === 'financial_institution')
          .map(o => ({
             id: o.id,
             name: o.name,
             region: o.jurisdictionClass === 'onshore' ? 'Onshore' : 'Offshore',
             logoUrl: `https://www.google.com/s2/favicons?domain=${o.name.split(' ')[0].toLowerCase()}.com&sz=128`,
             fetchMethod: 'email',
             arrivalDay: 10
          })) as Bank[];
       
       const fetchedClients = orgs
          .filter(o => o.type === 'family_group')
          .map(o => ({
             id: o.id,
             name: o.name,
             priority: o.serviceTier === 'select' ? 'high' : o.serviceTier === 'premium' ? 'medium' : 'low',
             freq: 'MON',
             todos: true
          })) as Client[];
          
       setBanksList(fetchedBanks);
       setClientsList(fetchedClients);
    });

    // 2. Fetch Statement Cycles
    const qCycles = query(collection(db, 'tenants', tenant.id, 'statementCycles'), orderBy('period', 'desc'));
    const unsubCycles = onSnapshot(qCycles, snap => {
       // if snap is empty, create a default cycle
       if (snap.empty) {
          const now = new Date();
          const monthStr = String(now.getMonth() + 1).padStart(2, '0');
          handleCreatePeriod(now.getFullYear().toString(), monthStr);
       } else {
          const cycles = snap.docs.map(d => ({id: d.id, ...d.data()}));
          setCyclesData(cycles);
          if (cycles.length > 0) {
             // Retain the active period if it exists, otherwise default to the latest
             setActivePeriodId(prev => prev ? prev : cycles[0].id);
          }
       }
       setLoading(false);
    });

    return () => { unsubOrgs(); unsubCycles(); };
  }, [tenant?.id]);

  const handleDataChange = (newData: PeriodData) => {
     // Local optimistic
     setCyclesData(prev => prev.map(p => p.id === newData.id ? { ...p, matrix: newData.matrix } : p));
  };

  const handleSave = async () => {
    if (!tenant?.id || !activePeriodId) return;
    const currentData = cyclesData.find(c => c.id === activePeriodId);
    if (!currentData) return;

    try {
      await setDoc(doc(db, 'tenants', tenant.id, 'statementCycles', activePeriodId), {
         period: currentData.period,
         periodName: currentData.periodName,
         quarter: currentData.quarter,
         matrix: currentData.matrix
      }, { merge: true });
    } catch(err) {
      console.error(err);
      toast.error('Failed to save matrix');
    }
  };

  const handleCreatePeriod = async (year: string, month: string) => {
    if (!tenant?.id) return;
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthIndex = parseInt(month, 10) - 1;
    const q = Math.floor(monthIndex / 3) + 1;
    
    const newId = `${year}-${month}`;
    const brandNew = {
      period: `${year}-${month}`,
      periodName: `${monthNames[monthIndex]} ${year}`,
      quarter: `Q${q}`,
      matrix: {}
    };

    try {
      await setDoc(doc(db, 'tenants', tenant.id, 'statementCycles', newId), brandNew);
      setActivePeriodId(newId);
    } catch(err) {
        console.error(err);
    }
  };

  const handleCellClick = (clientId: string, bankId: string) => {
     setActiveCell({ clientId, bankId });
     setDrawerOpen(true);
  };

  const handleDrawerStatusChange = (status: 'ok' | 'x' | null) => {
     if (!activeCell || !activePeriodId) return;
     const currentData = cyclesData.find(c => c.id === activePeriodId);
     if (!currentData) return;

     const newMatrix = { ...currentData.matrix };
     if (!newMatrix[activeCell.clientId]) newMatrix[activeCell.clientId] = {};
     newMatrix[activeCell.clientId][activeCell.bankId] = status;

     handleDataChange({ ...currentData, matrix: newMatrix });
  };

  if (loading) return (
     <div className="flex h-full w-full items-center justify-center bg-[var(--bg-canvas)]">
       <span className="text-[var(--text-secondary)] font-medium animate-pulse">Loading Tracker Matrix...</span>
     </div>
  );

  // Re-assemble Active Period Data injecting the latest banks/clients configuration
  const rawActive = cyclesData.find(p => p.id === activePeriodId);
  if (!rawActive && cyclesData.length > 0) return null; // Protective return
  
  const activeData: PeriodData = {
     id: activePeriodId || '',
     period: rawActive?.period || '',
     periodName: rawActive?.periodName || '',
     quarter: rawActive?.quarter || '',
     banks: banksList,
     clients: clientsList,
     matrix: rawActive?.matrix || {}
  };

  // Build periods list for the Dropdown (injecting empty Banks/Clients to satisfy type, since they are only used for label)
  const periodsFormatted = cyclesData.map(c => ({
      ...c, banks: [], clients: []
  })) as PeriodData[];

  // Drawer Content Details
  let drawerClientName = '';
  let drawerBankName = '';
  let drawerStatus: 'ok' | 'x' | null = null;
  if (activeCell) {
     drawerClientName = clientsList.find(c => c.id === activeCell.clientId)?.name || 'Unknown Client';
     drawerBankName = banksList.find(b => b.id === activeCell.bankId)?.name || 'Unknown Bank';
     drawerStatus = activeData.matrix?.[activeCell.clientId]?.[activeCell.bankId] || null;
  }

  return (
    <div className="h-full w-full p-2 bg-[var(--bg-canvas)] overflow-hidden">
      <StatementTrackerGrid 
         data={activeData} 
         periods={periodsFormatted}
         onChange={handleDataChange} 
         onSave={handleSave}
         onPeriodSelect={setActivePeriodId}
         onCreatePeriod={handleCreatePeriod}
         onCellClick={handleCellClick}
      />

      {activeCell && (
        <StatementCellDrawer
           open={drawerOpen}
           onOpenChange={setDrawerOpen}
           periodName={activeData.periodName}
           clientName={drawerClientName}
           bankName={drawerBankName}
           entityId={`${activePeriodId}_${activeCell.clientId}_${activeCell.bankId}`}
           currentStatus={drawerStatus}
           onStatusChange={handleDrawerStatusChange}
        />
      )}
    </div>
  );
}
