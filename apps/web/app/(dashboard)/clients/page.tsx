'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, getInitials, getTierBadgeColor, getRiskColor } from '@/lib/utils';
import { FAMILIES } from '@/lib/mockData';
import { LiveModeGate, FamiliesEmptyState } from '@/components/LiveModeGate';
import { Card, Grid, Title, Text, TextInput, Select, SelectItem, Button, Badge, Flex } from '@tremor/react';
import { Search, Plus, Download, Users, Briefcase } from 'lucide-react';

export default function FamiliesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('All Tiers');
  const [statusFilter, setStatusFilter] = useState('All Statuses');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return FAMILIES.filter(f => {
      const matchSearch = !q || f.name.toLowerCase().includes(q)
        || f.code.toLowerCase().includes(q)
        || f.assignedRmName.toLowerCase().includes(q);
      const matchTier = tierFilter === 'All Tiers' || f.serviceTier.toLowerCase() === tierFilter.toLowerCase();
      const matchStatus = statusFilter === 'All Statuses' || f.kycStatus.toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchTier && matchStatus;
    });
  }, [search, tierFilter, statusFilter]);

  return (
    <LiveModeGate emptyState={<FamiliesEmptyState />}>
      <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
        
        {/* Header */}
        <div className="flex justify-end mb-6">
          <div className="flex gap-3">
            <Button size="md" variant="secondary" icon={Download} className="font-semibold shadow-sm">Export</Button>
            <Button size="md" icon={Plus} className="font-semibold shadow-tremor-card">Onboard Client</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="w-full md:flex-1 md:min-w-[300px]">
            <TextInput 
              icon={Search} 
              placeholder="Search by client name, code, or Relationship Manager..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <div className="w-full md:w-48">
            <Select value={tierFilter} onValueChange={setTierFilter} enableClear={false}>
              <SelectItem value="All Tiers">All Service Tiers</SelectItem>
              <SelectItem value="Platinum">Platinum</SelectItem>
              <SelectItem value="Gold">Gold</SelectItem>
              <SelectItem value="Standard">Standard</SelectItem>
            </Select>
          </div>
          <div className="w-full md:w-56">
            <Select value={statusFilter} onValueChange={setStatusFilter} enableClear={false}>
              <SelectItem value="All Statuses">All KYC/AML</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="In Review">In Review</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
            </Select>
          </div>
        </div>

        {/* Content Grid */}
        {filtered.length === 0 ? (
          <Card className="text-center py-20 bg-tremor-background-subtle border-dashed">
             <div className="text-6xl mb-4 opacity-50">👥</div>
             <Title className="text-tremor-content-strong mb-2">No clients match your search criteria.</Title>
             <Text className="mb-6 mx-auto max-w-sm">Adjust your filters or initiate a new client onboarding sequence.</Text>
          </Card>
        ) : (
          <Grid numItemsSm={1} numItemsMd={2} numItemsLg={3} className="gap-5">
            {filtered.map(f => (
              <Card 
                key={f.id} 
                onClick={() => router.push(`/clients/${f.id}`)}
                className="cursor-pointer hover:shadow-tremor-card hover:border-tremor-brand-muted transition-all flex flex-col gap-4 !p-5 group border-t-4 border-t-transparent hover:border-t-tremor-brand"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-tremor-default shrink-0 flex items-center justify-center text-sm font-bold border border-slate-200 bg-slate-50 text-slate-700 shadow-sm group-hover:scale-105 transition-transform" style={{ background: 'linear-gradient(135deg, var(--bg-highlight), var(--bg-surface))' }}>
                    {getInitials(f.name.replace(' Family', ''))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Title className="truncate font-bold text-tremor-content-strong text-lg group-hover:text-tremor-brand transition-colors">{f.name}</Title>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-bold text-tremor-brand px-1.5 py-0.5 bg-tremor-brand-faint rounded-md">{f.code}</span>
                      <span className="text-xs font-medium text-tremor-content truncate">· {f.domicileCountry}</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 py-4 border-y border-tremor-border">
                  <div>
                    <Text className="text-xs font-semibold uppercase text-tremor-content-subtle tracking-wider mb-1">Total AUM</Text>
                    <Text className="font-bold text-tremor-content-strong lg:text-lg">{formatCurrency(f.totalAum, f.currency)}</Text>
                  </div>
                  <div className="text-right">
                    <Text className="text-xs font-semibold uppercase text-tremor-content-subtle tracking-wider mb-1">Service Tier</Text>
                    <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: getTierBadgeColor(f.serviceTier).replace('text', 'bg'), color: getTierBadgeColor(f.serviceTier) }}>
                      {f.serviceTier}
                    </span>
                  </div>
                  
                  <div>
                    <Text className="text-xs font-semibold uppercase text-tremor-content-subtle tracking-wider mb-1">Manager</Text>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <Briefcase size={12} className="text-tremor-content shrink-0" />
                      <Text className="text-xs font-medium text-tremor-content-strong truncate">{f.assignedRmName}</Text>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <Text className="text-xs font-semibold uppercase text-tremor-content-subtle tracking-wider mb-1">Compliance</Text>
                    <div className="flex gap-1">
                      <StatusBadge status={f.kycStatus} />
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-1 flex justify-between items-center">
                   <Text className="text-xs font-medium" style={{ color: getRiskColor(f.riskProfile) }}>
                     Risk: <span className="capitalize">{f.riskProfile}</span>
                   </Text>
                   <Text className="text-xs text-tremor-content hover:text-tremor-brand font-medium group-hover:underline">View Profile &rarr;</Text>
                </div>
              </Card>
            ))}
          </Grid>
        )}
      </div>
    </LiveModeGate>
  );
}
