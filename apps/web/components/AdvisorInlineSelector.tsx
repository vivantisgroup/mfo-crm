'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Advisor {
  id: string;
  name: string;
  email: string;
  tenantMemberUid: string;
  employeeId?: string;
}

interface AdvisorInlineSelectorProps {
  tenantId: string;
  familyId: string;
  currentAdvisorId?: string;
  currentAdvisorName?: string;
  onUpdate?: (newId: string, newName: string) => void;
}

export function AdvisorInlineSelector({ tenantId, familyId, currentAdvisorId, currentAdvisorName, onUpdate }: AdvisorInlineSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch advisors when opened
  useEffect(() => {
    if (!isOpen || advisors.length > 0) return;
    
    setLoading(true);
    getDocs(collection(db, 'tenants', tenantId, 'advisors'))
      .then(snap => {
        const advList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Advisor));
        setAdvisors(advList);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch advisors:', err);
        setLoading(false);
      });
  }, [isOpen, tenantId, advisors.length]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredAdvisors = advisors.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = async (advisor: Advisor) => {
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'organizations', familyId), {
        assignedRmId: advisor.id,
        assignedRmName: advisor.name
      });
      onUpdate?.(advisor.id, advisor.name);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to update relationship manager:', err);
      toast.error('Failed to update Relationship Manager.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className="flex items-center gap-2 px-3 py-1.5 rounded-tremor-small border border-tremor-border bg-tremor-background hover:bg-tremor-background-muted transition-colors text-sm"
      >
        <span className="font-medium text-tremor-content-strong truncate max-w-[150px]">
          {isUpdating ? 'Saving...' : (currentAdvisorName || 'Unassigned')}
        </span>
        <ChevronDown size={14} className="text-tremor-content" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-tremor-border rounded-tremor-default shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-tremor-border">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Search advisors..." 
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px' }}
                className="w-full pr-3 py-1.5 text-sm rounded-tremor-small border border-tremor-border focus:ring-2 focus:ring-tremor-brand focus:border-transparent outline-none"
              />
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto p-1">
            {loading ? (
              <div className="p-3 text-center text-sm text-tremor-content flex items-center justify-center gap-2">
                 <div className="w-4 h-4 rounded-full border-2 border-tremor-brand border-t-transparent animate-spin"/> Loading...
              </div>
            ) : filteredAdvisors.length === 0 ? (
              <div className="p-3 text-center text-sm text-tremor-content">No advisors found</div>
            ) : (
              filteredAdvisors.map(adv => (
                <button
                  key={adv.id}
                  onClick={() => handleSelect(adv)}
                  className="w-full text-left px-3 py-2 text-sm rounded-tremor-small hover:bg-slate-50 flex items-center justify-between group"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-tremor-content-strong truncate">{adv.name}</div>
                  </div>
                  {currentAdvisorId === adv.id && <Check size={14} className="text-tremor-brand flex-shrink-0 ml-2" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
