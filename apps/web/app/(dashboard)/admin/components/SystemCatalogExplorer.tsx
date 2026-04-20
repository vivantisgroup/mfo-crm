'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { SystemCatalog } from '@/lib/customizationService';
import { fetchCollectionData } from '@/lib/systemCatalogDataService';
import { Search, Database, RefreshCw, Eye } from 'lucide-react';

interface Props {
  catalog: SystemCatalog;
}

export function SystemCatalogExplorer({ catalog }: Props) {
  const { tenant } = useAuth();
  const [activeCollection, setActiveCollection] = useState<string>('');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const collections = Object.keys(catalog.dataModels || {});

  useEffect(() => {
    if (collections.length > 0 && !activeCollection) {
      setActiveCollection(collections[0]);
    }
  }, [collections, activeCollection]);

  const loadData = async () => {
    if (!tenant?.id || !activeCollection) return;
    setLoading(true);
    const data = await fetchCollectionData(tenant.id, activeCollection);
    setRecords(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollection, tenant?.id]);

  if (!collections.length) {
    return <div className="p-4 text-center text-secondary border rounded-lg bg-surface">No schemas defined in the catalog yet.</div>;
  }

  const model = catalog.dataModels[activeCollection];

  return (
    <div className="border border-border rounded-lg bg-surface shadow-sm overflow-hidden flex flex-col md:flex-row h-[600px]">
      {/* Sidebar: Collections */}
      <div className="w-full md:w-64 border-r border-border bg-canvas flex flex-col">
        <div className="p-4 border-b border-border bg-surface font-semibold text-sm text-primary flex items-center gap-2">
          <Database size={16} /> Collections
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {collections.map(col => (
            <button
              key={col}
              onClick={() => { setActiveCollection(col); setSelectedRecord(null); }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                activeCollection === col 
                  ? 'bg-brand-50 text-brand-700 font-medium' 
                  : 'text-secondary hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {col}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Data Grid */}
      <div className="flex-1 flex flex-col bg-surface">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{activeCollection}</h3>
            <p className="text-xs text-secondary">{model?.fields?.length || 0} custom fields defined</p>
          </div>
          <button 
            onClick={loadData} 
            disabled={loading}
            className="btn btn-secondary btn-sm flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {selectedRecord ? (
          <div className="flex-1 overflow-auto flex flex-col">
             <div className="p-3 border-b border-border bg-canvas flex justify-between items-center">
               <span className="text-sm font-mono text-tertiary">Record: {selectedRecord._id}</span>
               <button onClick={() => setSelectedRecord(null)} className="text-xs text-brand-600 hover:underline">Back to List</button>
             </div>
             <pre className="p-4 text-xs font-mono bg-slate-900 text-brand-100 flex-1 m-0 overflow-auto">
               {JSON.stringify(selectedRecord, null, 2)}
             </pre>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center text-secondary">
            Loading {activeCollection} records...
          </div>
        ) : records.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-tertiary">
            <Database size={32} className="mb-2 opacity-50" />
            <p>No records found in this collection.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-canvas border-b border-border sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-semibold text-tertiary">ID</th>
                  {model?.fields?.slice(0, 4).map(f => (
                    <th key={f.id} className="px-4 py-3 font-semibold text-tertiary">{f.label || f.id}</th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-tertiary text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map(rec => (
                  <tr key={rec._id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-secondary">{rec._id}</td>
                    {model?.fields?.slice(0, 4).map(f => (
                      <td key={f.id} className="px-4 py-3 truncate max-w-[150px]">
                        {typeof rec[f.id] === 'object' ? JSON.stringify(rec[f.id]) : String(rec[f.id] || '')}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => setSelectedRecord(rec)}
                        className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
