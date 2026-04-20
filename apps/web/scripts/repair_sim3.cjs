const fs = require('fs');
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/financial-engineer/components/AdvisorSimulator.tsx';
let txt = fs.readFileSync(file, 'utf8');

const startTarget = '                                    < div className = "flex items-center justify-center relative" >';
const endTarget = '    reportConfig.chart && (';

const startIdx = txt.indexOf(startTarget);
const endIdx = txt.indexOf(endTarget, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const fixStr = `                                    <div className="flex items-center justify-center relative">
                                        <div className="w-48 h-48 rounded-full border-8 border-indigo-100 flex items-center justify-center flex-col shadow-inner bg-white">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Eficiência Sucessória</span>
                                            <span className="text-3xl font-black text-indigo-800">{(100 - simulationResults.successionData.effectiveRate).toFixed(1)}%</span>
                                            <span className="text-[10px] text-slate-400">retenção de riqueza</span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* SEÇÃO IA DO RELATÓRIO */}
                        {reportConfig.aiStrategy && aiStrategyData && (
                            <section className="mb-8 print:break-inside-avoid animate-in fade-in">
                                <h2 className="text-xl font-bold text-slate-800 border-b pb-2 flex items-center gap-2 uppercase tracking-wide">
                                    <BrainCircuit className="w-5 h-5 text-amber-500" /> Parecer Estratégico de Wealth Management
                                </h2>
                                <div className="mt-4 bg-amber-50 border border-amber-200 p-5 rounded-xl text-sm text-slate-800 leading-relaxed text-justify mb-6">
                                    <strong className="text-amber-900 block mb-1">Análise do Comitê (CIO):</strong>
                                    {aiStrategyData.generalGuideline}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {aiStrategyData.sCenarios.map((sCenario: any, index: number) => (
                                        <div key={index} className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm flex flex-col">
                                            <div className={\`p-3 text-center text-white font-bold uppercase tracking-wide text-xs \${sCenario.name === 'Conservador' ? 'bg-emerald-600' : sCenario.name === 'Moderado' ? 'bg-indigo-600' : 'bg-red-500'}\`}>
                                                Cenário {sCenario.name}
                                            </div>
                                            <div className="p-4 flex-1 flex flex-col gap-4 text-xs text-slate-700">
                                                <div>
                                                    <span className="font-bold text-slate-900 block mb-1">Alocação de Ativos:</span>
                                                    <span className="text-justify block">{sCenario.assetAllocation}</span>
                                                </div>
                                                <div className="border-t border-slate-100 pt-3">
                                                    <span className="font-bold text-slate-900 block mb-1">Estratégia Fiscal & Sucessão:</span>
                                                    <span className="text-justify block">{sCenario.taxAndSuccessionStrategy}</span>
                                                </div>
                                                <div className="mt-auto bg-slate-50 p-2 rounded text-center border border-slate-100">
                                                    <span className="font-bold text-slate-500 block text-[10px] uppercase">Retorno Nominal Alvo</span>
                                                    <span className="font-black text-slate-800 text-base">{sCenario.expectedNominalReturn}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

{
`;
    // Find the opening brace before reportConfig.chart
    let openBraceIdx = txt.lastIndexOf('{', endIdx);
    
    txt = txt.substring(0, startIdx) + fixStr + txt.substring(openBraceIdx + 1); // skip `{`
    fs.writeFileSync(file, txt, 'utf8');
    console.log("Replaced successfully!");
} else {
    console.log('Not found:', startIdx, endIdx);
}
