'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getServiceTeams, type ServiceTeam, TEAM_ROLE_LABELS } from '@/lib/serviceTeamService';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

function Avatar({ name, size = 34, color }: { name: string; size?: number; color?: string }) {
  const hue = color ? 0 : name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: color ?? `hsl(${hue},55%,45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function getRoleIcon(role: string) {
  switch (role?.toLowerCase()) {
    case 'lead_advisor': return '👑';
    case 'wealth_manager': return '📈';
    case 'relationship_manager': return '🤝';
    case 'analyst': return '🔍';
    case 'specialist': return '🎯';
    case 'assistant': return '📝';
    case 'operations': return '⚙️';
    case 'compliance': return '🛡️';
    default: return '👤';
  }
}

export function ServiceTeamSelector({
  value, // the serviceTeamId
  familyId,
  onChange,
  readOnly = false,
}: {
  value: string;
  familyId: string;
  onChange?: (teamId: string) => void;
  readOnly?: boolean;
}) {
  const { tenant } = useAuth();
  const [teams, setTeams] = useState<ServiceTeam[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  const activeTeam = teams.find(t => t.id === value);

  async function handleSelect(teamId: string) {
    setOpen(false);
    if (teamId === value || readOnly) return;
    setSaving(true);
    try {
      if (tenant?.id) {
        // Family Groups are stored in organizations
        const db = getFirestore();
        await updateDoc(doc(db, 'tenants', tenant.id, 'organizations', familyId), {
          serviceTeamId: teamId === '' ? null : teamId
        });
        if (onChange) onChange(teamId);
      }
    } catch (error) {
      console.error("Error updating Service Team:", error);
      toast.error('Failed to update Service Team.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative flex flex-col gap-2" ref={ref} style={{ minWidth: 260 }}>
      {/* Part 1: Selector Control */}
      <div 
        onClick={() => !readOnly && !saving && setOpen(!open)}
        className={`flex items-center justify-between px-3 py-1.5 rounded-lg border ${open ? 'border-[var(--brand-primary)] bg-[var(--brand-faint)]' : 'border-[var(--border)]'} bg-[var(--bg-canvas)] transition-all ${!readOnly && !saving ? 'cursor-pointer hover:border-[#cbd5e1]' : 'opacity-80'}`}
      >
        <div className="flex items-center gap-2">
           {!activeTeam ? (
             <span className="text-[12px] font-bold text-slate-400">Unassigned</span>
           ) : (
             <>
               <span className="text-[14px] leading-none mb-0.5" title="Coverage Team">🤝</span>
               <span className="text-[13px] font-bold text-[var(--text-primary)]">{activeTeam.name}</span>
             </>
           )}
        </div>
        
        <div className="flex items-center gap-2">
           {saving && <span className="animate-spin text-[10px]">⏳</span>}
           {!readOnly && !saving && (
             <span className="text-[var(--text-tertiary)] text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">Change</span>
           )}
        </div>
      </div>

      {/* Part 2: Dropdown Menu (Only Lists Teams) */}
      {open && (
        <div className="absolute top-[34px] left-0 mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in" style={{ transformOrigin: 'top left' }}>
          <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Select Coverage Team</div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {/* Added Unassigned Option */}
            <div 
              onClick={() => handleSelect('')}
              className={`p-3 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--bg-canvas)] transition-colors ${!value ? 'bg-[var(--brand-faint)]' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-[13px] text-slate-500 italic">Unassigned (None)</div>
                {!value && <span className="text-[10px] bg-slate-400 text-white px-2 py-0.5 rounded font-bold">Active</span>}
              </div>
              <div className="text-[11px] text-[var(--text-tertiary)]">Remove current team assignment from this family.</div>
            </div>

            {teams.length === 0 ? (
              <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">No service teams configured. Create one in Settings.</div>
            ) : (
              teams.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => handleSelect(t.id)}
                  className={`p-3 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--bg-canvas)] transition-colors ${t.id === value ? 'bg-[var(--brand-faint)]' : ''}`}
                >
                  <div className="flex justify-between items-center relative group/team">
                    <div 
                      className="font-bold text-[13px] text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer"
                    >
                      {t.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-400">{t.members?.length || 0} mem</span>
                      {t.id === value && <span className="text-[10px] bg-[var(--brand-primary)] text-white px-1.5 py-0.5 rounded font-bold">Active</span>}
                    </div>
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
