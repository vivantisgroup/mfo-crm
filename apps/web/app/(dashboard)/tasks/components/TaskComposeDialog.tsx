'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import { getEmployees } from '@/lib/hrService';
import { getTenantMembers } from '@/lib/tenantMemberService';
import { getServiceTeams, ServiceTeam } from '@/lib/serviceTeamService';

export function TaskComposeDialog({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { tenant, user } = useAuth();
  const { addTask, queues, taskTypes } = useTaskQueue();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<any>('normal');
  const [queueId, setQueueId] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [assignedTeamId, setAssignedTeamId] = useState('');

  // Loaded metadata
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<ServiceTeam[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;
    getTenantMembers(tenant.id).then(res => setMembers(res.map(r => ({ id: r.uid, name: r.displayName || r.email })))).catch(console.error);
    getEmployees().then(res => setEmployees(res.map(r => ({ id: r.id, name: r.name })))).catch(console.error);
    getServiceTeams(tenant.id).then(res => setTeams(res)).catch(console.error);
  }, [tenant?.id]);

  const handleSubmit = async () => {
    if (!title) return;
    if (!user) return;

    let assigneeName = '';
    if (assignedUserId) {
      const match = members.find(m => m.id === assignedUserId) || employees.find(e => e.id === assignedUserId);
      assigneeName = match?.name || '';
    }
    
    let teamName = '';
    if (assignedTeamId) {
       teamName = teams.find(t => t.id === assignedTeamId)?.name || '';
    }

    await addTask({
      title,
      description,
      priority: priority as any,
      queueId: assignedTeamId || queueId,
      taskTypeId,
      serviceTeamId: assignedTeamId || undefined,
      serviceTeamName: teamName || undefined,
      assignedUserId,
      assignedUserName: assigneeName,
      assignedTo: assigneeName,
      source: 'manual',
      familyId: '',
      familyName: '',
      tags: [],
    }, user.id, user.name || 'Unknown');

    // Reset and close
    setTitle('');
    setDescription('');
    setPriority('normal');
    setQueueId('');
    setTaskTypeId('');
    setAssignedUserId('');
    setAssignedTeamId('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="flex flex-col gap-4">
            <div>
              <Label>Task Title</Label>
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="E.g. Review Q3 Taxes"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <Label>Description</Label>
              <div className="mt-1">
                <RichTextEditor 
                  value={description} 
                  onChange={setDescription} 
                  placeholder="Additional context or requirements..."
                  className="min-h-[120px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <Label>Assign to Team</Label>
                  <select 
                    className="w-full mt-1 border border-input rounded flex h-10 px-3 text-sm bg-background"
                    value={assignedTeamId}
                    onChange={e => setAssignedTeamId(e.target.value)}
                  >
                    <option value="">-- No Team --</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
               </div>
               <div>
                  <Label>Assign to Member</Label>
                  <select 
                    className="w-full mt-1 border border-input rounded flex h-10 px-3 text-sm bg-background"
                    value={assignedUserId}
                    onChange={e => setAssignedUserId(e.target.value)}
                  >
                    <option value="">-- Unassigned --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                    {employees.filter(e => !members.find(m => m.id === e.id)).map(e => (
                      <option key={e.id} value={e.id}>{e.name} (Employee)</option>
                    ))}
                  </select>
               </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="default" onClick={handleSubmit} disabled={!title}>Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
