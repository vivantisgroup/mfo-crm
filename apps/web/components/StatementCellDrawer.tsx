'use client';

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { FileManager } from '@/components/FileManager';
import { CheckCircle2, CircleDashed, Clock, Slash } from 'lucide-react';

interface StatementCellDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodName: string;
  clientName: string;
  bankName: string;
  entityId: string;
  currentStatus: 'ok' | 'x' | null;
  onStatusChange: (status: 'ok' | 'x' | null) => void;
}

export function StatementCellDrawer({
  open,
  onOpenChange,
  periodName,
  clientName,
  bankName,
  entityId,
  currentStatus,
  onStatusChange
}: StatementCellDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[800px] sm:max-w-none flex flex-col p-6 overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            Statement Documents
          </SheetTitle>
          <SheetDescription className="text-slate-500 font-medium">
            Manage required documents for <strong className="text-slate-800">{clientName}</strong> at <strong className="text-slate-800">{bankName}</strong> for cycle <strong className="text-slate-800">{periodName}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="flex gap-4 mb-8 pb-6 border-b border-slate-200">
           <div className="flex-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Status Override</h3>
              <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 gap-2 w-max">
                 <Button 
                   size="sm" 
                   variant={currentStatus === 'ok' ? 'default' : 'ghost'} 
                   className={currentStatus === 'ok' ? 'bg-emerald-600 hover:bg-emerald-700' : 'text-slate-500 hover:bg-slate-200'}
                   onClick={() => onStatusChange('ok')}
                 >
                   <CheckCircle2 size={16} className="mr-2" />
                   Fully Received (OK)
                 </Button>
                 
                 <Button 
                   size="sm" 
                   variant={currentStatus === 'x' ? 'default' : 'ghost'} 
                   className={currentStatus === 'x' ? 'bg-amber-500 hover:bg-amber-600' : 'text-slate-500 hover:bg-slate-200'}
                   onClick={() => onStatusChange('x')}
                 >
                   <Clock size={16} className="mr-2" />
                   Pending (Expected)
                 </Button>

                 <Button 
                   size="sm" 
                   variant={currentStatus === null ? 'default' : 'ghost'} 
                   className={currentStatus === null ? 'bg-slate-500 hover:bg-slate-600' : 'text-slate-500 hover:bg-slate-200'}
                   onClick={() => onStatusChange(null)}
                 >
                   <Slash size={16} className="mr-2" />
                   Not Expected
                 </Button>
              </div>
           </div>
        </div>

        <div className="flex-1 flex flex-col">
           <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Linked Files</h3>
           {open && (
             <FileManager entityType="statement" entityId={entityId} />
           )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
