'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { NetworkNode, RelationshipEdge } from '@/lib/types';
import {
  ReactFlow, Controls, Background, MiniMap,
  useNodesState, useEdgesState, Handle, Position,
  type NodeProps, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ─── Typed node data ─────────────────────────────────────────────────────────
type FamilyData  = { label: string; icon: string };
type RelData     = { label: string; nodeType: string; subType?: string };
type GroupData   = { label: string; contacts: NetworkNode[]; expanded: boolean; onToggle?: () => void };

// ─── Props ────────────────────────────────────────────────────────────────────

interface RelationshipsTabProps {
  nodes: NetworkNode[];
  edges: RelationshipEdge[];
  familyId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

const SUBTYPE_ICON: Record<string, string> = {
  Attorney: '⚖️', Accountant: '🧾', Banker: '🏦',
  trust: '🔒', llc: '🏢', corporation: '🌐', foundation: '🌱',
  Patriarch: '👨', Matriarch: '👩', Beneficiary: '👶',
};

// ─── Custom Nodes ─────────────────────────────────────────────────────────────

/** Root / family node */
function FamilyNode({ data: _d }: NodeProps) {
  const d = _d as FamilyData;
  return (
    <div style={{
      padding: '14px 20px', textAlign: 'center', minWidth: 200,
      background: 'linear-gradient(135deg, var(--brand-600), var(--brand-400))',
      color: 'white', borderRadius: 14, boxShadow: '0 12px 28px -6px rgba(0,0,0,0.45)',
    }}>
      <Handle type="source" position={Position.Bottom} style={{ background: 'white', width: 8, height: 8 }} />
      <div style={{ fontSize: 26, marginBottom: 6 }}>{d.icon}</div>
      <div style={{ fontWeight: 800, fontSize: 15 }}>{d.label}</div>
      <div style={{ fontSize: 9, opacity: 0.75, marginTop: 3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Family Core</div>
    </div>
  );
}

/** Regular entity / member node */
function RelNode({ data: _d }: NodeProps) {
  const d = _d as RelData;
  const color = TYPE_COLORS[d.nodeType ?? 'member'];
  const icon  = SUBTYPE_ICON[d.subType ?? ''] ?? TYPE_ICONS[d.nodeType ?? 'member'];
  return (
    <div style={{
      padding: '10px 16px', minWidth: 180, textAlign: 'center',
      background: 'var(--bg-elevated)', border: `1px solid ${color}44`,
      borderLeft: `4px solid ${color}`, borderRadius: 10,
      boxShadow: 'var(--shadow-md)', color: 'var(--text-primary)',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 8, height: 8 }} />
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{d.label}</div>
      {d.subType && (
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {d.subType}
        </div>
      )}
    </div>
  );
}

/**
 * Collapsible Group Node — represents an institution (bank, firm, …)
 * When collapsed: shows institution name + contact count + expand button
 * When expanded : shows all contacts as chips inside the card
 */
function GroupNode({ data: _d }: NodeProps) {
  const d = _d as GroupData;
  const contacts = d.contacts ?? [];
  const isExpanded = d.expanded ?? false;
  const onToggle = d.onToggle;
  const color = 'var(--color-amber)';
  const icon  = '🏦';

  return (
    <div style={{
      minWidth: 200, maxWidth: 280, textAlign: 'center',
      background: 'var(--bg-elevated)', border: `1px solid ${color}44`,
      borderLeft: `4px solid ${color}`, borderRadius: 10,
      boxShadow: 'var(--shadow-md)', color: 'var(--text-primary)',
      overflow: 'hidden',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 8, height: 8 }} />

      {/* Header row */}
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{d.label}</div>

          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </div>
        </div>
        {/* Expand / collapse toggle button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          title={isExpanded ? 'Collapse contacts' : 'Show contacts'}
          style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: isExpanded ? `${color}33` : `${color}22`,
            border: `1px solid ${color}66`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: color,
            transition: 'all 0.2s', lineHeight: 1,
          }}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {/* Expanded contacts list */}
      {isExpanded && (
        <div style={{
          borderTop: `1px solid ${color}22`, padding: '8px 10px',
          display: 'flex', flexDirection: 'column', gap: 6,
          background: `${color}08`,
        }}>
          {contacts.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
              background: 'var(--bg-surface)', borderRadius: 7,
              border: `1px solid ${color}22`, textAlign: 'left',
            }}>
              <span style={{ fontSize: 14 }}>
                {SUBTYPE_ICON[c.subType ?? ''] ?? '🤝'}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{c.name}</div>
                {c.subType && (
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {c.subType}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NODE_TYPES = {
  familyNode: FamilyNode,
  relNode:    RelNode,
  groupNode:  GroupNode,
};

// ─── Layout engine ────────────────────────────────────────────────────────────

interface LayoutOptions {
  nodes: NetworkNode[];
  edges: RelationshipEdge[];
  rootId: string;
  /** Set of groupKey strings that are expanded */
  expandedGroups: Set<string>;
}

function buildLayout({ nodes, edges, rootId, expandedGroups }: LayoutOptions) {
  const vGap = 200;
  const hGap = 240;
  const startX = 800;
  const startY = 40;

  const flowNodes: any[] = [];

  // ── 1. Root (family) ────────────────────────────────────────────────────────
  const root = nodes.find(n => n.id === rootId);
  if (!root) return { flowNodes: [], flowEdges: [] };

  flowNodes.push({
    id: root.id,
    type: 'familyNode',
    position: { x: startX, y: startY },
    data: { label: root.name, icon: TYPE_ICONS.family },
  });

  // ── 2. Group providers by groupKey ─────────────────────────────────────────
  const providerNodes = nodes.filter(n => n.nodeType === 'provider');
  const ungrouped     = providerNodes.filter(n => !n.groupKey);

  // Build groups map: groupKey → contacts[]
  const groupsMap = new Map<string, { label: string; contacts: NetworkNode[] }>();
  for (const p of providerNodes) {
    if (!p.groupKey) continue;
    if (!groupsMap.has(p.groupKey)) {
      groupsMap.set(p.groupKey, { label: p.groupLabel ?? p.groupKey, contacts: [] });
    }
    groupsMap.get(p.groupKey)!.contacts.push(p);
  }

  // ── 3. Categorise non-provider nodes ───────────────────────────────────────
  const members  = nodes.filter(n => n.nodeType === 'member');
  const entities = nodes.filter(n => n.nodeType === 'entity');

  // ── 4. Position levels ─────────────────────────────────────────────────────
  function layOut(items: { id: string; width?: number }[], y: number) {
    const totalW = (items.length - 1) * hGap;
    const x0 = startX - totalW / 2;
    return items.map((item, i) => ({ id: item.id, x: x0 + i * hGap, y }));
  }

  // Level 1: members
  const memPositions = layOut(members, startY + vGap);
  for (const pos of memPositions) {
    const n = members.find(m => m.id === pos.id)!;
    flowNodes.push({
      id: n.id, type: 'relNode',
      position: { x: pos.x, y: pos.y },
      data: { label: n.name, nodeType: n.nodeType, subType: n.subType },
    });
  }

  // Level 2: entities
  const entPositions = layOut(entities, startY + vGap * 2);
  for (const pos of entPositions) {
    const n = entities.find(e => e.id === pos.id)!;
    flowNodes.push({
      id: n.id, type: 'relNode',
      position: { x: pos.x, y: pos.y },
      data: { label: n.name, nodeType: n.nodeType, subType: n.subType },
    });
  }

  // Level 3: provider groups + ungrouped providers
  const groupItems = Array.from(groupsMap.entries()).map(([key]) => ({ id: `group-${key}` }));
  const ungroupedItems = ungrouped.map(n => ({ id: n.id }));
  const level3Items = [...groupItems, ...ungroupedItems];
  const l3Positions = layOut(level3Items, startY + vGap * 3);

  // Place group nodes
  for (const [groupKey, { label, contacts }] of groupsMap.entries()) {
    const pos = l3Positions.find(p => p.id === `group-${groupKey}`)!;
    const isExpanded = expandedGroups.has(groupKey);
    flowNodes.push({
      id: `group-${groupKey}`,
      type: 'groupNode',
      position: { x: pos.x - 10, y: pos.y },
      data: {
        label,
        contacts,
        expanded: isExpanded,
        // onToggle injected in effect below
      },
    });
  }

  // Place ungrouped (solo) providers
  for (const n of ungrouped) {
    const pos = l3Positions.find(p => p.id === n.id)!;
    flowNodes.push({
      id: n.id, type: 'relNode',
      position: { x: pos.x, y: pos.y },
      data: { label: n.name, nodeType: n.nodeType, subType: n.subType },
    });
  }

  // ── 5. Build edges ─────────────────────────────────────────────────────────
  // For grouped providers: edge targets the group node (not the individual)
  // unless expanded — then preserve individual edges.
  const nodeToGroup = new Map<string, string>();
  for (const [groupKey, { contacts }] of groupsMap.entries()) {
    for (const c of contacts) nodeToGroup.set(c.id, groupKey);
  }

  const processedEdges = new Set<string>();
  const flowEdges: any[] = [];

  const resolveId = (nodeId: string) => {
    const gk = nodeToGroup.get(nodeId);
    if (!gk || expandedGroups.has(gk)) return nodeId;
    return `group-${gk}`;
  };

  for (const e of edges) {
    const src = resolveId(e.sourceId);
    const tgt = resolveId(e.targetId);
    if (src === tgt) continue; // same group — skip self-loop

    const dedupKey = `${src}→${tgt}`;
    if (processedEdges.has(dedupKey)) continue;
    processedEdges.add(dedupKey);

    const isGroupEdge = src.startsWith('group-') || tgt.startsWith('group-');

    flowEdges.push({
      id: `fe-${e.id}`,
      source: src,
      target: tgt,
      label: e.relationType.replace(/_/g, ' '),
      animated: isGroupEdge,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border-hover)' },
      style: { stroke: isGroupEdge ? 'var(--color-amber)' : 'var(--border-hover)', strokeWidth: isGroupEdge ? 2 : 1.5, opacity: 0.85 },
      labelStyle: { fill: 'var(--text-secondary)', fontWeight: 600, fontSize: 10 },
      labelBgStyle: { fill: 'var(--bg-elevated)', fillOpacity: 0.9, rx: 4 },
      labelBgPadding: [4, 6] as [number, number],
    });
  }

  return { flowNodes, flowEdges };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RelationshipsTab({ nodes, edges, familyId }: RelationshipsTabProps) {
  const [viewMode, setViewMode]         = useState<'cards' | 'list' | 'diagram'>('diagram');
  const [typeFilters, setTypeFilters]   = useState<Set<string>>(new Set(['family', 'member', 'entity', 'provider']));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showMinimap, setShowMinimap]   = useState(false);

  const availableTypes = useMemo(() => Array.from(new Set(nodes.map(n => n.nodeType).filter(t => t !== 'group'))), [nodes]);

  const toggleFilter = (type: string) => {
    setTypeFilters(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(type)) next.delete(type); else next.add(type);
      if (next.size === 0) next.add(type);
      return next;
    });
  };

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  }, []);

  const filteredNodes = useMemo(() =>
    nodes.filter(n => typeFilters.has(n.nodeType === 'group' ? 'provider' : n.nodeType)),
    [nodes, typeFilters]);
  const allowedNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);
  const filteredEdges  = useMemo(() =>
    edges.filter(e => allowedNodeIds.has(e.sourceId) && allowedNodeIds.has(e.targetId)),
    [edges, allowedNodeIds]);

  // Collect all group keys from filtered nodes
  const allGroups = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of filteredNodes) {
      if (n.groupKey && n.groupLabel) map.set(n.groupKey, n.groupLabel);
    }
    return map;
  }, [filteredNodes]);

  // ── ReactFlow state ─────────────────────────────────────────────────────────
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<any>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<any>([]);

  // Rebuild layout whenever anything changes
  useEffect(() => {
    if (viewMode !== 'diagram') return;
    const rootId = `node-${familyId}`;

    const { flowNodes: fn, flowEdges: fe } = buildLayout({
      nodes: filteredNodes, edges: filteredEdges, rootId, expandedGroups,
    });

    // Inject onToggle callbacks into group nodes
    const enriched = fn.map((n: any) => {
      if (n.type !== 'groupNode') return n;
      const gk = n.id.replace('group-', '');
      return { ...n, data: { ...n.data, onToggle: () => toggleGroup(gk) } };
    });

    setFlowNodes(enriched);
    setFlowEdges(fe);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, JSON.stringify(filteredNodes.map(n => n.id)), JSON.stringify(filteredEdges.map(e => e.id)), expandedGroups, familyId]);

  // ── Collapse / expand all helpers ────────────────────────────────────────────
  const collapseAll = () => setExpandedGroups(new Set());
  const expandAll   = () => setExpandedGroups(new Set(Array.from(allGroups.keys())));

  const groupCount       = allGroups.size;
  const expandedCount    = expandedGroups.size;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        background: 'var(--bg-surface)', padding: '12px 20px',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
      }}>
        {/* Type filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {availableTypes.map(type => (
            <button key={type} onClick={() => toggleFilter(type)}
              style={{
                padding: '5px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
                background: typeFilters.has(type) ? TYPE_COLORS[type] + '22' : 'transparent',
                color:      typeFilters.has(type) ? TYPE_COLORS[type] : 'var(--text-tertiary)',
                border: `1px solid ${typeFilters.has(type) ? TYPE_COLORS[type] + '66' : 'var(--border)'}`,
                fontWeight: typeFilters.has(type) ? 700 : 500, transition: 'all 0.15s',
              }}>
              {TYPE_ICONS[type]} <span style={{ textTransform: 'capitalize', marginLeft: 4 }}>{type}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Group collapse controls — only shown in diagram mode */}
          {viewMode === 'diagram' && groupCount > 0 && (
            <div style={{ display: 'flex', gap: 4, padding: '4px 8px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11 }}>
              <span style={{ color: 'var(--text-tertiary)', alignSelf: 'center' }}>Groups:</span>
              <button onClick={expandAll} disabled={expandedCount === groupCount}
                className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px', opacity: expandedCount === groupCount ? 0.4 : 1 }}>
                ＋ Expand all
              </button>
              <button onClick={collapseAll} disabled={expandedCount === 0}
                className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px', opacity: expandedCount === 0 ? 0.4 : 1 }}>
                − Collapse all
              </button>
              {viewMode === 'diagram' && (
                <button onClick={() => setShowMinimap(m => !m)}
                  className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
                  title="Toggle minimap">
                  {showMinimap ? '🗺 Hide map' : '🗺 Map'}
                </button>
              )}
            </div>
          )}

          {/* View switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            {(['diagram', 'cards', 'list'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`btn btn-sm ${viewMode === v ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ border: 'none', textTransform: 'capitalize', fontSize: 12 }}>
                {v === 'diagram' ? '🔗' : v === 'cards' ? '⊞' : '≡'} {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Diagram legend (visible in diagram mode) ── */}
      {viewMode === 'diagram' && groupCount > 0 && (
        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap', padding: '8px 16px',
          background: 'var(--bg-surface)', borderRadius: 8,
          border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)',
        }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>💡 Tip:</span>
          Click the <kbd style={{ padding: '1px 5px', background: 'var(--bg-elevated)', borderRadius: 4, border: '1px solid var(--border)', fontSize: 11 }}>+</kbd> on any institution card to reveal the contacts assigned to it.
          {expandedCount > 0 && (
            <span style={{ marginLeft: 'auto', color: 'var(--color-amber)' }}>
              {expandedCount} of {groupCount} group{groupCount > 1 ? 's' : ''} expanded
            </span>
          )}
        </div>
      )}

      {/* ── Diagram ── */}
      {viewMode === 'diagram' && (
        <div className="card" style={{ height: 640, width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <ReactFlow
            nodes={flowNodes} edges={flowEdges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            nodeTypes={NODE_TYPES}
            fitView fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'smoothstep' }}
          >
            <Background color="var(--border)" gap={24} size={1} />
            <Controls style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
            }} />
            {showMinimap && (
              <MiniMap
                nodeColor={n => {
                  if (n.type === 'familyNode') return 'var(--brand-500)';
                  if (n.type === 'groupNode')  return 'var(--color-amber)';
                  const nt = (n.data?.nodeType as string) ?? 'member';
                  return TYPE_COLORS[nt] ?? '#888';
                }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}
              />
            )}
          </ReactFlow>
        </div>
      )}

      {/* ── Cards ── */}
      {viewMode === 'cards' && (
        <div className="grid-4">
          {filteredNodes.filter(n => n.nodeType !== 'group').map(n => (
            <div key={n.id} className="card hover-lift" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 'var(--radius-md)',
                  background: TYPE_COLORS[n.nodeType] + '22', color: TYPE_COLORS[n.nodeType],
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>
                  {SUBTYPE_ICON[n.subType ?? ''] ?? TYPE_ICONS[n.nodeType]}
                </div>
                <span className="badge badge-neutral" style={{ textTransform: 'capitalize', fontSize: 10 }}>{n.nodeType}</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{n.name}</h3>
              {n.subType && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{n.subType}</p>}
              {n.groupLabel && <p style={{ fontSize: 11, color: 'var(--color-amber)', marginTop: 4 }}>🏦 {n.groupLabel}</p>}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {filteredEdges.filter(e => e.sourceId === n.id || e.targetId === n.id).slice(0, 3).map(conn => {
                  const isSrc = conn.sourceId === n.id;
                  const other = nodes.find(rn => rn.id === (isSrc ? conn.targetId : conn.sourceId));
                  return (
                    <div key={conn.id} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                        {conn.relationType.replace(/_/g, ' ')}
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{other?.name ?? '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── List ── */}
      {viewMode === 'list' && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Name / Entity</th>
                <th>Sub-Type / Role</th>
                <th>Institution</th>
                <th>Connections</th>
              </tr>
            </thead>
            <tbody>
              {filteredNodes.filter(n => n.nodeType !== 'group').map(n => {
                const conns = filteredEdges.filter(e => e.sourceId === n.id || e.targetId === n.id).length;
                return (
                  <tr key={n.id}>
                    <td>
                      <span className="badge" style={{ background: TYPE_COLORS[n.nodeType] + '22', color: TYPE_COLORS[n.nodeType], textTransform: 'capitalize' }}>
                        {TYPE_ICONS[n.nodeType]} {n.nodeType}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{n.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{n.subType || '—'}</td>
                    <td style={{ color: 'var(--color-amber)', fontSize: 12 }}>{n.groupLabel ?? '—'}</td>
                    <td>{conns} connection{conns !== 1 ? 's' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
