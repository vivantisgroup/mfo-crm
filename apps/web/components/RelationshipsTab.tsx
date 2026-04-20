'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { NetworkNode, RelationshipEdge } from '@/lib/types';
import {
  ReactFlow, Controls, Background, MiniMap,
  useNodesState, useEdgesState, Handle, Position,
  type NodeProps, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize2, Minimize2, X, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import dagre from 'dagre';

// ─── Typed node data ─────────────────────────────────────────────────────────
type TreeData = { 
  hasChildren?: boolean; 
  treeExpanded?: boolean; 
  onToggleTree?: () => void; 
  isFocused?: boolean;
  onFocus?: () => void;
};
type FamilyData  = TreeData & { label: string; icon: string };
type RelData     = TreeData & { label: string; nodeType: string; subType?: string };
type GroupData   = TreeData & { label: string; contacts: NetworkNode[]; expanded: boolean; onToggle?: () => void };

// ─── Props ────────────────────────────────────────────────────────────────────

interface RelationshipsTabProps {
  nodes: NetworkNode[];
  edges: RelationshipEdge[];
  familyId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  family:   'var(--brand-500)',
  member:   '#3b82f6', // Tailwind blue-500
  entity:   '#a855f7', // Tailwind purple-500
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

function ExpandHandle({ isExpanded, onToggle, hasChildren }: { isExpanded: boolean, onToggle: () => void, hasChildren: boolean }) {
  if (!hasChildren) return null;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
        width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-surface)',
        border: '1px solid var(--border-hover)', color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800, cursor: 'pointer', zIndex: 10, lineHeight: 1,
        boxShadow: 'var(--shadow-sm)', transition: 'all 0.15s ease'
      }}
    >
      {isExpanded ? '−' : '+'}
    </div>
  );
}

function FamilyNode({ data: _d }: NodeProps) {
  const d = _d as FamilyData;
  const color = 'var(--brand-500)';
  return (
    <div style={{
      padding: '8px 12px', minWidth: 160, display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--bg-elevated)', border: `1px solid var(--border)`,
      borderLeft: `5px solid ${color}`, borderRadius: 8, boxShadow: 'var(--shadow-sm)',
      position: 'relative',
    }}>
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 6, height: 6 }} />
      
      <div style={{ position: 'absolute', top: 4, right: 4 }}>
        <button onClick={(e) => { e.stopPropagation(); d.onFocus?.(); }} title={d.isFocused ? 'Clear Focus' : 'Focus on direct relationships'} style={{ 
          background: d.isFocused ? 'var(--brand-500)' : 'transparent', 
          color: d.isFocused ? '#fff' : 'var(--text-tertiary)',
          border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
        }}>
          <Target size={14} />
        </button>
      </div>

      <div style={{ fontSize: 20 }}>{d.icon}</div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{d.label}</div>
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Family Core</div>
      </div>
      <ExpandHandle hasChildren={!!d.hasChildren} isExpanded={!!d.treeExpanded} onToggle={() => d.onToggleTree?.()} />
    </div>
  );
}

