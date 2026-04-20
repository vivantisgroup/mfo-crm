'use client';

import React, { useState, useEffect } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { Card, CardContent } from '@/components/ui/card';
import { Globe2, Map as MapIcon, DollarSign, Bitcoin, Search, Loader2, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export default function NativeMarketScreener() {
  const { setTitle } = usePageTitle();
  const [activeTab, setActiveTab] = useState<'brazil'|'america'|'bonds'|'crypto'>('brazil');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  // Advanced Filters
  const [bondsMinYtm, setBondsMinYtm] = useState('');
  const [bondsRisk, setBondsRisk] = useState('');
  
  const [tvSortBy, setTvSortBy] = useState('market_cap_basic');
  const [tvSortOrder, setTvSortOrder] = useState<'desc'|'asc'>('desc');

  useEffect(() => {
    setTitle('Market Screener', 'Pesquisa Global Real-time: Equities, Crypto e Renda Fixa (BondbloX).');
  }, [setTitle]);

  useEffect(() => {
    const fetchScreener = async () => {
      setLoading(true);
      try {
        if (activeTab === 'bonds') {
          // Busca Bonds In-Memory / Banco Otimizado
          const qs = new URLSearchParams();
          if (query) qs.append('q', query);
          if (bondsMinYtm) qs.append('minYtm', bondsMinYtm);
          if (bondsRisk) qs.append('risk', bondsRisk);

          const res = await fetch(`/api/finance/bondblox?${qs.toString()}`);
          const json = await res.json();
          setResults(json.results || []);
        } else {
          // Busca TradingView via Real-time Proxy
          const body = {
            filter: query ? [{ left: "name,description", operation: "match", right: query }] : [],
            options: { lang: "en" },
            columns: ["name", "description", "close", "change", "volume", "market_cap_basic", "Recommend.All", "P_E_ratio"],
            sort: { sortBy: tvSortBy, sortOrder: tvSortOrder },
            range: [0, 50]
          };
          const res = await fetch(`/api/finance/scanner?market=${activeTab}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const json = await res.json();
          // Converter formato array do TV para objetos legíveis
          if (json.data) {
             const mapped = json.data.map((item: any) => {
               const d = item.d;
               return {
                  id: item.s,
                  symbol: d[0],
                  name: d[1],
                  price: d[2],
                  change: d[3],
                  volume: d[4],
                  marketCap: d[5],
                  rating: d[6] !== null ? d[6] : 0,
                  peRatio: d[7]
               };
             });
             setResults(mapped);
          } else {
             setResults([]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce nativo manual (para poupar dependencias extras se não configurado)
    const timeout = setTimeout(fetchScreener, 400);
    return () => clearTimeout(timeout);
  }, [activeTab, query, bondsMinYtm, bondsRisk, tvSortBy, tvSortOrder]);

  // Função auxiliar de renderização Recommendation do TV
  const getTVRating = (val: number | string) => {
    if (typeof val === 'string') return { text: val, classes: 'bg-slate-100 text-slate-700 font-medium' };
    if (val === null || val === 0) return { text: 'Neutral', classes: 'bg-slate-100 text-slate-700 font-medium' };
    if (val > 0.5) return { text: 'Strong Buy', classes: 'bg-blue-100 text-blue-700 font-bold' };
    if (val > 0.1) return { text: 'Buy', classes: 'bg-emerald-100 text-emerald-700 font-bold' };
    if (val < -0.5) return { text: 'Strong Sell', classes: 'bg-red-100 text-red-700 font-bold' };
    if (val < -0.1) return { text: 'Sell', classes: 'bg-orange-100 text-orange-700 font-bold' };
    return { text: 'Neutral', classes: 'bg-slate-100 text-slate-700 font-medium' };
  };

  const formatNumber = (num: number) => {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num?.toFixed(2) || '-';
  };

  return (
    <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8 bg-slate-50/50 min-h-screen relative pb-10">
      
      <header className="mb-6 pt-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-slate-900 border-none pb-0">
              Mercados
            </h1>
            <p className="text-sm text-slate-500">Busca nativa de baixa latência interconectada via API Proxy.</p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
             <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-14 pr-12 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 sm:text-sm shadow-sm transition-all"
            placeholder={`Busque ${activeTab === 'bonds' ? 'bonds (Ex: Vale, Odebrecht, US10Y)' : 'ativos (Ex: PETR4, AAPL)'}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && (
             <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
               <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
             </div>
          )}
        </div>

        {/* Advanced Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          {activeTab === 'bonds' ? (
            <>
               <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 shadow-sm" value={bondsMinYtm} onChange={e => setBondsMinYtm(e.target.value)}>
                 <option value="">Qualquer Rendimento (YTM)</option>
                 <option value="5">&gt; 5% YTM</option>
                 <option value="8">&gt; 8% YTM</option>
                 <option value="12">&gt; 12% YTM</option>
               </select>
               <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 shadow-sm" value={bondsRisk} onChange={e => setBondsRisk(e.target.value)}>
                 <option value="">Qualquer Risco / Rating</option>
                 <option value="low">Baixo Risco (Investment Grade)</option>
                 <option value="medium">Médio Risco (BB)</option>
                 <option value="high">Alto Risco (High Yield/B/CCC)</option>
                 <option value="unrated">Sem Rating (Unrated)</option>
               </select>
            </>
          ) : (
            <>
               <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 shadow-sm" value={tvSortBy} onChange={e => setTvSortBy(e.target.value)}>
                 <option value="market_cap_basic">Ordernar por Market Cap</option>
                 <option value="volume">Ordenar por Volume</option>
                 <option value="change">Ordenar por Variação (%)</option>
                 <option value="name">Ordenar por Nome</option>
               </select>
               <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 shadow-sm" value={tvSortOrder} onChange={e => setTvSortOrder(e.target.value as any)}>
                 <option value="desc">Decrescente</option>
                 <option value="asc">Crescente</option>
               </select>
            </>
          )}
        </div>

         <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-2 flex flex-wrap gap-2">
            <button 
                onClick={() => setActiveTab('brazil')}
                className={`px-4 py-2 font-semibold text-sm transition-colors flex items-center gap-2 rounded-lg ${activeTab === 'brazil' ? 'bg-indigo-50 border border-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            >
                <MapIcon size={16} /> Ações Brasil (B3)
            </button>
            <button 
                onClick={() => setActiveTab('america')}
                className={`px-4 py-2 font-semibold text-sm transition-colors flex items-center gap-2 rounded-lg ${activeTab === 'america' ? 'bg-indigo-50 border border-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            >
                <Globe2 size={16} /> Ações Globais (US)
            </button>
            <button 
                onClick={() => setActiveTab('bonds')}
                className={`px-4 py-2 font-semibold text-sm transition-colors flex items-center gap-2 rounded-lg ${activeTab === 'bonds' ? 'bg-indigo-50 border border-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            >
                <DollarSign size={16} /> Títulos & Fractional Bonds
            </button>
            <button 
                onClick={() => setActiveTab('crypto')}
                className={`px-4 py-2 font-semibold text-sm transition-colors flex items-center gap-2 rounded-lg ${activeTab === 'crypto' ? 'bg-indigo-50 border border-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            >
                <Bitcoin size={16} /> Criptoativos
            </button>
         </div>
      </header>

      <Card className="rounded-xl overflow-hidden border-slate-200 shadow-sm">
         <CardContent className="p-0 overflow-x-auto">
             <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4 font-semibold tracking-wider">Ativo / Empresa</th>
                        <th className="px-6 py-4 font-semibold tracking-wider text-right">Preço</th>
                        <th className="px-6 py-4 font-semibold tracking-wider text-right">Variação / Rendimento</th>
                        <th className="px-6 py-4 font-semibold tracking-wider text-right">Métricas Técnicas</th>
                        <th className="px-6 py-4 font-semibold tracking-wider text-right">Sinalização</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {results.length === 0 && !loading && (
                        <tr>
                            <td colSpan={5} className="text-center py-12 text-slate-400">
                                Nenhum resultado encontrado para "{query}".
                            </td>
                        </tr>
                    )}
                    {results.map((item, idx) => {
                        // Tratar rendering misto (TV vs BondBlox)
                        const isBond = activeTab === 'bonds';
                        
                        const symbol = item.symbol || item.id;
                        const name = item.name || item.issuer;
                        const price = isBond ? item.price : item.price;
                        
                        // % Change (Equities) or Coupon (Bonds)
                        const changeLabel = isBond ? `Cupom: ${item.coupon}%` : (item.change ? `${item.change > 0 ? '+' : ''}${item.change.toFixed(2)}%` : '-');
                        const changeColor = !isBond && item.change 
                            ? (item.change > 0 ? 'text-emerald-600' : (item.change < 0 ? 'text-red-600' : 'text-slate-600')) 
                            : 'text-slate-600';

                        // Metricas Tecnicas
                        const metricLabel = isBond 
                            ? `YTM: ${item.ytm ? parseFloat(item.ytm).toFixed(2)+ '%' : 'N/A'} • Maturidade: ${item.maturity}`
                            : `Vol: ${item.volume ? formatNumber(item.volume) : '-'} • Mkt Cap: ${item.marketCap ? formatNumber(item.marketCap) : '-'}`;

                        // Rating
                        const ratingInfo = isBond 
                            ? { text: `Rating: ${item.rating || 'N/A'}`, classes: 'bg-slate-100 text-slate-700' }
                            : getTVRating(item.rating);

                        return (
                            <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                               <a 
                                                  href={isBond ? `https://bondblox.com/trade-bonds/listed-bonds/${symbol}` : `https://www.tradingview.com/symbols/${encodeURIComponent((item.id || symbol).replace(':', '-'))}/`} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer"
                                                  className="font-bold text-slate-800 hover:text-indigo-600 hover:underline transition-colors cursor-pointer"
                                               >
                                                  {symbol}
                                               </a>
                                               {isBond && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-widest">{item.sector || 'CORP'}</span>}
                                            </div>
                                            <span className="text-xs text-slate-500 mt-0.5 truncate max-w-[250px]" title={name}>{name}</span>
                                            
                                            {/* TradingView Discovery Links */}
                                               <div className="flex gap-2 mt-2">
                                                  {['Overview', 'Financials', 'News', 'Technicals', 'Bonds', 'ETFs'].map(tab => {
                                                     const tvPath = tab === 'Overview' ? '' : `${tab.toLowerCase()}/`;
                                                     return (
                                                        <a 
                                                          key={tab}
                                                          href={`https://www.tradingview.com/symbols/${encodeURIComponent((item.id || symbol).replace(':', '-'))}/${tvPath}`}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded transition-colors"
                                                        >
                                                           {tab}
                                                        </a>
                                                     );
                                                  })}
                                               </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-slate-700">
                                    {price ? price.toFixed(2) : '-'}
                                </td>
                                <td className={`px-6 py-4 text-right font-semibold flex items-center justify-end gap-1 ${changeColor}`}>
                                    {!isBond && item.change > 0 && <ArrowUpRight size={14} />}
                                    {!isBond && item.change < 0 && <ArrowDownRight size={14} />}
                                    {changeLabel}
                                </td>
                                <td className="px-6 py-4 text-right text-slate-500 font-mono text-xs">
                                    {metricLabel}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className={`px-2.5 py-1 rounded-full text-xs inline-flex items-center gap-1 ${ratingInfo.classes}`}>
                                        {!isBond && <Activity size={12} />}
                                        {ratingInfo.text}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
             </table>
         </CardContent>
      </Card>
      
    </div>
  );
}
