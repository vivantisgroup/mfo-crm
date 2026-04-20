'use client';

import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Database, Link2, Maximize, Minimize } from 'lucide-react';

interface OdooModel {
  id: number;
  model: string;
  name: string;
}

interface OdooRelation {
  id: number;
  model: string;
  name: string;
  relation: string;
  ttype: string;
  field_description: string;
}

interface OdooSchemaDiagramProps {
  models: OdooModel[];
  relations: OdooRelation[];
  selectedModels: string[];
  onSelectionChange: (models: string[]) => void;
}

// Custom Node to make it look like a cool database table
const CustomTableNode = ({ data, selected }: { data: any, selected: boolean }) => {
  return (
    <div className={`rounded-xl border-2 shadow-xl bg-white w-[260px] overflow-hidden transition-all duration-200 ${
      data.isSelected 
        ? 'border-indigo-500 shadow-indigo-500/30 ring-4 ring-indigo-100' 
        : 'border-slate-200 hover:border-slate-400'
    }`}>
      {/* Target handle for incoming many2one/one2many links */}
      <Handle type="target" position={Position.Top} className="w-16 h-2 !bg-indigo-300 rounded-b-none border-0" />
      
      <div 
        className={`px-4 py-3 flex items-center justify-between cursor-pointer ${
          data.isSelected ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-50 text-slate-800'
        }`}
        onClick={data.onToggle}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Database size={16} className={data.isSelected ? 'text-indigo-600 shrink-0' : 'text-slate-400 shrink-0'} />
          <div className="font-bold text-sm truncate">{data.name}</div>
        </div>
        <input 
          type="checkbox" 
          checked={data.isSelected || false} 
          readOnly 
          className="w-4 h-4 cursor-pointer accent-indigo-600 shrink-0" 
        />
      </div>
      
      <div className="px-4 py-2 bg-white text-xs border-t border-slate-100 font-mono text-slate-500 flex flex-col gap-1">
         <span className="font-bold text-slate-700">{data.modelId}</span>
         <div className="flex items-center justify-between mt-1">
           <div className="flex gap-2">
             {data.outboundCount > 0 && (
               <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                 <Link2 size={10} /> {data.outboundCount} out
               </span>
             )}
             {data.inboundCount > 0 && (
               <span className="flex items-center gap-1 text-[10px] text-amber-600">
                 <Link2 size={10} /> {data.inboundCount} in
               </span>
             )}
           </div>
         </div>
      </div>

      <div className="px-3 py-2 bg-slate-50 flex items-center justify-between text-xs font-semibold gap-2 border-t border-slate-200">
         <button onClick={(e) => { e.stopPropagation(); data.onExpand(); }} className="text-slate-500 hover:text-indigo-600 px-2 flex-1 text-center py-1 rounded bg-white hover:bg-indigo-50 transition-colors border border-slate-200">
            {data.isExpanded ? '- Collapse' : '+ Expand'}
         </button>
         <button onClick={(e) => { e.stopPropagation(); data.onPreview(); }} className="text-slate-500 hover:text-emerald-600 px-2 flex-1 text-center py-1 rounded bg-white hover:bg-emerald-50 transition-colors border border-slate-200">
            Preview
         </button>
      </div>

      {/* Source handle for outgoing links */}
      <Handle type="source" position={Position.Bottom} className="w-16 h-2 !bg-slate-300 rounded-t-none border-0" />
    </div>
  );
};

const nodeTypes = {
  tableNode: CustomTableNode,
};

interface SchemaDiagramProps {
  models: OdooModel[];
  relations: OdooRelation[];
  selectedModels: string[];
  onSelectionChange: (models: string[]) => void;
  onPreview: (modelId: string) => void;
}

