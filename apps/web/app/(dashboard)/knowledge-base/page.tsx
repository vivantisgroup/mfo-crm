'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BookOpen, Search, Folder, Zap, ExternalLink, Globe, FileText, Database } from 'lucide-react';
import { usePageTitle } from '@/lib/PageTitleContext';
import toast from 'react-hot-toast';

interface Article {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  sourceUrl?: string;
  isAiGenerated: boolean;
  createdAt: string;
}

export default function KnowledgeBase() {
  const { tenant } = useAuth();
  const { setTitle } = usePageTitle();
  const [articles, setArticles] = useState<Article[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);

  useEffect(() => {
    setTitle('Advisory & Knowledge Hub', 'Base de dados jurídica e fiscal (Tributos, Estruturas Offshore, Wealth).');
  }, [setTitle]);

  useEffect(() => {
    if (!tenant) return;
    async function load() {
      try {
        const q = query(collection(db, 'tenants', tenant!.id, 'articles'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const arts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Article));
        setArticles(arts);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenant]);

  const categories = Array.from(new Set(articles.map(a => a.category)));

  const filtered = articles.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory ? a.category === selectedCategory : true;
    return matchesSearch && matchesCat;
  });

  const generateSeed = async (category: string) => {
    if (!tenant) return;
    const toastId = toast.loading(`Gerando artigos para ${category}...`);
    try {
      const res = await fetch('/api/ai/knowledge/seeder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, category, count: 5 })
      });
      if (!res.ok) throw new Error('Falha ao gerar');
      toast.success('Artigos gerados com sucesso!', { id: toastId });
      // Recarregar a página para ver os resultados
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  if (loading) {
     return <div className="p-8 text-slate-500 animate-pulse font-medium">Carregando Acervo Knowledge Base...</div>;
  }

  return (
    <div className="flex h-full bg-slate-50/50">
      {/* LEFT PORTION: Explorer */}
      <div className="w-1/3 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar leis, teses ou regulamentos..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100/50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-shadow"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 border-b border-slate-100 flex-shrink-0 flex gap-2 overflow-x-auto no-scrollbar">
          <button 
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md whitespace-nowrap transition-colors ${selectedCategory === null ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            onClick={() => setSelectedCategory(null)}
          >
            Todos
          </button>
          {categories.map(c => (
            <button 
              key={c}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md whitespace-nowrap transition-colors ${selectedCategory === c ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              onClick={() => setSelectedCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 opacity-60">
              <BookOpen size={32} className="mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-bold text-slate-600">Nenhum artigo encontrado</p>
            </div>
          ) : (
            filtered.map(art => (
              <div 
                key={art.id} 
                onClick={() => setActiveArticle(art)}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${activeArticle?.id === art.id ? 'bg-amber-50/50 border-amber-200 shadow-sm' : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{art.category}</span>
                  {art.isAiGenerated && (
                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50" title="Grounded AI Generation">
                      <Zap size={10} /> IA Agent
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-slate-800 text-sm leading-snug mb-1">{art.title}</h4>
                <p className="text-xs text-slate-500 line-clamp-2">{art.content.substring(0, 100)}...</p>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/80">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Database size={12} /> Seeding Engine</h4>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => generateSeed('Taxes / Tributário')} className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded font-bold transition-colors">Gerar Taxes</button>
            <button onClick={() => generateSeed('Offshore & Structuring')} className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded font-bold transition-colors">Gerar Offshore</button>
            <button onClick={() => generateSeed('Trusts & Foundations')} className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded font-bold transition-colors">Gerar Trusts</button>
            <button onClick={() => generateSeed('Probate & Herança')} className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded font-bold transition-colors">Gerar Probate</button>
            <button onClick={() => generateSeed('Philanthropy')} className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded font-bold transition-colors col-span-2">Gerar Philanthropy</button>
          </div>
          <p className="text-[9px] text-slate-400 mt-2 text-center">Gera 5 novos artigos jurídicos formatados via LLM.</p>
        </div>
      </div>

      {/* RIGHT PORTION: Reader */}
      <div className="w-2/3 flex flex-col h-full bg-slate-50 items-center justify-center overflow-hidden">
         {!activeArticle ? (
           <div className="text-center opacity-60 flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                 <FileText size={32} className="text-slate-400" />
              </div>
              <h2 className="text-lg font-bold text-slate-600">MFO Advisory Workspace</h2>
              <p className="text-sm font-medium text-slate-500 mt-1 max-w-sm">Selecione um artigo ou tese tributária para análise detalhada.</p>
           </div>
         ) : (
           <div className="w-full h-full overflow-y-auto w-full p-8 lg:p-12 animate-fade-in custom-scrollbar bg-white">
              <div className="max-w-3xl mx-auto">
                 <div className="flex items-center gap-3 mb-6">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                      {activeArticle.category}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {new Date(activeArticle.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                 </div>
                 
                 <h1 className="text-3xl font-extrabold text-slate-900 mb-8 leading-tight">{activeArticle.title}</h1>
                 
                 <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-a:text-amber-600 prose-img:rounded-xl mb-12">
                   {activeArticle.content.split('\\n').map((para, i) => {
                     // Check if it's a heading
                     if (para.startsWith('### ')) return <h3 key={i} className="text-xl mt-8 mb-4">{para.replace('### ', '')}</h3>;
                     if (para.startsWith('## ')) return <h2 key={i} className="text-2xl mt-10 mb-4">{para.replace('## ', '')}</h2>;
                     if (para.startsWith('- ')) return <li key={i} className="ml-4">{para.replace('- ', '')}</li>;
                     if (para.trim() === '') return <br key={i}/>;
                     
                     // Bold processing
                     let processedPara = para;
                     const boldRegex = /\\*\\*(.*?)\\*\\*/g;
                     if (boldRegex.test(para)) {
                         // Fallback for simple markdown
                     }
                     return <p key={i} className="mb-4">{para.replace(/\\*\\*/g, '')}</p>
                   })}
                 </div>

                 <div className="border-t border-slate-200 pt-8 mt-12 pb-12">
                   <div className="flex flex-col gap-4 bg-slate-50 p-6 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe size={16} className="text-slate-400" />
                        <h4 className="text-sm font-bold text-slate-700">Fontes & Referências</h4>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Este documento foi estruturado pelo motor <strong className="text-slate-700">MFO Advisory Copilot</strong> utilizando jurisprudência e doutrina publicamente acessíveis. Verifique legislações específicas (como Lei 14.754/23 para offshores).
                      </p>
                      {activeArticle.sourceUrl && (
                        <a href={activeArticle.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 mt-2">
                          Acessar Documento Fonte <ExternalLink size={12} />
                        </a>
                      )}
                      
                      <div className="flex gap-2 mt-4 flex-wrap">
                        {activeArticle.tags?.map(t => (
                          <span key={t} className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">#{t}</span>
                        ))}
                      </div>
                   </div>
                 </div>
              </div>
           </div>
         )}
      </div>
    </div>
  );
}