function RelNode({ data: _d }: NodeProps) {
  const d = _d as RelData;
  const color = TYPE_COLORS[d.nodeType ?? 'member'] || 'var(--text-secondary)';
  const icon  = SUBTYPE_ICON[d.subType ?? ''] ?? TYPE_ICONS[d.nodeType ?? 'member'];
  return (
    <div style={{
      padding: '6px 10px', minWidth: 140, display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--bg-elevated)', border: `1px solid var(--border)`,
      borderLeft: `4px solid ${color}`, borderRadius: 6,
      boxShadow: 'var(--shadow-sm)', color: 'var(--text-primary)',
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 6, height: 6 }} />
      
      <div style={{ position: 'absolute', top: 4, right: 4 }}>
        <button onClick={(e) => { e.stopPropagation(); d.onFocus?.(); }} title={d.isFocused ? 'Clear Focus' : 'Focus on direct relationships'} style={{ 
          background: d.isFocused ? color : 'transparent', 
          color: d.isFocused ? '#fff' : 'var(--text-tertiary)',
          border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
        }}>
          <Target size={12} />
        </button>
      </div>

      <div style={{ fontSize: 16 }}>{icon}</div>
      <div style={{ textAlign: 'left', flex: 1, paddingRight: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 12 }}>{d.label}</div>
        {d.subType && (
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {d.subType}
          </div>
        )}
      </div>
      <ExpandHandle hasChildren={!!d.hasChildren} isExpanded={!!d.treeExpanded} onToggle={() => d.onToggleTree?.()} />
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
      minWidth: 160, maxWidth: 220, textAlign: 'left',
      background: 'var(--bg-elevated)', border: `1px solid var(--border)`,
      borderLeft: `4px solid ${color}`, borderRadius: 6,
      boxShadow: 'var(--shadow-sm)', color: 'var(--text-primary)',
      overflow: 'hidden',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 6, height: 6 }} />

      {/* Header row */}
      <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 4, right: 4 }}>
          <button onClick={(e) => { e.stopPropagation(); d.onFocus?.(); }} title={d.isFocused ? 'Clear Focus' : 'Focus on direct relationships'} style={{ 
            background: d.isFocused ? color : 'transparent', 
            color: d.isFocused ? '#fff' : 'var(--text-tertiary)',
            border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
          }}>
            <Target size={12} />
          </button>
        </div>

        <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, paddingRight: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 12 }}>{d.label}</div>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {contacts.length} {contacts.length !== 1 ? 'contacts' : 'contact'}
          </div>
        </div>
        {/* Expand / collapse toggle button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          title={isExpanded ? 'Collapse contacts' : 'Show contacts'}
          style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            background: 'var(--bg-surface)',
            border: `1px solid var(--border)`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)',
            transition: 'all 0.2s', lineHeight: 1,
          }}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {/* Expanded contacts list */}
      {isExpanded && (
        <div style={{
          borderTop: `1px solid var(--border)`, padding: '6px 10px',
          display: 'flex', flexDirection: 'column', gap: 4,
          background: 'var(--bg-surface)',
        }}>
          {contacts.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
              background: 'var(--bg-elevated)', borderRadius: 4,
              border: `1px solid var(--border)`, textAlign: 'left',
            }}>
              <span style={{ fontSize: 14 }}>
                {SUBTYPE_ICON[c.subType ?? ''] ?? '🤝'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontWeight: 600, fontSize: 11 }}>{c.name}</div>
                {c.subType && (
                  <div className="truncate" style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {c.subType}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <ExpandHandle hasChildren={!!d.hasChildren} isExpanded={!!d.treeExpanded} onToggle={() => d.onToggleTree?.()} />
    </div>
  );
}

const NODE_TYPES = {
  familyNode: FamilyNode,
  relNode:    RelNode,
  groupNode:  GroupNode,
};

// ─── Layout engine ────────────────────────────────────────────────────────────

// ─── Layout engine ────────────────────────────────────────────────────────────

interface LayoutOptions {
  nodes: NetworkNode[];
  edges: RelationshipEdge[];
  rootId: string;
  expandedGroups: Set<string>;
  expandedTreeNodes: Set<string>;
  focusIds: Set<string>;
}

