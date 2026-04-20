const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

const oldMetrics = `    const active = tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved');
    const breached = active.filter(t => t.slaBreached).length;
    const unassignedCount = active.filter(t => !t.assignedTo).length;
    return {
      activeTickets: active.length,
      slaBreachRate: active.length ? Math.round((breached / active.length) * 100) : 0,
      unassigned: unassignedCount,
      avgResTime: 0
    };`;

const newMetrics = `    const active = tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved');
    const breached = active.filter(t => t.slaBreached).length;
    const unassignedCount = active.filter(t => !t.assignedTo).length;
    
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    let avgResTime = 0;
    if (resolved.length > 0) {
      const totalHours = resolved.reduce((acc, t) => {
        const created = new Date(t.createdAt).getTime();
        const updated = new Date(t.updatedAt).getTime();
        return acc + ((updated - created) / (1000 * 60 * 60));
      }, 0);
      avgResTime = Math.round((totalHours / resolved.length) * 10) / 10;
    }

    return {
      activeTickets: active.length,
      slaBreachRate: active.length ? Math.round((breached / active.length) * 100) : 0,
      unassigned: unassignedCount,
      avgResTime
    };`;

code = code.replace(oldMetrics, newMetrics);

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Fixed avgResTime');
