'use client';

import React from 'react';
import { GOVERNANCE_STRUCTURES, GOVERNANCE_MEETINGS, VOTES } from '@/lib/mockData';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/utils';
import type { GovernanceMeeting, Vote } from '@/lib/types';

export default function GovernancePage() {
  return (
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-5 border-b border-tremor-border gap-4">
        <div>
          <h1 className="text-3xl font-bold text-tremor-content-strong tracking-tight">Family Governance</h1>
            <p className="mt-2 text-tremor-content">Manage Family Councils, Advisory Boards, and Investment Committees</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary">Record Resolution</button>
          <button className="btn btn-primary">Schedule Meeting</button>
        </div>
      </div>

      <div className="grid-2 mt-6">
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6">
          <div className="card-header">
            <h2 className="card-title">Governance Structures</h2>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {GOVERNANCE_STRUCTURES.map(gov => (
                <div key={gov.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div className="fw-600 mb-1">{gov.name}</div>
                    <div className="text-secondary text-xs">{gov.familyName} · {gov.memberCount} Members</div>
                  </div>
                  <div className="text-right">
                    <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{gov.structureType.replace('_', ' ')}</span>
                    {gov.nextMeetingDate && <div className="text-xs text-secondary mt-2">Next: {formatDate(gov.nextMeetingDate)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6">
          <div className="card-header">
            <h2 className="card-title">Upcoming & Recent Meetings</h2>
          </div>
          <DataTable
            data={GOVERNANCE_MEETINGS}
            columns={[
              { header: 'Structure', accessor: (m: GovernanceMeeting) => <span className="fw-500">{m.governanceName}</span> },
              { header: 'Date & Location', accessor: (m: GovernanceMeeting) => (
                <div>
                  <div className="fw-500">{formatDate(m.meetingDate)}</div>
                  <div className="text-xs text-secondary mt-1">{m.location}</div>
                </div>
              )},
              { header: 'Status', accessor: (m: GovernanceMeeting) => <StatusBadge status={m.status} /> },
            ]}
          />
        </div>
      </div>

      <div className="card mt-6">
        <div className="card-header">
          <h2 className="card-title">Recent Resolutions & Votes</h2>
        </div>
        <DataTable
          data={VOTES}
          columns={[
            { header: 'Date', accessor: (v: Vote) => <span className="text-secondary">{formatDate(v.voteDate)}</span> },
            { header: 'Resolution', className: 'w-full', accessor: (v: Vote) => <span className="fw-500">{v.resolution}</span> },
            { header: 'Result', accessor: (v: Vote) => (
              <span className={`badge ${v.voteResult === 'passed' ? 'badge-success' : v.voteResult === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                {v.voteResult.toUpperCase()}
              </span>
            )},
            { header: 'Votes', className: 'td-right', accessor: (v: Vote) => (
              <div className="text-xs">
                <span className="text-green fw-600">{v.votesFor} Y</span> / 
                <span className="text-red fw-600 ml-1"> {v.votesAgainst} N</span> / 
                <span className="text-secondary ml-1"> {v.votesAbstain} A</span>
              </div>
            )},
          ]}
        />
      </div>

    </div>
  );
}
