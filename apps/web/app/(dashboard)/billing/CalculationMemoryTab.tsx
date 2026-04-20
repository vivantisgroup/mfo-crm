import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, RefreshCcw, Save, Calculator } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

export default function CalculationMemoryTab({ tenantId, cycleId, row }: any) {
    const [items, setItems] = useState<any[]>(row.calculationMemoryItems || []);
    const [fxUsd, setFxUsd] = useState<number>(row.fxPtax || 5.2194);
    const [fxEur, setFxEur] = useState<number>(row.fxEur || 1.10);
    const [isSaving, setIsSaving] = useState(false);

    // If no items, we can optionally map an initial structure or leave it blank
    
    const addItem = (region: 'BR' | 'OFFSHORE') => {
        setItems([
            ...items,
            {
                id: uuidv4(),
                region,
                name: '',
                balance: 0,
                currency: region === 'BR' ? 'BRL' : 'USD',
                feeRate: 0.031, // Default quarterly rate based on Costa Verde example
                billedAmount: 0,
                billedCurrency: 'USD'
            }
        ]);
    };

    const updateItem = (id: string, field: string, value: any) => {
        setItems(items.map(it => {
            if (it.id !== id) return it;
            const updated = { ...it, [field]: value };
            
            // Auto-calculate billedAmount if balance or feeRate changes
            if (field === 'balance' || field === 'feeRate') {
                updated.billedAmount = (updated.balance || 0) * ((updated.feeRate || 0) / 100);
            }
            return updated;
        }));
    };

    const removeItem = (id: string) => {
        setItems(items.filter(it => it.id !== id));
    };

    const handleSyncToMatrix = async () => {
        setIsSaving(true);
        // Calculate Totals based on items structure
        
        let aumOnshore = 0;
        let aumOffshore = 0;
        let recUsd = 0;
        let recBrl = 0;
        let recEur = 0;

        items.forEach(it => {
            if (it.region === 'BR') {
                // Assuming BRL balance
                aumOnshore += (it.balance || 0);
            } else {
                // Assuming USD balance for simplicity, or we can look at it.currency
                aumOffshore += (it.balance || 0);
            }

            if (it.billedCurrency === 'USD') recUsd += (it.billedAmount || 0);
            if (it.billedCurrency === 'BRL') recBrl += (it.billedAmount || 0);
            if (it.billedCurrency === 'EUR') recEur += (it.billedAmount || 0);
        });

        try {
            await updateDoc(doc(db, 'tenants', tenantId, 'billing_cycles', cycleId, 'invoices', row.id), {
                calculationMemoryItems: items,
                fxPtax: fxUsd,
                fxEur: fxEur,
                aumOnshore,
                aumOffshore,
                recUsd,
                recBrl,
                recEur
            });
            // Show brief success somehow
            toast.error('Synced to Matrix Successfully!');
        } catch(e) {
            console.error(e);
            toast.error('Failed to sync. ' + e);
        }
        setIsSaving(false);
    };

    const brItems = items.filter(it => it.region === 'BR');
    const offItems = items.filter(it => it.region === 'OFFSHORE');

    const totalBrBalance = brItems.reduce((acc, it) => acc + (it.balance || 0), 0);
    const totalBrFee = brItems.reduce((acc, it) => acc + (it.billedAmount || 0), 0);

    const totalOffBalance = offItems.reduce((acc, it) => acc + (it.balance || 0), 0);
    const totalOffFee = offItems.reduce((acc, it) => acc + (it.billedAmount || 0), 0);

    const grandTotalAumUsd = (totalBrBalance / fxUsd) + totalOffBalance;
    const grandTotalFeeUsd = totalBrFee + totalOffFee;

    return (
        <div className="space-y-6">
            
            {/* Context & Global Rates */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Calculator size={16}/> Configuration & Rates</h3>
                    <p className="text-xs text-slate-500 mt-1">Setup the FX rates used to summarize the grand totals across currencies.</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dólar Ptax / FX USD</label>
                        <input type="number" step="0.0001" value={fxUsd} onChange={e => setFxUsd(parseFloat(e.target.value))} className="w-32 p-2 border border-slate-200 rounded text-sm outline-none focus:border-indigo-500 font-mono text-indigo-700 bg-slate-50" />
                    </div>
                </div>
            </div>

            {/* Region: BRASIL */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">Investimentos no Brasil</h3>
                    <button onClick={() => addItem('BR')} className="text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded flex items-center gap-1 hover:bg-slate-50 text-slate-700 shadow-sm">
                        <Plus size={14} /> Add Line
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap table-fixed">
                        <thead className="bg-[#f8fafc] text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="p-3 w-[250px] font-bold">Investimentos</th>
                                <th className="p-3 w-[150px] font-bold text-right">Saldo Final (BRL)</th>
                                <th className="p-3 w-[120px] font-bold text-right">Fee Trimestral %</th>
                                <th className="p-3 w-[150px] font-bold text-right border-l border-slate-200 bg-[#f1f5f9]">Montante Billing</th>
                                <th className="p-3 w-[80px] font-bold text-center">Curr.</th>
                                <th className="w-[50px]"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {brItems.map(it => (
                                <tr key={it.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <td className="p-2 border-r border-slate-100">
                                        <input type="text" value={it.name} onChange={e => updateItem(it.id, 'name', e.target.value)} placeholder="e.g. Itaú Unibanco" className="w-full outline-none bg-transparent" />
                                    </td>
                                    <td className="p-2 border-r border-slate-100">
                                        <input type="number" value={it.balance} onChange={e => updateItem(it.id, 'balance', parseFloat(e.target.value))} className="w-full outline-none bg-transparent text-right font-mono" />
                                    </td>
                                    <td className="p-2 border-r border-slate-100">
                                        <input type="number" step="0.001" value={it.feeRate} onChange={e => updateItem(it.id, 'feeRate', parseFloat(e.target.value))} className="w-full outline-none bg-transparent text-right font-mono text-amber-700" />
                                    </td>
                                    <td className="p-2 bg-[#f8fafc] border-r border-slate-100">
                                        <input type="number" value={it.billedAmount} onChange={e => updateItem(it.id, 'billedAmount', parseFloat(e.target.value))} className="w-full outline-none bg-transparent text-right font-mono font-bold text-emerald-700" />
                                    </td>
                                    <td className="p-2">
                                        <select value={it.billedCurrency} onChange={e => updateItem(it.id, 'billedCurrency', e.target.value)} className="w-full outline-none bg-transparent text-xs font-bold text-slate-500">
                                            <option value="USD">US$</option>
                                            <option value="BRL">R$</option>
                                            <option value="EUR">€</option>
                                        </select>
                                    </td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => removeItem(it.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                                    </td>
                                </tr>
                            ))}
                            {brItems.length === 0 && (
                                <tr><td colSpan={6} className="p-4 text-center text-slate-400 text-xs">No records added.</td></tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                            <tr>
                                <td className="p-3">Total — Brasil</td>
                                <td className="p-3 text-right font-mono">R$ {formatCurrency(totalBrBalance)}</td>
                                <td></td>
                                <td className="p-3 text-right font-mono text-emerald-800 bg-[#f1f5f9] border-l border-slate-200 border-r">{formatCurrency(totalBrFee)}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Region: OFFSHORE */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">Investimentos Internacionais (Offshore)</h3>
                    <button onClick={() => addItem('OFFSHORE')} className="text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded flex items-center gap-1 hover:bg-slate-50 text-slate-700 shadow-sm">
                        <Plus size={14} /> Add Line
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap table-fixed">
                        <thead className="bg-[#f8fafc] text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="p-3 w-[250px] font-bold">Investimentos</th>
                                <th className="p-3 w-[150px] font-bold text-right">Saldo Final (USD)</th>
                                <th className="p-3 w-[120px] font-bold text-right">Fee Trimestral %</th>
                                <th className="p-3 w-[150px] font-bold text-right border-l border-slate-200 bg-[#f1f5f9]">Montante Billing</th>
                                <th className="p-3 w-[80px] font-bold text-center">Curr.</th>
                                <th className="w-[50px]"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {offItems.map(it => (
                                <tr key={it.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <td className="p-2 border-r border-slate-100">
                                        <input type="text" value={it.name} onChange={e => updateItem(it.id, 'name', e.target.value)} placeholder="e.g. UBS Zurich" className="w-full outline-none bg-transparent" />
                                    </td>
                                    <td className="p-2 border-r border-slate-100">
                                        <input type="number" value={it.balance} onChange={e => updateItem(it.id, 'balance', parseFloat(e.target.value))} className="w-full outline-none bg-transparent text-right font-mono" />
                                    </td>
                                    <td className="p-2 border-r border-slate-100">
                                        <input type="number" step="0.001" value={it.feeRate} onChange={e => updateItem(it.id, 'feeRate', parseFloat(e.target.value))} className="w-full outline-none bg-transparent text-right font-mono text-amber-700" />
                                    </td>
                                    <td className="p-2 bg-[#f8fafc] border-r border-slate-100">
                                        <input type="number" value={it.billedAmount} onChange={e => updateItem(it.id, 'billedAmount', parseFloat(e.target.value))} className="w-full outline-none bg-transparent text-right font-mono font-bold text-emerald-700" />
                                    </td>
                                    <td className="p-2 text-center">
                                         <select value={it.billedCurrency} onChange={e => updateItem(it.id, 'billedCurrency', e.target.value)} className="w-full outline-none bg-transparent text-xs font-bold text-slate-500">
                                            <option value="USD">US$</option>
                                            <option value="BRL">R$</option>
                                            <option value="EUR">€</option>
                                        </select>
                                    </td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => removeItem(it.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                                    </td>
                                </tr>
                            ))}
                            {offItems.length === 0 && (
                                <tr><td colSpan={6} className="p-4 text-center text-slate-400 text-xs">No records added.</td></tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                            <tr>
                                <td className="p-3">Total — Offshore</td>
                                <td className="p-3 text-right font-mono">US$ {formatCurrency(totalOffBalance)}</td>
                                <td></td>
                                <td className="p-3 text-right font-mono text-emerald-800 bg-[#f1f5f9] border-l border-slate-200 border-r">{formatCurrency(totalOffFee)}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Consolidation Panel */}
            <div className="bg-[#fffbeb] border border-amber-200 shadow-sm rounded-xl p-5">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 className="font-black text-amber-900 text-lg">Total Geral Aplicado</h3>
                        <p className="text-xs text-amber-700 mt-1 max-w-lg">
                            Esses são os números finais consolidados gerados por essa memória de cálculo. 
                            Certifique-se de que correspondem às expectativas antes de sincronizar com a Matrix de Faturamento.
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-4 justify-end mb-2">
                           <span className="text-sm font-bold text-amber-800">Total AUM (em USD):</span>
                           <span className="text-xl font-black text-amber-950 font-mono">US$ {formatCurrency(grandTotalAumUsd)}</span>
                        </div>
                        <div className="flex items-center gap-4 justify-end border-t border-amber-200/50 pt-2">
                           <span className="text-sm font-bold text-emerald-700">Total Fee Faturado (em USD):</span>
                           <span className="text-2xl font-black text-emerald-900 font-mono">US$ {formatCurrency(grandTotalFeeUsd)}</span>
                        </div>
                    </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                    <button 
                        onClick={handleSyncToMatrix} 
                        disabled={isSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-bold shadow-md transition-all flex items-center gap-2"
                    >
                        {isSaving ? <RefreshCcw size={18} className="animate-spin" /> : <Save size={18} />}
                        Sync Generated Values to Billing Matrix
                    </button>
                </div>
            </div>

        </div>
    )
}
