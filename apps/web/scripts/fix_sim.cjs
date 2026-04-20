const fs = require('fs');
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/financial-engineer/components/AdvisorSimulator.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const targetLine = "    const inventoryCost = finalBalance * inventoryRate;";
const insertIdx = lines.findIndex(l => l.includes(targetLine));

if(insertIdx > -1) {
    const block = `        const monthlyExpense = yearlyBaseExp / 12;
        const monthlyRate = Math.pow(1 + yearRealReturnPercentDec, 1 / 12) - 1;

        for (let m = 0; m < 12; m++) {
            if (balance > 0) { balance -= monthlyExpense; if (balance < 0) balance = 0; else balance = balance * (1 + monthlyRate); }
        }

        if (balance <= 0 && !isRuined) { isRuined = true; ruinAge = age; }
        path.push({ age, balance, phase: currentPhase, taxRate: blendedTaxRate });
    }
    return { path, isRuined, ruinAge, finalBalance: balance };
}, [initialCapital, currentAge, jointLifeExpectancy, nominalRate, inflation, managementFee, volatility, allocationOffshore, hasPIC, hasTrust, events, baseMonthlyExpense, endMonthlyExpense, expenseCurve, convertCurrency, currency, dbJurisdictions, picCostUSD, trustCostUSD, burnRateType, variableExpenses, activeModules, residencyPhases, marketStrategy, marketPhases]);

// --- MOTOR DE SUCESSÃO FINAL ---
const calculateSuccession = useCallback((finalBalance: number) => {
    if (finalBalance <= 0) return { netInheritance: 0, totalCosts: 0, inventoryCost: 0, itcmdCost: 0, effectiveRate: 0, jurisdictionDesc: '' };

    let inventoryRate = 0.06; let taxRate = 0.08; let jurisdictionDesc = 'Média Brasil (Sem Planeamento)';
    let taxableAmount = finalBalance;

    if (activeModules.geopolitics) {
        const finalPhase = residencyPhases[residencyPhases.length - 1];
        const jRules = dbJurisdictions[finalPhase.jurisdiction];
        if (finalPhase.jurisdiction === 'BR') {
            const uf = finalPhase.stateBR || 'SP';
            const ufData = BRAZIL_STATES[uf] || BRAZIL_STATES['SP'] || { name: 'São Paulo', itcmd: 4 };
            taxRate = ufData.itcmd / 100;
            jurisdictionDesc = \`Brasil (\${ufData.name})\`;
        } else {
            taxRate = (jRules.inheritanceTax || 0) / 100;
            jurisdictionDesc = jRules.name;
        }
        if (jRules.exemptionUSD > 0) {
            const exemptionInCurrentCurrency = convertCurrency(jRules.exemptionUSD, 'USD', currency);
            taxableAmount = Math.max(0, finalBalance - exemptionInCurrentCurrency);
        }
        if (finalPhase.jurisdiction === 'PT') taxRate = 0;
    }

    if (activeModules.structures) {
        if (hasTrust) { inventoryRate = 0.0; if (!activeModules.geopolitics || residencyPhases[residencyPhases.length - 1].jurisdiction === 'BR') taxRate = 0.0; }
        else if (hasPIC) { inventoryRate = 0.02; }
    }`;

    lines.splice(insertIdx, 0, block);
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Fixed exactly at line ' + insertIdx);
} else {
    console.log('Not found');
}
