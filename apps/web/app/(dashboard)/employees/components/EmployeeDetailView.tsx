import React from 'react';
import { Mail, Phone, Briefcase, Calendar, MapPin, Building, GitMerge, FileText, Download, X } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { usePageTitle } from '@/lib/PageTitleContext';
import { FileManager } from '@/components/FileManager';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

export function EmployeeDetailView({ employee, onClose, departments }: { employee: any, onClose: () => void, departments: any[] }) {
  const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.name || 'Unknown Staff';
  const title = employee.jobTitle || employee.odooData?.job_id || 'Staff Member';
  const dept = employee.department || employee.odooData?.department_id || 'Operations';
  const email = employee.email || employee.work_email || '';
  const phone = employee.phone || employee.work_phone || '';
  
  const { setTitle } = usePageTitle();

  React.useEffect(() => {
    setTitle(fullName, title, [
      { label: 'Staff & Advisors', onClick: onClose },
      { label: 'Profile' }
    ]);
    return () => setTitle('', undefined, undefined);
  }, [setTitle, fullName, title, onClose]);

  return (
    <div className="animate-fade-in absolute inset-0 z-20 relative w-full h-full flex flex-col bg-background text-foreground overflow-y-auto">
      
      {/* ─── Fiori Global Close Action ─── */}
      <button onClick={onClose} className="absolute right-4 top-4 z-50 w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-muted)] text-[var(--text-secondary)] transition-colors">
        <X size={16} />
      </button>

      {/* ─── Fiori Object Header (Dynamic Page) ─── */}
      <div className="flex justify-between items-start px-4 lg:px-8 pt-8 pb-4 border-b border-border z-10 w-full mb-6 relative">
        <div className="flex flex-col gap-1"><h1 className="text-3xl font-bold tracking-tight">Employee Details</h1></div>
        <div className="flex gap-2"><Button variant="default">Message</Button><Button variant="secondary">Schedule</Button></div>
      </div>
      <div className="flex flex-col gap-4 mt-2 px-4 lg:px-8">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <span className="flex items-center gap-1.5"><span className="px-2 py-0.5 rounded-full bg-[#f5fae5] text-[#107e3e] font-bold text-[0.7rem] uppercase tracking-wider border border-[#107e3e]/20">Active Profile</span></span>
          {email && <span className="flex items-center gap-1.5 hover:underline cursor-pointer"><Mail size={14} className="text-[var(--brand-primary)]" /> {email}</span>}
          {phone && <span className="flex items-center gap-1.5 hover:underline cursor-pointer"><Phone size={14} className="text-[var(--brand-primary)]" /> {phone}</span>}
          <span className="flex items-center gap-1.5"><Building size={14} className="text-[var(--brand-primary)]" /> {dept}</span>
          <span className="flex items-center gap-1.5"><MapPin size={14} className="text-[var(--brand-primary)]" /> Headquarters</span>
        </div>
      </div>

      {/* ─── Fiori Workspace Data Arrays ─── */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-8"><div className="max-w-[1200px] w-full mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Layout Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
             <Card className="shadow-sm border-border" ><CardHeader className="py-4 border-b"><CardTitle className="text-lg font-semibold">"Employment Profile"</CardTitle></CardHeader><CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6" >
                   <div className="flex flex-col gap-2"><label className="text-sm font-medium">Full Legal Name</label>
                      <span className="font-semibold">{fullName}</span>
                   </div>
                   <div className="flex flex-col gap-2"><label className="text-sm font-medium">Department</label>
                      <span className="font-semibold">{dept}</span>
                   </div>
                   <div className="flex flex-col gap-2"><label className="text-sm font-medium">Line Manager</label>
                      <span className="font-semibold flex items-center gap-2">
                        {employee.manager || 'No Manager Assigned'}
                      </span>
                   </div>
                   <div className="flex flex-col gap-2"><label className="text-sm font-medium">Working Model</label>
                      <span className="font-semibold text-[var(--color-green)] flex items-center gap-1.5">
                        <Calendar size={14}/> Standard Full-Time
                      </span>
                   </div>
                </div>
             </CardContent></Card>

             <Card className="shadow-sm border-border" ><CardHeader className="py-4 border-b"><CardTitle className="text-lg font-semibold">"Recent Activity"</CardTitle></CardHeader><CardContent className="p-6">
                <div className="text-center py-10">
                   <GitMerge size={24} className="mx-auto mb-3 opacity-30 text-[var(--text-secondary)]" />
                   <p className="font-medium text-[var(--text-secondary)]">No recent master data changes log found.</p>
                </div>
             </CardContent></Card>
          </div>

          {/* End Detail Column */}
          <div className="flex flex-col gap-6">
             {/* Tech Data Panel */}
             <Card className="shadow-sm border-border" ><CardHeader className="py-4 border-b"><CardTitle className="text-lg font-semibold">"System Data"</CardTitle></CardHeader><CardContent className="p-6">
                <div className="flex flex-col gap-3 text-[0.8125rem]">
                   <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-2">
                      <span className="text-[var(--text-secondary)] font-bold uppercase tracking-wider text-[10px]">Data Source</span>
                      <span className="font-bold text-[var(--brand-primary)]">Odoo ERP</span>
                   </div>
                   <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-2">
                      <span className="text-[var(--text-secondary)] font-bold uppercase tracking-wider text-[10px]">Entity ID</span>
                      <span className="font-mono text-[var(--text-primary)]">{employee.id}</span>
                   </div>
                   <div className="flex justify-between items-center pb-1">
                      <span className="text-[var(--text-secondary)] font-bold uppercase tracking-wider text-[10px]">Last Synced</span>
                      <span className="text-[var(--text-primary)]">Just now</span>
                   </div>
                </div>
             </CardContent></Card>

             {/* Documents Proxy Panel */}
             <Card className="shadow-sm border-border" ><CardHeader className="py-4 border-b"><CardTitle className="text-lg font-semibold">"Document Vault"</CardTitle></CardHeader><CardContent className="p-6">
                <div className="p-0 -m-4">
                  <FileManager entityType="employees" entityId={employee.id} />
                </div>
             </CardContent></Card>
          </div>
          
        </div>
      </div>
    </div>
    </div>
  );
}
