'use client';

import React from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Users, Building, Briefcase } from 'lucide-react';

export default function RelationshipsRootPage() {
  usePageTitle('Relationships Hub');

  return (
    <div className="relative w-full h-full flex flex-col bg-background text-foreground overflow-y-auto">
      <div className="flex justify-between items-start px-4 lg:px-8 pt-8 pb-4 border-b border-border z-10 w-full"><div className="flex flex-col gap-1"><h1 className="text-3xl font-bold tracking-tight">{"Relationships Hub"}</h1></div></div>
      <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-8"><div className="max-w-[1200px] w-full mx-auto flex flex-col gap-6">
        <section className="mb-8">
          <h3 className="text-lg font-medium text-foreground tracking-tight mb-4">Sub-Modules</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a href="/relationships/clients" className="block">
              <Card className="border border-border p-4 rounded-lg bg-card shadow-sm hover:border-primary transition-colors cursor-pointer">
                <Briefcase className="text-[#107e3e] mb-3" size={24} />
                <div className="text-xs text-muted-foreground uppercase">Clients (360º)</div>
                <div className="text-sm font-medium mt-1 text-foreground">Client Portfolios</div>
              </Card>
            </a>
            <a href="/relationships/organizations" className="block">
              <Card className="border border-border p-4 rounded-lg bg-card shadow-sm hover:border-primary transition-colors cursor-pointer">
                <Building className="text-[#0a6ed1] mb-3" size={24} />
                <div className="text-xs text-muted-foreground uppercase">Organizations</div>
                <div className="text-sm font-medium mt-1 text-foreground">Legal Entities & SPVs</div>
              </Card>
            </a>
            <a href="/relationships/contacts" className="block">
              <Card className="border border-border p-4 rounded-lg bg-card shadow-sm hover:border-primary transition-colors cursor-pointer">
                <Users className="text-muted-foreground mb-3" size={24} />
                <div className="text-xs text-muted-foreground uppercase">Contacts</div>
                <div className="text-sm font-medium mt-1 text-foreground">Global Directory</div>
              </Card>
            </a>
        </div>
      </section>
      </div></div>
    </div>
  );
}
