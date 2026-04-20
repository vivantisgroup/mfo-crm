'use client';
import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';

interface JsonTreeViewerProps {
  data: any;
  defaultExpanded?: boolean;
}

export default function JsonTreeViewer({ data, defaultExpanded = false }: JsonTreeViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const renderNode = (key: string | null, value: any, depth: number) => {
    // Basic types rendering mapping
    return <JsonNode keyName={key} value={value} depth={depth} searchTerm={searchTerm} defaultExpanded={defaultExpanded} />;
  };

  return (
    <div className="flex flex-col h-full bg-white border rounded">
      <div className="flex items-center gap-2 p-2 border-b bg-slate-50 sticky top-0 z-10 transition-colors focus-within:bg-indigo-50/30 object-contain">
        <Search className="w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          className="flex-1 bg-transparent border-none outline-none text-xs text-slate-700 placeholder:text-slate-400 font-mono"
          placeholder="Filter payload... (keys or values)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="p-3 overflow-auto flex-1 text-[11px] font-mono leading-relaxed bg-[#fdfdfd]">
        {renderNode(null, data, 0)}
      </div>
    </div>
  );
}

// Internal recursive node
function JsonNode({ 
  keyName, 
  value, 
  depth, 
  searchTerm, 
  defaultExpanded 
}: { 
  keyName: string | null; 
  value: any; 
  depth: number; 
  searchTerm: string; 
  defaultExpanded: boolean; 
}) {
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  
  const matchesSearch = useMemo(() => {
    if (!searchTerm) return false;
    const term = searchTerm.toLowerCase();
    if (keyName && keyName.toLowerCase().includes(term)) return true;
    if (!isObject && String(value).toLowerCase().includes(term)) return true;
    return false;
  }, [keyName, value, searchTerm, isObject]);

  // If there's a search term we auto expand all matching parent nodes, otherwise leverage default
  const [expanded, setExpanded] = useState(defaultExpanded || depth < 2);

  // Force expand if searching globally and children might match
  // For a perfect UX, we just let the manual search highlight
  React.useEffect(() => {
     if (searchTerm && depth < 3) {
        setExpanded(true);
     }
  }, [searchTerm, depth]);

  const toggle = () => setExpanded(!expanded);

  const renderValue = (val: any) => {
    if (val === null) return <span className="text-slate-400 italic">null</span>;
    if (typeof val === 'boolean') return <span className="text-purple-600 font-semibold">{val ? 'true' : 'false'}</span>;
    if (typeof val === 'number') return <span className="text-blue-600">{val}</span>;
    if (typeof val === 'string') return <span className="text-green-600 break-words">"{val}"</span>;
    return <span>{String(val)}</span>;
  };

  const getHighlight = (text: string) => {
     if (!searchTerm || !text.toLowerCase().includes(searchTerm.toLowerCase())) return <>{text}</>;
     const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
     return (
        <>
          {parts.map((part, i) => 
            part.toLowerCase() === searchTerm.toLowerCase() 
              ? <mark key={i} className="bg-yellow-200 text-slate-800 rounded px-0.5">{part}</mark>
              : part
          )}
        </>
     );
  };

  const pad = { paddingLeft: `${depth * 1.2}rem` };

  if (isObject) {
    const keys = Object.keys(value);
    const isEmpty = keys.length === 0;

    return (
      <div className="flex flex-col">
        <div 
          className="flex items-start gap-1 py-0.5 hover:bg-slate-100/50 cursor-pointer select-none group rounded px-1 transition-colors"
          style={pad}
          onClick={!isEmpty ? toggle : undefined}
        >
          {!isEmpty ? (
            <span className="text-slate-400 group-hover:text-slate-600 mt-0.5 flex-shrink-0 transition-transform">
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          ) : (
            <span className="w-3 h-3 mt-0.5 ml-1 flex-shrink-0 block" /> // Spacing alignment
          )}
          
          <div className="flex gap-1 break-words">
            {keyName && (
              <span className="text-pink-600 font-medium">
                {getHighlight(keyName)}: 
              </span>
            )}
            <span className="text-slate-500">
               {isArray ? '[' : '{'}
               {!expanded && !isEmpty && <span className="px-1 text-slate-400 tracking-widest text-[9px] relative -top-0.5">...</span>}
               {(!expanded || isEmpty) && (isArray ? ']' : '}')}
               <span className="ml-2 text-[10px] text-slate-300 group-hover:text-slate-400">
                 {!expanded && !isEmpty && `${isArray ? keys.length + ' items' : keys.length + ' keys'}`}
               </span>
            </span>
          </div>
        </div>

        {expanded && !isEmpty && (
          <div className="flex flex-col">
            {keys.map((k, i) => (
              <React.Fragment key={k}>
                <JsonNode 
                  keyName={isArray ? null : k} 
                  value={value[k as keyof typeof value]} 
                  depth={depth + 1} 
                  searchTerm={searchTerm}
                  defaultExpanded={defaultExpanded}
                />
              </React.Fragment>
            ))}
            <div style={pad} className="text-slate-500 hover:bg-slate-50 rounded pl-[22px] py-0.5 mt-0.5">
              {isArray ? ']' : '}'}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Primitive Leaf Node
  return (
    <div className={`flex gap-1 py-0.5 hover:bg-slate-100/60 rounded px-[22px] break-words transition-colors ${matchesSearch ? 'bg-yellow-50' : ''}`} style={pad}>
      {keyName && (
        <span className="text-pink-600 font-medium whitespace-nowrap">
          {getHighlight(keyName)}: 
        </span>
      )}
      <span className="font-mono text-slate-700">
         {searchTerm && typeof value === 'string' ? (
            <span className="text-green-600">
               "{getHighlight(value)}"
            </span>
         ) : renderValue(value)}
      </span>
    </div>
  );
}