function buildLayout({ nodes, edges, rootId, expandedGroups, expandedTreeNodes, focusIds }: LayoutOptions) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40 });

  const root = nodes.find(n => n.id === rootId);
  if (!root) return { flowNodes: [], flowEdges: [] };

  // 1. Resolve providers to their "group", and map node to group.
  const groupsMap = new Map<string, { label: string; contacts: NetworkNode[] }>();
  const providerNodes = nodes.filter(n => n.nodeType === 'provider');
  for (const p of providerNodes) {
    if (!p.groupKey) continue;
    if (!groupsMap.has(p.groupKey)) {
      groupsMap.set(p.groupKey, { label: p.groupLabel ?? p.groupKey, contacts: [] });
    }
    groupsMap.get(p.groupKey)!.contacts.push(p);
  }
  
  const nodeToGroup = new Map<string, string>();
  for (const [groupKey, { contacts }] of groupsMap.entries()) {
    for (const c of contacts) nodeToGroup.set(c.id, groupKey);
  }

  const resolveId = (nodeId: string) => {
    const gk = nodeToGroup.get(nodeId);
    if (!gk || expandedGroups.has(gk)) return nodeId;
    return `group-${gk}`;
  };

  // 2. Build explicit adjacency map
  const childrenMap = new Map<string, Set<string>>();
  const parentMap = new Map<string, Set<string>>();
  
  const rawEdges: { src: string, tgt: string, id: string, type: string }[] = [];

  for (const e of edges) {
    const src = resolveId(e.sourceId);
    const tgt = resolveId(e.targetId);
    if (src === tgt) continue;
    rawEdges.push({ src, tgt, id: e.id, type: e.relationType });
    
    if (!childrenMap.has(src)) childrenMap.set(src, new Set());
    childrenMap.get(src)!.add(tgt);
    
    if (!parentMap.has(tgt)) parentMap.set(tgt, new Set());
    parentMap.get(tgt)!.add(src);
  }

  const visibleNodes = new Set<string>();

  if (focusIds.size > 0) {
    // 3. Focus Traversal: show ONLY focused nodes and their 1-hop neighbors
    for (const id of Array.from(focusIds)) {
      visibleNodes.add(id);
      const children = childrenMap.get(id) || new Set();
      for (const child of Array.from(children)) visibleNodes.add(child);
      const parents = parentMap.get(id) || new Set();
      for (const parent of Array.from(parents)) visibleNodes.add(parent);
    }
  } else {
    // 3. Tree Traversal (BFS) to determine visible nodes
    // Ensure we capture everything by identifying all nodes with no parents as 'pseudo-roots'
    const resolvedNodesSet = new Set(nodes.map(n => resolveId(n.id)));
    const allRoots = new Set<string>();
    allRoots.add(resolveId(rootId)); // Always ensure actual root is here
    
    for (const r of Array.from(resolvedNodesSet)) {
      if (!parentMap.has(r)) allRoots.add(r);
    }

    const queue = Array.from(allRoots);
    
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visibleNodes.has(curr)) continue; // Prevent cycle loops
      visibleNodes.add(curr);
      
      if (expandedTreeNodes.has(curr)) {
        const children = childrenMap.get(curr) || new Set();
        for (const child of Array.from(children)) {
          if (!visibleNodes.has(child)) queue.push(child);
        }
      }
    }
  }

  // 4. Construct flow nodes & edges with dagre
  const flowNodes: any[] = [];
  const flowEdges: any[] = [];

  for (const id of Array.from(visibleNodes)) {
    let type = 'relNode';
    let data: any = {};
    let width = 160;
    let height = 60;

    if (id === rootId) {
      type = 'familyNode';
      data = { label: root.name, icon: TYPE_ICONS.family };
      width = 200; height = 80;
    } else if (id.startsWith('group-')) {
      type = 'groupNode';
      const groupKey = id.replace('group-', '');
      const groupData = groupsMap.get(groupKey)!;
      data = { label: groupData.label, contacts: groupData.contacts, expanded: expandedGroups.has(groupKey) };
      width = data.expanded ? 240 : 180; height = data.expanded ? 120 : 60;
    } else {
      const originalNode = nodes.find(n => n.id === id);
      if (originalNode) {
        data = { label: originalNode.name, nodeType: originalNode.nodeType, subType: originalNode.subType };
      }
    }
    
    data.hasChildren = (childrenMap.get(id)?.size ?? 0) > 0;
    data.treeExpanded = expandedTreeNodes.has(id);
    
    dagreGraph.setNode(id, { width, height });
    
    flowNodes.push({ id, type, data, position: { x: 0, y: 0 } });
  }

  for (const edge of rawEdges) {
    if (visibleNodes.has(edge.src) && visibleNodes.has(edge.tgt)) {
      dagreGraph.setEdge(edge.src, edge.tgt);
      
      const isGroupEdge = edge.src.startsWith('group-') || edge.tgt.startsWith('group-');
      flowEdges.push({
        id: `fe-${edge.id}`, source: edge.src, target: edge.tgt,
        label: edge.type.replace(/_/g, ' '),
        animated: isGroupEdge, type: 'smoothstep',
        // NO arrow markers here, discreet minimalist lines instead!
        style: { stroke: isGroupEdge ? 'var(--color-amber)' : 'var(--border-hover)', strokeWidth: isGroupEdge ? 2 : 1.5, opacity: 0.8 },
        labelStyle: { fill: 'var(--text-secondary)', fontWeight: 600, fontSize: 10 },
        labelBgStyle: { fill: 'var(--bg-elevated)', fillOpacity: 0.9, rx: 4 },
        labelBgPadding: [4, 6] as [number, number],
      });
    }
  }

  // 5. Apply Dagre Layout algorithms
  dagre.layout(dagreGraph);

  for (const fn of flowNodes) {
    const nodeWithPos = dagreGraph.node(fn.id);
    if (nodeWithPos) {
      fn.position = {
        x: nodeWithPos.x - nodeWithPos.width / 2,
        y: nodeWithPos.y - nodeWithPos.height / 2
      };
    }
  }

  return { flowNodes, flowEdges };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RelationshipsTab({ nodes, edges, familyId }: RelationshipsTabProps) {
  const [viewMode, setViewMode]         = useState<'cards' | 'list' | 'diagram'>('diagram');
  const [typeFilters, setTypeFilters]   = useState<Set<string>>(new Set(['family', 'member', 'entity', 'provider']));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedTreeNodes, setExpandedTreeNodes] = useState<Set<string>>(new Set([familyId]));
  const [focusIds, setFocusIds]         = useState<Set<string>>(new Set());
  const [showMinimap, setShowMinimap]   = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const router = useRouter();
  const [selectedNodeData, setSelectedNodeData] = useState<NetworkNode | null>(null);

  const onNodeDoubleClick = useCallback((evt: React.MouseEvent, node: any) => {
    if (node.type === 'groupNode' || node.type === 'familyNode') return;
    if (node.id.startsWith('fe-') || node.id.startsWith('group-')) return;
     
    const dataNode = nodes.find(n => n.id === node.id);
    if (dataNode) {
      setSelectedNodeData(dataNode);
    }
  }, [nodes]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      window.dispatchEvent(new CustomEvent('mfo-collapse-right'));
    }
    setIsFullscreen(prev => !prev);
  };

  const toggleTreeExpand = useCallback((nodeId: string) => {
    setExpandedTreeNodes(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

  const toggleFocus = useCallback((nodeId: string) => {
    setFocusIds(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

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
    // familyId prop is exactly the ID of the root node ('root-tenantId')
    const rootId = familyId;

    const { flowNodes: fn, flowEdges: fe } = buildLayout({
      nodes: filteredNodes, edges: filteredEdges, rootId, expandedGroups, expandedTreeNodes, focusIds
    });

    // Inject onToggle callbacks into nodes
    const enriched = fn.map((n: any) => {
      let dataExt = { 
        ...n.data, 
        onToggleTree: () => toggleTreeExpand(n.id),
        isFocused: focusIds.has(n.id),
        onFocus: () => toggleFocus(n.id)
      };
      if (n.type === 'groupNode') {
        const gk = n.id.replace('group-', '');
        dataExt.onToggle = () => toggleGroup(gk);
      }
      return { ...n, data: dataExt };
    });

    setFlowNodes(enriched);
    setFlowEdges(fe);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, JSON.stringify(filteredNodes.map(n => n.id)), JSON.stringify(filteredEdges.map(e => e.id)), expandedGroups, expandedTreeNodes, focusIds, familyId]);

  // ── Collapse / expand all helpers ────────────────────────────────────────────
  const collapseAll = () => {
    setExpandedGroups(new Set());
    setExpandedTreeNodes(new Set([familyId]));
  };
  const expandAll = () => {
    setExpandedGroups(new Set(allGroups.keys()));
    setExpandedTreeNodes(new Set(nodes.map(n => n.id)));
  };

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
                <button onClick={() => setShowMinimap(m => !m)}
                  className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
                  title="Toggle minimap">
                  {showMinimap ? '🗺 Hide map' : '🗺 Map'}
                </button>
              {focusIds.size > 0 && (
                <button onClick={() => setFocusIds(new Set())}
                  className="btn btn-sm" style={{ fontSize: 11, padding: '2px 8px', background: 'var(--brand-faint)', color: 'var(--brand-600)' }}
                  title="Clear focus">
                  <Target size={12} style={{ marginRight: 4, display: 'inline-block' }} />
                  Clear Focus ({focusIds.size})
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

          {/* Fullscreen Expansion Toggle */}
          {viewMode === 'diagram' && (
            <button
              onClick={toggleFullscreen}
              className="btn btn-sm btn-ghost"
              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Expand Network'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? 'Exit' : 'Expand'}
            </button>
          )}
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
        <div 
          className="card" 
          style={isFullscreen ? {
            position: 'fixed', inset: 32, zIndex: 100, 
            background: 'var(--bg-surface)', 
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', 
            borderRadius: 'var(--radius-xl)', 
            border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column'
          } : {
            height: 640, width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column'
          }}
        >
          {isFullscreen && (
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', flexShrink: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Network visualization</div>
              <button onClick={toggleFullscreen} className="btn btn-ghost btn-sm" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                <Minimize2 size={14} /> Close Expanded View
              </button>
            </div>
          )}
          <div style={{ flex: 1, position: 'relative' }}>
            <ReactFlow
            nodes={flowNodes} edges={flowEdges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={NODE_TYPES}
            fitView fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            panOnScroll={true}
            zoomOnScroll={false}
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

      {/* ── Node Info Modal ── */}
      {selectedNodeData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', opacity: 1, backdropFilter: 'blur(4px)' }}>
          <div className="card animate-fade-in" style={{ width: 380, padding: 24, position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', border: '1px solid var(--border)' }}>
            <button onClick={() => setSelectedNodeData(null)} style={{ position: 'absolute', top: 16, right: 16 }} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X size={16} />
            </button>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 8,
                background: TYPE_COLORS[selectedNodeData.nodeType] + '22', color: TYPE_COLORS[selectedNodeData.nodeType],
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              }}>
                {SUBTYPE_ICON[selectedNodeData.subType ?? ''] ?? TYPE_ICONS[selectedNodeData.nodeType]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="text-lg font-bold truncate text-[var(--text-primary)]" title={selectedNodeData.name}>{selectedNodeData.name}</h3>
                <span className="badge badge-neutral capitalize text-[10px] mt-1">{selectedNodeData.nodeType}</span>
                {selectedNodeData.subType && <span className="badge ml-1 capitalize text-[10px] bg-slate-100 text-slate-700">{selectedNodeData.subType}</span>}
              </div>
            </div>
            
            <div className="mb-6 space-y-2 text-sm text-[var(--text-secondary)]">
               {selectedNodeData.groupLabel && (
                 <div className="flex items-center gap-2">
                   <span className="opacity-70">Institution:</span> <span className="font-medium text-[var(--text-primary)]">{selectedNodeData.groupLabel}</span>
                 </div>
               )}
               <p className="text-xs opacity-70 mt-4 leading-relaxed">This record is dynamically mapped by the relationship graph. Open to view full attributes, notes, and activity history.</p>
            </div>

            <div className="flex gap-3 mt-6">
              <button className="btn btn-secondary flex-1" onClick={() => setSelectedNodeData(null)}>Close</button>
              <button className="btn btn-primary flex-1 shadow-sm" onClick={() => {
                 setSelectedNodeData(null);
                 if (selectedNodeData.nodeType === 'entity' || selectedNodeData.nodeType === 'provider') {
                   router.push(`/relationships/organizations/${selectedNodeData.id}`);
                 } else {
                   router.push(`/relationships/contacts/${selectedNodeData.id}`);
                 }
              }}>Open Record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
