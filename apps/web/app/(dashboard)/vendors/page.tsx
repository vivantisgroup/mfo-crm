'use client';

import React from 'react';
import { Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/lib/PageTitleContext';

export default function VendorsPage() {
  usePageTitle('Vendors');
  return (
    <div className="relative w-full h-full flex flex-col bg-background text-foreground overflow-y-auto animate-fade-in">
      <div className="flex justify-between items-start px-4 lg:px-8 pt-8 pb-4 border-b border-border z-10 w-full mb-6 relative"><div className="flex flex-col gap-1"><h1 className="text-3xl font-bold tracking-tight">Vendors</h1></div><Button variant="default">Procure Vendor</Button></div>
      <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-8 pt-4"><div className="max-w-[1200px] w-full mx-auto flex flex-col gap-6">
      <div className="card text-center py-20 border-dashed bg-slate-50">
        <div className="text-6xl mb-4 opacity-50">🤝</div>
        <h3 className="text-macro text-lg mb-2">Vendor Network</h3>
        <p className="text-slate-500 max-w-sm mx-auto mb-6">Directory coming soon. This section will allow you to track contracts and external service agreements.</p>
        <Button variant="default" className="font-semibold">Procure Vendor</Button>
      </div>
      </div></div>
    </div>
  );
}

