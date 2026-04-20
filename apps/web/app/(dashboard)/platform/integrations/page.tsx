'use client';

import React from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { Cloud, Server, Database, Network, Globe, BookOpen, GraduationCap, Users, ShieldCheck, ChevronRight, Puzzle } from 'lucide-react';

const CAPABILITIES = [
  {
    title: 'Build Integration Scenarios',
    description: 'Discover, design, and operate scenarios for end-to-end process integration with Cloud Integration.',
    icon: <Cloud className="text-blue-500 mb-4" size={28} strokeWidth={1.5} />,
    actions: ['Discover Integrations']
  },
  {
    title: 'Manage APIs',
    description: 'Discover, design, and govern APIs for API consumers with API Management.',
    icon: <Server className="text-blue-500 mb-4" size={28} strokeWidth={1.5} />,
    actions: ['Discover APIs', 'Design APIs']
  },
  {
    title: 'Manage Trading Partners',
    description: 'Design and operate B2B scenarios with Trading Partner Management.',
    icon: <Globe className="text-blue-500 mb-4" size={28} strokeWidth={1.5} />,
    actions: ['Manage Trading Partners']
  },
  {
    title: 'Implement Interfaces and Mappings',
    description: 'Design interfaces and mappings using crowdsourcing and machine learning with Integration Advisor.',
    icon: <Database className="text-blue-500 mb-4" size={28} strokeWidth={1.5} />,
    actions: ['Discover Type Systems']
  },
  {
    title: 'Extend Non-MFO Connectivity',
    description: 'Connect to non-MFO cloud applications from your integration scenarios with Open Connectors.',
    icon: <Network className="text-blue-500 mb-4" size={28} strokeWidth={1.5} />,
    actions: ['Discover Connectors']
  },
  {
    title: 'Manage Technology Guidance',
    description: 'Define, document, and govern your integration strategy powered by ISA-M with Integration Assessment.',
    icon: <ShieldCheck className="text-blue-500 mb-4" size={28} strokeWidth={1.5} />,
    actions: ['Create Request']
  },
  {
    title: 'Assess Migration Scenarios',
    description: 'Estimate the migration effort for Process Orchestration scenarios with Migration Assessment.',
    icon: <Database className="text-blue-500 mb-4" size={28} strokeWidth={1.5} />,
    actions: ['Create Requests']
  }
];

const RESOURCES = [
  {
    title: "What's New",
    image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=600&auto=format&fit=crop',
    icon: <Puzzle size={20} className="text-[var(--text-secondary)]"/>
  },
  {
    title: "Documentation",
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=600&auto=format&fit=crop',
    icon: <BookOpen size={20} className="text-[var(--text-secondary)]"/>
  },
  {
    title: "Learning Journey",
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=600&auto=format&fit=crop',
    icon: <GraduationCap size={20} className="text-[var(--text-secondary)]"/>
  },
  {
    title: "Community",
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=600&auto=format&fit=crop',
    icon: <Users size={20} className="text-[var(--text-secondary)]"/>
  }
];

export default function IntegrationSuiteHub() {
  usePageTitle('Integration Suite');

  return (
    <div className="absolute inset-0 flex bg-[var(--bg-background)] overflow-hidden">
      
      {/* Sidebar Navigation */}
      <div className="w-[240px] shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col pt-4">
         <div className="flex flex-col gap-1 px-2">
            {[
              { label: 'Home', active: true },
              { label: 'Discover', hasSub: true },
              { label: 'Design', hasSub: true },
              { label: 'Test', hasSub: true },
              { label: 'Configure', hasSub: true },
              { label: 'Monitor', hasSub: true },
              { label: 'Analyze', hasSub: false },
              { label: 'Engage', hasSub: false },
              { label: 'Inspect', hasSub: false },
              { label: 'Monetize', hasSub: false },
              { label: 'Operate', hasSub: false },
              { label: 'Settings', hasSub: true },
            ].map(nav => (
               <button key={nav.label} className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-[0.875rem] font-bold tracking-wide transition-colors ${nav.active ? 'bg-[#ebf8f2] text-[var(--brand-primary)]' : 'text-[#32363a] hover:bg-[var(--bg-elevated)]'}`}>
                 {nav.label}
                 {nav.hasSub && <ChevronRight size={16} className={nav.active ? 'text-[var(--brand-primary)]' : 'text-[var(--text-tertiary)]'} />}
               </button>
            ))}
         </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 relative">
         <div className="max-w-[1400px] mx-auto">
            {/* Header info */}
            <div className="mb-8">
               <h2 className="text-[1.25rem] font-bold text-[var(--text-primary)] tracking-tight">Capabilities</h2>
               <p className="text-[0.875rem] text-[var(--text-secondary)] mt-1">Develop and manage enterprise-wide integration across heterogeneous landscapes.</p>
            </div>

            {/* Cards Grid */}
            <div className="flex flex-wrap gap-6 mb-16">
               {CAPABILITIES.map(cap => (
                 <div key={cap.title} className="w-[340px] bg-white border border-[var(--border-subtle)] rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                       {cap.icon}
                       <h3 className="font-bold text-[1rem] text-[#32363a] mb-2">{cap.title}</h3>
                       <p className="text-[0.8125rem] text-[#6a6d70] leading-relaxed min-h-[60px]">{cap.description}</p>
                    </div>
                    <div className="mt-8 flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          {cap.actions.map((act, i) => (
                             <button key={i} className="text-[#0a6ed1] font-bold text-[0.8125rem] hover:underline">{act}</button>
                          ))}
                       </div>
                       <button className="text-[var(--text-tertiary)] hover:text-[#0a6ed1]"><ChevronRight size={16}/></button>
                    </div>
                 </div>
               ))}
            </div>

            {/* Resources Section */}
            <div className="mb-6">
               <h2 className="text-[1.25rem] font-bold text-[var(--text-primary)] tracking-tight mb-6">Resources</h2>
               <p className="text-[0.875rem] text-[var(--text-secondary)] mb-6 -mt-4">Learn about MFO Integration Suite.</p>
               <div className="flex flex-wrap gap-6">
                  {RESOURCES.map(res => (
                     <div key={res.title} className="w-[300px] bg-white border border-[var(--border-subtle)] rounded-xl overflow-hidden hover:shadow-md transition-shadow group flex flex-col cursor-pointer">
                        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] font-bold text-[0.875rem] text-[#32363a] flex items-center justify-between">
                           {res.title}
                        </div>
                        <div className="h-[160px] relative overflow-hidden group-hover:opacity-90 transition-opacity">
                           <img src={res.image} alt={res.title} className="absolute inset-0 w-full h-full object-cover" />
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            <div className="flex justify-center mt-16 mb-8">
               <button className="bg-[#0a6ed1] hover:bg-[#0854a0] text-white font-bold text-[0.875rem] px-6 py-2.5 rounded-full transition-colors shadow-sm">
                  Tell Us What You Want
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
