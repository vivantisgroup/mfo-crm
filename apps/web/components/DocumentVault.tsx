'use client';

import React, { useState } from 'react';

type FileNode = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: string;
  modified?: string;
  status?: 'Verified' | 'Synced' | 'Pending';
  children?: FileNode[];
};

const mockVault: FileNode[] = [
  {
    id: 'f1', name: 'Legal & Compliance', type: 'folder',
    children: [
      { id: 'f1-1', name: 'KYC Documents', type: 'folder', children: [
        { id: 'd1', name: 'Passport_Scan.pdf', type: 'file', size: '2.4 MB', modified: 'Oct 14', status: 'Verified' },
        { id: 'd2', name: 'Proof_of_Address.pdf', type: 'file', size: '1.1 MB', modified: 'Oct 15', status: 'Pending' }
      ]},
      { id: 'd3', name: 'Entity_Structure.pdf', type: 'file', size: '840 KB', modified: 'Oct 12', status: 'Synced' },
    ]
  },
  {
    id: 'f2', name: 'Portfolio Statements', type: 'folder',
    children: [
      { id: 'd4', name: 'Q3_Performance.xlsx', type: 'file', size: '4.2 MB', modified: 'Nov 01', status: 'Verified' },
      { id: 'd5', name: 'Capital_Call_Notice.pdf', type: 'file', size: '320 KB', modified: 'Nov 05', status: 'Synced' }
    ]
  }
];

export function DocumentVault() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['f1', 'f1-1']));

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const getStatusColor = (status?: string) => {
    if (status === 'Verified') return 'var(--color-emerald)';
    if (status === 'Synced') return 'var(--color-indigo)';
    if (status === 'Pending') return 'var(--color-amber)';
    return 'var(--text-tertiary)';
  };

  const renderNode = (node: FileNode, depth = 0) => {
    const isExpanded = expanded.has(node.id);
    const isFolder = node.type === 'folder';

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div 
          onClick={() => isFolder ? toggle(node.id) : null}
          style={{ 
            display: 'flex', alignItems: 'center', padding: '6px 16px', 
            paddingLeft: `${16 + depth * 16}px`, cursor: isFolder ? 'pointer' : 'default',
            background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
            transition: 'background 0.15s'
          }}
          className="hover:bg-[var(--bg-elevated)]"
        >
          {isFolder ? (
            <span style={{ fontSize: '10px', marginRight: '6px', color: 'var(--text-tertiary)', width: '12px' }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          ) : (
            <span style={{ fontSize: '12px', marginRight: '6px', color: 'var(--text-tertiary)', width: '12px' }}>📄</span>
          )}
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span className="text-macro" style={{ fontSize: '12px', color: isFolder ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {node.name}
            </span>
            {!isFolder && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span className="text-micro">{node.size}</span>
                <span className="text-micro">{node.modified}</span>
              </div>
            )}
          </div>

          {!isFolder && node.status && (
            <div style={{ 
              background: `${getStatusColor(node.status)}15`, 
              color: getStatusColor(node.status), 
              padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              {node.status}
            </div>
          )}
        </div>
        {isFolder && isExpanded && node.children && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {node.children.map(c => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-background)' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="text-macro" style={{ fontSize: '14px', letterSpacing: '-0.02em', flex: 1 }}>Vault</span>
          <button style={{ background: 'none', border: 'none', color: 'var(--brand-500)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>+ Upload</button>
        </div>
        <input 
          type="text" 
          placeholder="Filter documents..." 
          style={{ width: '100%', padding: '6px 12px', fontSize: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', outline: 'none', color: 'var(--text-primary)' }}
        />
      </div>

      {/* File Tree */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {mockVault.map(n => renderNode(n, 0))}
      </div>
    </div>
  );
}
