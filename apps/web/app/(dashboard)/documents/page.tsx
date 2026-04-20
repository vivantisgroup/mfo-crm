'use client';

import React, { useState, useMemo } from 'react';
import { FAMILIES } from '@/lib/mockData';
import { Document, DocumentCategory } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { TagManager } from '@/components/TagManager';
import { useAuth } from '@/lib/AuthContext';
import { useLiveMode } from '@/lib/useLiveMode';
import { StorageExplorer } from './components/StorageExplorer';

const CATEGORY_ICONS: Record<DocumentCategory, string> = {
  onboarding: '📝',
  suitability: '⚖️',
  investment: '📊',
  compliance: '🔍',
  correspondence: '✉️',
  legal: '🏛️',
  tax: '💰'
};

export default function DocumentsPage() {
  const { tenant } = useAuth();
  const isLive = useLiveMode();
  
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  
  // Mock Production Documents
  const [documents, setDocuments] = useState<Document[]>([
    { id: 'doc-001', tenantId: 'tenant-001', familyId: 'fam-001', title: 'Advisory Signed Agreement', category: 'onboarding', fileName: 'advisory_agreement_v2.pdf', fileType: 'application/pdf', fileSize: 2400000, uploadedBy: 'Alexandra Torres', uploadedAt: '2026-03-10T09:00:00Z', tags: ['signed', 'legal'], status: 'final', version: 2, fileUrl: '#' },
    { id: 'doc-002', tenantId: 'tenant-001', familyId: 'fam-001', title: 'Family Investment Policy Statement (IPS)', category: 'suitability', fileName: 'ips_smith_2026.pdf', fileType: 'application/pdf', fileSize: 1800000, uploadedBy: 'Alexandra Torres', uploadedAt: '2026-03-12T14:30:00Z', tags: ['ips', 'compliance'], status: 'final', version: 1, fileUrl: '#' },
    { id: 'doc-003', tenantId: 'tenant-001', familyId: 'fam-002', title: 'Schedule K-1 Extract (2025)', category: 'tax', fileName: 'k1_extract.xlsx', fileType: 'application/vnd.ms-excel', fileSize: 500000, uploadedBy: 'Controller', uploadedAt: '2026-03-15T11:00:00Z', tags: ['tax', 'auto_extract'], status: 'final', version: 1, fileUrl: '#' },
    { id: 'doc-004', tenantId: 'tenant-001', familyId: 'fam-001', title: 'Correspondence: Meeting Minutes Q1', category: 'correspondence', fileName: 'q1_meeting_minutes.docx', fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileSize: 450000, uploadedBy: 'Alexandra Torres', uploadedAt: '2026-03-19T16:00:00Z', tags: ['minutes', 'governance'], status: 'draft', version: 1, fileUrl: '#' },
    { id: 'doc-005', tenantId: 'tenant-001', familyId: 'fam-003', title: 'Form CRS - Customer Relationship Summary', category: 'compliance', fileName: 'form_crs_delivered.pdf', fileType: 'application/pdf', fileSize: 1200000, uploadedBy: 'System', uploadedAt: '2026-03-20T08:00:00Z', tags: ['sec', 'delivered'], status: 'final', version: 1, fileUrl: '#' },
  ]);

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      const matchCat = activeCategory === 'all' || doc.category === activeCategory;
      const matchSearch = doc.title.toLowerCase().includes(search.toLowerCase()) || 
                          (doc.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [documents, activeCategory, search]);

  const handleUpdateTags = (docId: string, newTags: string[]) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, tags: newTags } : d));
  };

  // Switch between fully functional Live Cloud Storage vs Mock UI
  if (isLive) {
    if (!tenant) return null;
    return <StorageExplorer tenantId={tenant.id} />;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800 }}>Compliance Vault</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Centralized regulatory and advisory document management for Vivants Consultoria e Serviços.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">📥 Bulk Export</button>
          <button className="btn btn-primary">➕ Upload File</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: '12px 24px', display: 'flex', gap: 24, alignItems: 'center', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'onboarding', 'suitability', 'investment', 'compliance', 'tax'] as const).map(cat => (
            <button 
              key={cat} 
              className={`btn btn-sm ${activeCategory === cat ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setActiveCategory(cat)}
              style={{ textTransform: 'capitalize', border: 'none' }}
            >
              {cat === 'all' ? 'All Files' : `${CATEGORY_ICONS[cat as DocumentCategory]} ${cat}`}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <input 
            type="text" 
            placeholder="Search by title, tag, or family..." 
            className="input" 
            style={{ width: '100%', maxWidth: 400, padding: '10px 16px', background: 'var(--bg-base)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Document Grid/Table */}
      <div className="card table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)' }}>
        <table>
          <thead>
            <tr>
              <th>Document Name</th>
              <th>Category</th>
              <th>Family</th>
              <th>Tags / Labels</th>
              <th>Uploaded</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map(doc => {
              const family = FAMILIES.find(f => f.id === doc.familyId);
              return (
                <tr key={doc.id} className="hover-lift" style={{ cursor: 'default' }}>
                  <td style={{ maxWidth: 350 }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div style={{ 
                        width: 44, height: 44, borderRadius: 'var(--radius-md)', 
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                      }}>
                        {doc.category ? CATEGORY_ICONS[doc.category] : '📄'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{doc.fileName} · {((doc.fileSize || doc.fileSizeBytes || 0) / 1024 / 1024).toFixed(1)}MB</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{doc.category}</span>
                  </td>
                  <td style={{ fontSize: 14, fontWeight: 500 }}>{family?.name || 'Firm-wide'}</td>
                  <td>
                    <TagManager 
                      tags={doc.tags || []} 
                      tenantId={doc.tenantId || 'system'}
                      onChange={(ts) => handleUpdateTags(doc.id, ts)} 
                    />
                  </td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{formatDate(doc.uploadedAt || doc.createdAt || new Date().toISOString())}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>by {doc.uploadedBy}</div>
                  </td>
                  <td>
                    <StatusBadge status={(doc.status || 'final') as any} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-xs btn-ghost">👁️ View</button>
                      <button className="btn btn-xs btn-ghost">📥</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredDocs.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>No documents found</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Try adjusting your search or category filters.</p>
          </div>
        )}
      </div>

    </div>
  );
}
