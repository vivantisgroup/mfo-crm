const fs = require('fs');
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/financial-engineer/components/AdvisorSimulator.tsx';
let txt = fs.readFileSync(file, 'utf8');

const targetStr = `            setNominalRate(data.nominal);
            onshoreTax = jRules.capGainsOnshore / 100;`;

const fixStr = `            setNominalRate(data.nominal);
            setInflation(data.infl);
            setVolatility(data.vol);
        }
    }
    setSmartAssistModal(null);
};

// --- FUNÇÕES DE TIMELINE GENÉRICAS ---
const addTimelinePhase = (stateSetter: any, list: any[], defaultValues: any) => {
    const lastPhase = list[list.length - 1];
    if (lastPhase.endAge >= jointLifeExpectancy) return;
    stateSetter([...list, { id: Date.now(), startAge: lastPhase.endAge + 1, endAge: jointLifeExpectancy, ...defaultValues }]);
};

const removeTimelinePhase = (stateSetter: any, list: any[], id: string) => {
    if (list.length <= 1) return;
    const newPhases = list.filter((p: any) => p.id !== id);
    newPhases[newPhases.length - 1].endAge = jointLifeExpectancy;
    stateSetter(newPhases);
};

const updateTimelinePhase = (stateSetter: any, list: any[], id: string, field: string, value: any) => {
    const newPhases = list.map((p: any) => p.id === id ? { ...p, [field]: value } : p);
    for (let i = 1; i < newPhases.length; i++) newPhases[i].startAge = newPhases[i - 1].endAge + 1;
    newPhases[newPhases.length - 1].endAge = jointLifeExpectancy;
    stateSetter(newPhases);
};

const updateMarketPhase = (id: string, field: string, value: any) => updateTimelinePhase(setMarketPhases, marketPhases, id, field, value);

// --- INTEGRAÇÃO COM IA GERATIVA (GEMINI API) ---
const handleGenerateAIStrategy = async () => {
    setIsGeneratingStrategy(true);
    setAiError('');
    setAiStrategyData(null);

    // Preparar o contexto atual do cliente para o prompt
    const clientContext = \`
      Moeda Base: \${currency}
      Patrimônio Atual: \${formatCurrency(initialCapital, currency)}
      Idade Titular: \${currentAge} | Expectativa de Vida Final: \${jointLifeExpectancy}
      Cônjuge Incluído: \${activeModules.family && hasSpouse ? 'Sim' : 'Não'}
      Número de Herdeiros: \${numberOfHeirs}
      
      Despesas (Burn Rate): 
      \${burnRateType === 'fixed' ? \\\`Base Fixa de \${formatCurrency(baseMonthlyExpense, currency)}/mês com curva de ajuste \${expenseCurve}\\\`
            : burnRateType === 'progressive' ? \\\`Começa em \${formatCurrency(baseMonthlyExpense, currency)} e termina em \${formatCurrency(endMonthlyExpense, currency)}\\\`
                : \\\`Fases Variáveis: \${JSON.stringify(variableExpenses)}\\\`}
    \`;

    try {
        const response = await fetch('/api/ai/simulator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'generateStrategy',
                clientContext: clientContext
            })
        });

        if (!response.ok) {
            throw new Error('Falha na comunicação com Roteador de IA');
        }

        const data = await response.json();
        setAiStrategyData(data.result);
    } catch (err: any) {
        setAiError(err.message || 'Erro desconhecido ao gerar estratégia');
    } finally {
        setIsGeneratingStrategy(false);
    }
};

// --- MOTOR DE SIMULAÇÃO CENTRAL ---
const runPath = useCallback((isMonteCarlo = false) => {
    let balance = initialCapital;
    const path = [];
    let isRuined = false;
    let ruinAge: number | null = null;

    const fee = managementFee / 100;
    const allocOff = activeModules.structures ? (allocationOffshore / 100) : 0;
    const allocOn = 1 - allocOff;

    for (let age = currentAge; age <= jointLifeExpectancy; age++) {
        if (balance <= 0) {
            if (!isRuined) { isRuined = true; ruinAge = age; }
            path.push({ age, balance: 0, phase: activeModules.geopolitics ? (residencyPhases.find((p: any) => age >= p.startAge && age <= p.endAge) || residencyPhases[residencyPhases.length - 1]) : { jurisdiction: 'BR' } });
            continue;
        }

        // Parâmetros de Mercado do Ano
        let mPhaseNominal = nominalRate;
        let mPhaseInfl = inflation;
        let mPhaseVol = volatility;

        if (marketStrategy === 'glidepath') {
            const mPhase = marketPhases.find((p: any) => age >= p.startAge && age <= p.endAge) || marketPhases[marketPhases.length - 1];
            mPhaseNominal = mPhase.nominalRate;
            mPhaseInfl = mPhase.inflation;
            mPhaseVol = mPhase.volatility;
        }

        const nominalNetFeePercent = mPhaseNominal - managementFee; // Taxa nominal líquida de Adm
        const inflDec = mPhaseInfl / 100;

        const { muLog, sigmaLog } = isMonteCarlo ? calculateLognormalParams(nominalNetFeePercent, mPhaseVol) : { muLog: 0, sigmaLog: 0 };

        // Impostos
        let onshoreTax = 0.15; let offshoreTax = 0.15; let currentPhase: any = { jurisdiction: 'BR' };
        if (activeModules.geopolitics) {
            currentPhase = residencyPhases.find((p: any) => age >= p.startAge && age <= p.endAge) || residencyPhases[residencyPhases.length - 1];
            const jRules = dbJurisdictions[currentPhase.jurisdiction];
            onshoreTax = jRules.capGainsOnshore / 100;`;

if (txt.includes(targetStr)) {
    txt = txt.replace(targetStr, fixStr);
    fs.writeFileSync(file, txt, 'utf8');
    console.log('Fixed file');
} else {
    console.log('Target string not found');
}
