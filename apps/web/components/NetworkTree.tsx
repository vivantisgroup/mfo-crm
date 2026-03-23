'use client';

import React, { useState, useMemo } from 'react';
import type { NetworkNode, RelationshipEdge } from '@/lib/types';

interface NetworkTreeProps {
  nodes: NetworkNode[];
  edges: RelationshipEdge[];
  rootNodeId: string;
}

const TYPE_COLORS: Record<string, string> = {
  family:   'var(--brand-500)',
  member:   'var(--color-blue)',
  entity:   'var(--color-purple)',
  provider: 'var(--color-amber)',
  group:    'var(--color-amber)',
};

const TYPE_ICONS: Record<string, string> = {
  family:   '👥',
  member:   '👤',
  entity:   '🏢',
  provider: '🤝',
  group:    '🏦',
};


export function NetworkTree({ nodes, edges, rootNodeId }: NetworkTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([rootNodeId]));
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set(['family', 'member', 'entity', 'provider']));

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Find all edges where a node is either source OR target (undirected exploration, but directed labels)
  const getConnections = (nodeId: string) => {
    const outgoing = edges.filter(e => e.sourceId === nodeId);
    const incoming = edges.filter(e => e.targetId === nodeId);
    
    return [
      ...outgoing.map(e => ({ edge: e, node: nodeMap.get(e.targetId), direction: 'out' as const })),
      ...incoming.map(e => ({ edge: e, node: nodeMap.get(e.sourceId), direction: 'in' as const })),
    ].filter(c => c.node && typeFilters.has(c.node.nodeType === 'group' ? 'provider' : c.node.nodeType));

  };

  const toggleNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const toggleFilter = (type: string) => {
    const next = new Set(typeFilters);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    if (next.size === 0) next.add(type); // Prevent empty filters
    setTypeFilters(next);
  };

  const renderNode = (nodeId: string, depth: number, visited: Set<string> = new Set()) => {
    const node = nodeMap.get(nodeId);
    if (!node) return null;

    // Prevent infinite loops in cyclic graphs by stopping traversal if already visited in this path
    if (visited.has(nodeId)) {
      return (
        <div key={`cycle-${nodeId}`} className="text-secondary text-xs ml-8" style={{ paddingLeft: depth * 20 }}>
          ⤷ <i>Circular reference to {node.name}</i>
        </div>
      );
    }

    const connections = getConnections(nodeId);
    const isExpanded = expanded.has(nodeId);
    const hasChildren = connections.length > 0;
    
    const color = TYPE_COLORS[node.nodeType];
    const icon = TYPE_ICONS[node.nodeType];

    const currentVisited = new Set(visited).add(nodeId);

    return (
      <div key={`tree-${nodeId}-${depth}`} style={{ marginLeft: depth > 0 ? 24 : 0, position: 'relative' }}>
        {depth > 0 && (
          <div style={{ position: 'absolute', left: -16, top: 18, width: 16, height: 1, backgroundColor: 'var(--border)' }} />
        )}
        {depth > 0 && (
          <div style={{ position: 'absolute', left: -16, top: -10, width: 1, height: 28, backgroundColor: 'var(--border)' }} />
        )}

        <div 
          onClick={(e) => hasChildren && toggleNode(nodeId, e)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', 
            margin: '4px 0', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
            background: 'var(--bg-elevated)', cursor: hasChildren ? 'pointer' : 'default',
            width: 'fit-content', minWidth: 280, position: 'relative', zIndex: 2
          }}
        >
          {hasChildren && (
            <button className="icon-btn" style={{ width: 20, height: 20, border: 'none', background: 'var(--bg-overlay)' }}>
              {isExpanded ? '−' : '+'}
            </button>
          )}
          {!hasChildren && <div style={{ width: 20 }} />}
          
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{node.name}</span>
            </div>
            {node.subType && (
              <span className="text-xs mt-1" style={{ color: color }}>{node.subType}</span>
            )}
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div style={{ position: 'relative', borderLeft: '1px solid var(--border)', marginLeft: 22, marginTop: -4, paddingBottom: 8 }}>
            {connections.map((conn, i) => {
              const label = conn.direction === 'out' ? conn.edge.relationType : `← ${conn.edge.relationType.replace('_of', '')}`;
              const note = conn.edge.note;
              
              return (
                <div key={`${conn.edge.id}-${conn.direction}`} style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 24, marginBottom: -4, position: 'relative', zIndex: 1 }}>
                    <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: 9 }}>
                      {label.replace('_', ' ')}
                    </span>
                    {note && <span className="text-xs text-secondary">({note})</span>}
                  </div>
                  {renderNode(conn.node!.id, 1, currentVisited)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <h2 className="card-title">Relationship Network</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.entries(TYPE_ICONS).map(([type, icon]) => (
            <button 
              key={type}
              onClick={() => toggleFilter(type)}
              className={`btn btn-sm ${typeFilters.has(type) ? 'btn-secondary' : 'btn-ghost'}`}
              style={{ textTransform: 'capitalize' }}
            >
              {icon} {type}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body" style={{ overflowX: 'auto', padding: 32 }}>
        {renderNode(rootNodeId, 0)}
      </div>
    </div>
  );
}
