'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getServiceTeams, type ServiceTeam, TEAM_ROLE_LABELS } from '@/lib/serviceTeamService';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

function Avatar({ name, size = 34, color }: { name: string; size?: number; color?: string }) {
  const hue = color ? 0 : name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: color ?? `hsl(${hue},55%,45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

export function RelationshipManagerSelector({
  value, // relationshipManagerId (uid)
  familyId,
  teamId,
  onChange,
  readOnly = false,
}: {
  value: string;
  familyId: string;
  teamId?: string;
  onChange?: (uid: string) => void;
  readOnly?: boolean;
}) {
  const { tenant } = useAuth();
  const [teams, setTeams] = useState<ServiceTeam[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tenant?.id) {
      getServiceTeams(tenant.id).then(setTeams).catch(console.error);
    }
  }, [tenant?.id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTeam = teams.find(t => t.id === teamId);
  const activeMember = activeTeam?.members?.find(m => m.uid === value);

  async function handleSelect(uid: string) {
    setOpen(false);
    if (uid === value || readOnly) return;
    setSaving(true);
    try {
      if (tenant?.id) {
        const db = getFirestore();
        await updateDoc(doc(db, 'tenants', tenant.id, 'organizations', familyId), {
          relationshipManagerId: uid === '' ? null : uid
        });
        if (onChange) onChange(uid);
      }
    } catch (error) {
      console.error("Error updating Relationship Manager:", error);
      toast.error('Failed to update Relationship Manager.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative flex flex-col gap-2" ref={ref} style={{ minWidth: 260 }}>
      <div 
        onClick={() => !readOnly && !saving && activeTeam && setOpen(!open)}
        className={`flex items-center justify-between px-3 py-1.5 rounded-lg border ${open ? 'border-[var(--brand-primary)] bg-[var(--brand-faint)]' : 'border-[var(--border)]'} bg-[var(--bg-canvas)] transition-all ${!readOnly && !saving && activeTeam ? 'cursor-pointer hover:border-[#cbd5e1]' : 'opacity-80'}`}
      >
        <div className="flex items-center gap-2">
           {!teamId ? (
             <span className="text-[12px] font-bold text-slate-400 italic">Select a Coverage Team first</span>
           ) : !activeMember ? (
             <span className="text-[12px] font-bold text-slate-400">Unassigned RM</span>
           ) : (
             <>
               <Avatar name={activeMember.name} size={20} />
               <span className="text-[13px] font-bold text-[var(--text-primary)]">{activeMember.name}</span>
             </>
           )}
        </div>
        
        <div className="flex items-center gap-2">
           {saving && <span className="animate-spin text-[10px]">⏳</span>}
           {!readOnly && !saving && activeTeam && (
             <span className="text-[var(--text-tertiary)] text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">Change</span>
           )}
        </div>
      </div>

      {open && activeTeam && (
        <div className="absolute top-[34px] left-0 mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in" style={{ transformOrigin: 'top left', zIndex: 100 }}>
          <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Select RM from {activeTeam.name}</div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <div 
              onClick={() => handleSelect('')}
              className={`p-3 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--bg-canvas)] transition-colors ${!value ? 'bg-[var(--brand-faint)]' : ''}`}
            >
              <div className="font-bold text-[13px] text-slate-500 italic">Unassigned RM</div>
            </div>

            {(!activeTeam.members || activeTeam.members.length === 0) ? (
              <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">No members in this team.</div>
            ) : (
              activeTeam.members.map(m => (
                <div 
                  key={m.uid} 
                  onClick={() => handleSelect(m.uid)}
                  className={`p-3 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--bg-canvas)] transition-colors ${m.uid === value ? 'bg-[var(--brand-faint)]' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar name={m.name} size={20} />
                    <div className="flex-1">
                      <div className="font-bold text-[13px] text-[var(--text-primary)]">{m.name}</div>
                      <div className="text-[10px] text-slate-500">{TEAM_ROLE_LABELS[m.role] || m.role}</div>
                    </div>
                    {m.uid === value && <span className="text-[10px] bg-[var(--brand-primary)] text-white px-1.5 py-0.5 rounded font-bold">Active</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