export function OdooSchemaDiagram({ models, relations, selectedModels, onSelectionChange, onPreview }: SchemaDiagramProps) {
  
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set(selectedModels.length > 0 ? selectedModels : [(models[0] || {}).model]));
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: any[] = [];
    const edges: any[] = [];
    
    // BFS configuration
    const COLS = 5;
    const X_SPACING = 300;
    const Y_SPACING = 250;

    // Build Adjacency List for relationships
    const adj = new Map<string, string[]>();
    relations.forEach(r => {
        if (!adj.has(r.model)) adj.set(r.model, []);
        adj.get(r.model)!.push(r.relation);
        
        if (!adj.has(r.relation)) adj.set(r.relation, []);
        adj.get(r.relation)!.push(r.model); // undirected for visibility
    });

    // BFS to find all visible nodes
    const visibleModels = new Set<string>();
    const queue = Array.from(expandedNodes);
    
    // Always insert at least expanded nodes to queue & visible
    queue.forEach(n => visibleModels.add(n));
    
    // 1st degree from expanded nodes
    queue.forEach(root => {
       const neighbors = adj.get(root) || [];
       neighbors.forEach(n => visibleModels.add(n));
    });

    const activeModels = models.filter(m => visibleModels.has(m.model));
    const displayModels = activeModels.length > 0 ? activeModels : models;

    displayModels.forEach((m, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      
      const outbound = relations.filter(r => r.model === m.model).length;
      const inbound = relations.filter(r => r.relation === m.model).length;

      nodes.push({
        id: m.model,
        type: 'tableNode',
        position: { x: col * X_SPACING, y: row * Y_SPACING },
        data: {
          modelId: m.model,
          name: m.name,
          isSelected: selectedModels.includes(m.model),
          isExpanded: expandedNodes.has(m.model),
          outboundCount: outbound,
          inboundCount: inbound,
          onToggle: () => {
             const isSel = selectedModels.includes(m.model);
             if (isSel) {
                onSelectionChange(selectedModels.filter(s => s !== m.model));
             } else {
                onSelectionChange([...selectedModels, m.model]);
             }
          },
          onExpand: () => {
             setExpandedNodes(prev => {
                const next = new Set(prev);
                if (next.has(m.model)) next.delete(m.model);
                else next.add(m.model);
                return next;
             });
          },
          onPreview: () => onPreview(m.model)
        }
      });
    });

    relations.forEach((r, idx) => {
      if (nodes.find(n => n.id === r.model) && nodes.find(n => n.id === r.relation)) {
        edges.push({
          id: `e-${r.model}-${r.relation}-${idx}`,
          source: r.model,
          target: r.relation,
          label: r.name,
          type: 'smoothstep',
          animated: selectedModels.includes(r.model) || selectedModels.includes(r.relation),
          style: { 
            stroke: selectedModels.includes(r.model) && selectedModels.includes(r.relation) 
              ? '#6366f1' 
              : '#cbd5e1', 
            strokeWidth: 2 
          },
          labelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: selectedModels.includes(r.model) && selectedModels.includes(r.relation) ? '#6366f1' : '#cbd5e1',
          },
        });
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [models, relations, selectedModels, onSelectionChange, expandedNodes, onPreview]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync node internal state when selectedModels changes externally
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSelected: selectedModels.includes(n.id),
          onToggle: () => {
             const isSel = selectedModels.includes(n.id);
             if (isSel) {
                onSelectionChange(selectedModels.filter(s => s !== n.id));
             } else {
                onSelectionChange([...selectedModels, n.id]);
             }
          }
        },
      }))
    );
    
    // Animate edges connecting selected nodes
    setEdges((eds) => 
       eds.map((e) => {
          const bothSelected = selectedModels.includes(e.source) && selectedModels.includes(e.target);
          return {
             ...e,
             animated: bothSelected || selectedModels.includes(e.source),
             style: {
                stroke: bothSelected ? '#6366f1' : '#cbd5e1',
                strokeWidth: bothSelected ? 2 : 1
             },
             markerEnd: {
                type: MarkerType.ArrowClosed,
                color: bothSelected ? '#6366f1' : '#cbd5e1',
             }
          }
       })
    );
  }, [selectedModels, setNodes, setEdges, onSelectionChange]);

  return (
    <div className={
        isFullscreen 
          ? "fixed inset-0 z-[100] bg-slate-50 w-screen h-screen flex flex-col" 
          : "w-full h-[600px] border border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative"
    }>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        className="bg-slate-50"
      >
        <Controls />
        <MiniMap zoomable pannable nodeColor={(node) => (node.data.isSelected ? '#6366f1' : '#cbd5e1')} />
        <Background color="#cbd5e1" gap={16} />
      </ReactFlow>
      
      {/* Float Selection indicator */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur pb-2 pt-3 px-4 rounded-xl shadow-lg border border-slate-200 z-10 pointer-events-none">
         <div className="text-xs font-bold text-slate-500 uppercase">Selected Models</div>
         <div className="text-2xl font-black text-indigo-600">{selectedModels.length}</div>
      </div>

      {/* Fullscreen Toggle */}
      <button 
         onClick={() => setIsFullscreen(!isFullscreen)}
         className="absolute top-4 right-4 bg-white/90 backdrop-blur p-2 rounded-xl shadow-lg border border-slate-200 z-10 hover:bg-slate-100 text-slate-600 transition-colors"
         title={isFullscreen ? "Exit Fullscreen" : "Expand to Fullscreen"}
      >
         {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
      </button>
    </div>
  );
}
