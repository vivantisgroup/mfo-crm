const fs = require('fs');
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/financial-engineer/components/AdvisorSimulator.tsx';
let txt = fs.readFileSync(file, 'utf8');

// The messed up lines start with: '    const inventoryCost = finalBalance * inventoryRate;'
// up to: '                                     <div className="flex items-center justify-center relative">'
const brokenStartStr = '    const inventoryCost = finalBalance * inventoryRate;';
const brokenEndStr = '                                     <div className="flex items-center justify-center relative">';

let idxStarted = txt.indexOf(brokenStartStr);
let idxEnded = txt.indexOf(brokenEndStr);

if (idxStarted === -1 || idxEnded === -1) {
    console.error('Cannot find broken lines', idxStarted, idxEnded);
    process.exit(1);
}

// Ensure the start string is AFTER the main function implementation!
// Actually we only want to replace the SECOND occurrence of calculateSuccession code
idxStarted = txt.indexOf(brokenStartStr, txt.indexOf('showReport')); 

if (idxStarted === -1) {
    console.error('Did not find second occurrence!');
    process.exit(1);
}

const replacement = `                                </div>

                                {reportConfig.panorama && (
                                    <section className="mb-8 animate-in fade-in">
                                        <h2 className="text-xl font-bold text-slate-800 border-b pb-2 flex items-center gap-2 uppercase tracking-wide">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-indigo-700"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                            Sumário Executivo
                                        </h2>
                                        <div className="grid grid-cols-2 2xl:grid-cols-4 gap-4 mt-4 print:grid-cols-4">
                                            <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Patrimônio Base
                                                </span>
                                                <span className="block text-lg font-bold text-slate-800">
                                                    {formatCurrency(initialCapital, currency)}
                                                </span>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Horizonte do Plano
                                                </span>
                                                <span className="block text-lg font-bold text-slate-800">
                                                    {currentAge} aos {jointLifeExpectancy} anos
                                                </span>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Taxa de Consumo Inicial
                                                </span>
                                                <span className="block text-lg font-bold text-slate-800">
                                                    {burnRateType === 'fixed' ? formatCurrency(baseMonthlyExpense, currency) : burnRateType === 'progressive' ? 'Progressivo' : 'Variável (Fases)'}
                                                </span>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Índice de Preservação
                                                </span>
                                                <span className={\`block text-lg font-bold \${simulationResults.successRate >= 85 ? 'text-emerald-600' : 'text-red-600'}\`}>
                                                    {simulationResults.successRate.toFixed(0)}% Seguro
                                                </span>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {reportConfig.masterplan && (activeModules.geopolitics || activeModules.structures) && (
                                    <section className="mb-8 animate-in fade-in">
                                        <h2 className="text-xl font-bold text-slate-800 border-b pb-2 flex items-center gap-2 uppercase tracking-wide">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-indigo-700"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                            Engenharia Global & SPVs
                                        </h2>
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-700">
                                            {activeModules.geopolitics && (
                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                    <h3 className="font-bold text-slate-900 mb-2">Linha do Tempo Domiciliar</h3>
                                                    <div className="space-y-2">
                                                        {residencyPhases.map((phase, i) => (
                                                            <div key={i} className="flex justify-between items-center border-l-4 border-indigo-500 pl-3 py-1">
                                                                <span className="font-bold text-slate-700">
                                                                    {phase.startAge} - {phase.endAge}a
                                                                </span>
                                                                <span className="font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded">
                                                                    {dbJurisdictions[phase.jurisdiction].name} {phase.jurisdiction === 'BR' ? \`(\${BRAZIL_STATES[phase.stateBR || 'SP'].name})\` : ''}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {activeModules.structures && (
                                                <div className="space-y-4">
                                                    <div className="border border-slate-200 p-4 rounded-xl">
                                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">
                                                            Alocação Cambial Direta
                                                        </span>
                                                        <span className="block font-bold mt-1 text-emerald-600">
                                                            Onshore: {100 - allocationOffshore}% | Offshore: {allocationOffshore}%
                                                        </span>
                                                    </div>
                                                    <div className="border border-slate-200 p-4 rounded-xl">
                                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">
                                                            Status Fiduciário
                                                        </span>
                                                        <span className="block font-bold mt-1 text-slate-800">
                                                            PIC Internacional: {hasPIC ? 'Constituída' : 'Não Constituída'} | Trust: {hasTrust ? 'Constituído' : 'Não Constituído'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                )}

                                {reportConfig.succession && (
                                    <section className="bg-slate-50 border border-slate-200 p-6 rounded-xl mb-8 animate-in fade-in">
                                        <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2 uppercase tracking-wide">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-indigo-700"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                            Planejamento de Transição (Aos {jointLifeExpectancy} anos)
                                        </h2>
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div>
                                                <p className="text-sm text-slate-600 text-justify mb-4">
                                                    Com base no domicílio final simulado em <strong>{simulationResults.successionData.deathJurisdiction}</strong>, e assumindo o espólio (Cenário Base) de <strong>{formatCurrency(simulationResults.medianFinal, currency)}</strong>, calcula-se o seguinte impacto para os herdeiros:
                                                </p>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between border-b border-red-100 text-red-700">
                                                        <span>Carga Tributária (ITCMD / Estate Tax)</span>
                                                        <span className="font-bold">-{formatCurrency(simulationResults.successionData.itcmdCost, currency)}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b border-red-100 text-red-700">
                                                        <span>Fricção Jurídica (Probate / Honorários)</span>
                                                        <span className="font-bold">-{formatCurrency(simulationResults.successionData.inventoryCost, currency)}</span>
                                                    </div>
                                                    <div className="flex justify-between font-bold text-slate-800 pt-2 border-t-2 border-slate-300">
                                                        <span>Capital Líquido a Transferir</span>
                                                        <span className="text-indigo-700 text-lg">{formatCurrency(simulationResults.successionData.netInheritance, currency)}</span>
                                                    </div>
                                                </div>
                                            </div>
\n`;

txt = txt.substring(0, txt.lastIndexOf("                                </div>", idxStarted)) + replacement + txt.substring(idxEnded);
fs.writeFileSync(file, txt);
console.log('Repaired! Check file.');
