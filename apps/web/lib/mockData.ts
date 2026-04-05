import type {
  Family, FamilyMember, Entity, Activity, Task, Document, Holding,
  PrivateInvestment, CapitalCall, AllocationSlice, ConsolidatedBalanceSheet,
  PerformancePoint, GovernanceMeeting, Vote, EstatePlan, ServiceRequest,
  PlatformUser, AuditLogEntry, DashboardStats, GovernanceStructure, Transaction, Account,
  ServiceProvider, NetworkNode, RelationshipEdge,
  SuitabilityQuestion, SuitabilityConfig, SuitabilityAuditRecord,
  SuitabilityAssessment, InvestmentProposal, ResearchNote, CashPosition, RiskProfile,
  TaskQueue, TaskType, TimeEntry,
} from './types';

// ─── Service Providers ────────────────────────────────────────────────────

export const SERVICE_PROVIDERS: ServiceProvider[] = [
  { id: 'sp-001', providerType: 'attorney', firmName: 'Martin & Associates', contactName: 'David Martin', email: 'david@martinlaw.ky', jurisdiction: 'Cayman Islands', specialty: ['Trust Law', 'Estate Planning'] },
  { id: 'sp-002', providerType: 'accountant', firmName: 'PwC Private', contactName: 'Sarah Jenkins', email: 's.jenkins@pwc.com', jurisdiction: 'USA', specialty: ['Tax Structuring'] },
  { id: 'sp-003', providerType: 'banker', firmName: 'Morgan Stanley', contactName: 'Michael Chen', email: 'm.chen@morganstanley.com', jurisdiction: 'USA', specialty: ['Wealth Management'] },
  { id: 'sp-004', providerType: 'attorney', firmName: 'Carey Olsen', contactName: 'Rebecca Hughes', jurisdiction: 'BVI', specialty: ['Corporate Structuring'] },
  { id: 'sp-005', providerType: 'banker', firmName: 'Julius Bär', contactName: 'Thomas Weber', jurisdiction: 'Switzerland', specialty: ['Private Banking'] },
];

export const NETWORK_NODES: NetworkNode[] = [
  // Smith Family (fam-001) Nodes
  { id: 'node-fam-001', name: 'Smith Family', nodeType: 'family', familyId: 'fam-001' },
  { id: 'node-mem-001', name: 'Robert Smith', nodeType: 'member', subType: 'Patriarch', familyId: 'fam-001' },
  { id: 'node-mem-002', name: 'Margaret Smith', nodeType: 'member', subType: 'Matriarch', familyId: 'fam-001' },
  { id: 'node-mem-003', name: 'James Smith', nodeType: 'member', subType: 'Beneficiary', familyId: 'fam-001' },
  { id: 'node-mem-004', name: 'Claire Smith', nodeType: 'member', subType: 'Beneficiary', familyId: 'fam-001' },
  { id: 'node-ent-001', name: 'Smith Family Trust', nodeType: 'entity', subType: 'trust', familyId: 'fam-001' },
  { id: 'node-ent-002', name: 'Smith Ventures LLC', nodeType: 'entity', subType: 'llc', familyId: 'fam-001' },
  // Providers — each has a groupKey linking contacts to their institution
  { id: 'node-sp-001', name: 'David Martin', nodeType: 'provider', subType: 'Attorney', groupKey: 'firm-martin', groupLabel: 'Martin & Associates' },
  { id: 'node-sp-002', name: 'Sarah Jenkins', nodeType: 'provider', subType: 'Accountant', groupKey: 'firm-pwc', groupLabel: 'PwC Private' },
  { id: 'node-sp-003', name: 'Michael Chen', nodeType: 'provider', subType: 'Banker', groupKey: 'firm-ms', groupLabel: 'Morgan Stanley' },
  // A second contact at Morgan Stanley to show collapse benefit
  { id: 'node-sp-003b', name: 'Lisa Wong', nodeType: 'provider', subType: 'Banker', groupKey: 'firm-ms', groupLabel: 'Morgan Stanley' },

  // Rodriguez Family (fam-002) Nodes
  { id: 'node-fam-002', name: 'Rodríguez Family', nodeType: 'family', familyId: 'fam-002' },
  { id: 'node-mem-005', name: 'Eduardo Rodríguez', nodeType: 'member', subType: 'Patriarch', familyId: 'fam-002' },
  { id: 'node-ent-004', name: 'GR Holdings BVI', nodeType: 'entity', subType: 'corporation', familyId: 'fam-002' },
  { id: 'node-sp-004', name: 'Rebecca Hughes', nodeType: 'provider', subType: 'Attorney', groupKey: 'firm-carey', groupLabel: 'Carey Olsen' },
];


export const RELATIONSHIP_EDGES: RelationshipEdge[] = [
  // Smith Relationships
  { id: 'edge-001', sourceId: 'node-mem-001', targetId: 'node-mem-002', relationType: 'married_to' },
  { id: 'edge-002', sourceId: 'node-mem-001', targetId: 'node-mem-003', relationType: 'parent_of' },
  { id: 'edge-003', sourceId: 'node-mem-001', targetId: 'node-mem-004', relationType: 'parent_of' },
  { id: 'edge-004', sourceId: 'node-mem-001', targetId: 'node-ent-001', relationType: 'trustee_of', note: 'Co-Trustee' },
  { id: 'edge-005', sourceId: 'node-mem-002', targetId: 'node-ent-001', relationType: 'trustee_of', note: 'Co-Trustee' },
  { id: 'edge-006', sourceId: 'node-ent-001', targetId: 'node-mem-003', relationType: 'beneficiary_of' },
  { id: 'edge-007', sourceId: 'node-ent-001', targetId: 'node-mem-004', relationType: 'beneficiary_of' },
  { id: 'edge-008', sourceId: 'node-ent-001', targetId: 'node-ent-002', relationType: 'owns', note: '100% Shareholder' },
  { id: 'edge-009', sourceId: 'node-sp-001', targetId: 'node-ent-001', relationType: 'advises', note: 'Trust formation & ongoing counsel' },
  { id: 'edge-010', sourceId: 'node-sp-002', targetId: 'node-ent-002', relationType: 'advises', note: 'Annual K-1 prep' },
  { id: 'edge-011', sourceId: 'node-sp-003', targetId: 'node-ent-001', relationType: 'advises', note: 'Manages liquid equity portfolio' },
  { id: 'edge-011b', sourceId: 'node-sp-003b', targetId: 'node-ent-002', relationType: 'advises', note: 'Private equity advisory' },

  
  // Rodriguez Relationships
  { id: 'edge-012', sourceId: 'node-mem-005', targetId: 'node-ent-004', relationType: 'owns', note: 'Beneficial Owner' },
  { id: 'edge-013', sourceId: 'node-sp-004', targetId: 'node-ent-004', relationType: 'advises', note: 'Registered Agent & Corporate Counsel' },
];

// ─── Families ─────────────────────────────────────────────────────────────

export const FAMILIES: Family[] = [
  {
    id: 'fam-001',
    name: 'Smith Family',
    code: 'SMITH-001',
    inceptionDate: '2015-03-01',
    domicileCountry: 'USA',
    riskProfile: 'growth',
    serviceTier: 'platinum',
    assignedRmId: 'usr-rm-001',
    assignedRmName: 'Alexandra Torres',
    kycStatus: 'approved',
    amlStatus: 'clear',
    totalAum: 120_400_000,
    currency: 'USD',
    lastActivityAt: '2026-03-18T14:30:00Z',
    members: [
      { id: 'mem-001', familyId: 'fam-001', firstName: 'Robert', lastName: 'Smith', dateOfBirth: '1958-07-14', nationality: ['US'], roleInFamily: 'Patriarch', generation: 1, email: 'r.smith@smithventures.com', kycStatus: 'approved', pepFlag: false },
      { id: 'mem-002', familyId: 'fam-001', firstName: 'Margaret', lastName: 'Smith', dateOfBirth: '1962-11-03', nationality: ['US', 'GB'], roleInFamily: 'Matriarch', generation: 1, email: 'm.smith@smithventures.com', kycStatus: 'approved', pepFlag: false },
      { id: 'mem-003', familyId: 'fam-001', firstName: 'James', lastName: 'Smith', dateOfBirth: '1988-04-22', nationality: ['US'], roleInFamily: 'Beneficiary', generation: 2, email: 'james.smith@gmail.com', kycStatus: 'approved', pepFlag: false },
      { id: 'mem-004', familyId: 'fam-001', firstName: 'Claire', lastName: 'Smith', dateOfBirth: '1991-09-15', nationality: ['US'], roleInFamily: 'Beneficiary', generation: 2, email: 'claire.smith@gmail.com', kycStatus: 'in_review', pepFlag: false },
    ],
    entities: [
      { id: 'ent-001', familyId: 'fam-001', name: 'Smith Family Trust', entityType: 'trust', jurisdiction: 'Cayman Islands', currency: 'USD', status: 'active', totalValue: 78_000_000 },
      { id: 'ent-002', familyId: 'fam-001', name: 'Smith Ventures LLC', entityType: 'llc', jurisdiction: 'Delaware, USA', currency: 'USD', status: 'active', totalValue: 28_200_000 },
      { id: 'ent-003', familyId: 'fam-001', name: 'Redwood Foundation', entityType: 'foundation', jurisdiction: 'Switzerland', currency: 'CHF', status: 'active', totalValue: 14_200_000 },
    ],
  },
  {
    id: 'fam-002',
    name: 'Rodríguez Family',
    code: 'RODZ-002',
    inceptionDate: '2018-06-15',
    domicileCountry: 'Mexico',
    riskProfile: 'conservative',
    serviceTier: 'gold',
    assignedRmId: 'usr-rm-002',
    assignedRmName: 'Carlos Mendes',
    kycStatus: 'approved',
    amlStatus: 'clear',
    totalAum: 76_800_000,
    currency: 'USD',
    lastActivityAt: '2026-03-17T10:00:00Z',
    members: [
      { id: 'mem-005', familyId: 'fam-002', firstName: 'Eduardo', lastName: 'Rodríguez', dateOfBirth: '1952-02-28', nationality: ['MX'], roleInFamily: 'Patriarch', generation: 1, email: 'e.rodriguez@gruporodriguez.mx', kycStatus: 'approved', pepFlag: true },
      { id: 'mem-006', familyId: 'fam-002', firstName: 'Lucia', lastName: 'Rodríguez', dateOfBirth: '1955-05-12', nationality: ['MX', 'ES'], roleInFamily: 'Matriarch', generation: 1, kycStatus: 'approved', pepFlag: false },
      { id: 'mem-007', familyId: 'fam-002', firstName: 'Andrés', lastName: 'Rodríguez', dateOfBirth: '1980-12-05', nationality: ['MX', 'US'], roleInFamily: 'Beneficiary', generation: 2, email: 'andres.r@gmail.com', kycStatus: 'approved', pepFlag: false },
    ],
    entities: [
      { id: 'ent-004', familyId: 'fam-002', name: 'GR Holdings BVI', entityType: 'corporation', jurisdiction: 'British Virgin Islands', currency: 'USD', status: 'active', totalValue: 52_000_000 },
      { id: 'ent-005', familyId: 'fam-002', name: 'Rodríguez Real Estate SL', entityType: 'corporation', jurisdiction: 'Spain', currency: 'EUR', status: 'active', totalValue: 24_800_000 },
    ],
  },
  {
    id: 'fam-003',
    name: 'Chen Family',
    code: 'CHEN-003',
    inceptionDate: '2019-01-10',
    domicileCountry: 'Singapore',
    riskProfile: 'balanced',
    serviceTier: 'platinum',
    assignedRmId: 'usr-rm-001',
    assignedRmName: 'Alexandra Torres',
    kycStatus: 'approved',
    amlStatus: 'clear',
    totalAum: 54_200_000,
    currency: 'USD',
    lastActivityAt: '2026-03-19T09:15:00Z',
    members: [
      { id: 'mem-008', familyId: 'fam-003', firstName: 'Wei', lastName: 'Chen', dateOfBirth: '1965-08-20', nationality: ['SG', 'CN'], roleInFamily: 'Patriarch', generation: 1, email: 'wei.chen@chengroup.sg', kycStatus: 'approved', pepFlag: false },
      { id: 'mem-009', familyId: 'fam-003', firstName: 'Li', lastName: 'Chen', dateOfBirth: '1969-03-14', nationality: ['SG', 'CN'], roleInFamily: 'Matriarch', generation: 1, kycStatus: 'approved', pepFlag: false },
    ],
    entities: [
      { id: 'ent-006', familyId: 'fam-003', name: 'Chen Capital Pte. Ltd.', entityType: 'corporation', jurisdiction: 'Singapore', currency: 'SGD', status: 'active', totalValue: 38_000_000 },
      { id: 'ent-007', familyId: 'fam-003', name: 'Chen Family Trust', entityType: 'trust', jurisdiction: 'Jersey', currency: 'USD', status: 'active', totalValue: 16_200_000 },
    ],
  },
  {
    id: 'fam-004',
    name: 'Al-Rashid Family',
    code: 'ALRS-004',
    inceptionDate: '2020-09-01',
    domicileCountry: 'UAE',
    riskProfile: 'growth',
    serviceTier: 'gold',
    assignedRmId: 'usr-rm-002',
    assignedRmName: 'Carlos Mendes',
    kycStatus: 'in_review',
    amlStatus: 'review',
    totalAum: 33_800_000,
    currency: 'USD',
    lastActivityAt: '2026-03-15T16:00:00Z',
    members: [
      { id: 'mem-010', familyId: 'fam-004', firstName: 'Khalid', lastName: 'Al-Rashid', dateOfBirth: '1970-04-10', nationality: ['AE'], roleInFamily: 'Principal', generation: 1, email: 'k.alrashid@rashidgroup.ae', kycStatus: 'in_review', pepFlag: true },
      { id: 'mem-011', familyId: 'fam-004', firstName: 'Fatima', lastName: 'Al-Rashid', dateOfBirth: '1974-11-21', nationality: ['AE', 'GB'], roleInFamily: 'Spouse', generation: 1, kycStatus: 'pending', pepFlag: false },
    ],
    entities: [
      { id: 'ent-008', familyId: 'fam-004', name: 'Al-Rashid Investments DIFC', entityType: 'llc', jurisdiction: 'DIFC, UAE', currency: 'USD', status: 'active', totalValue: 33_800_000 },
    ],
  },
];

// ─── Accounts & Holdings ───────────────────────────────────────────────────

export const ACCOUNTS: Account[] = [
  { id: 'acc-001', entityId: 'ent-001', familyId: 'fam-001', custodianName: 'Morgan Stanley', accountNumber: 'MS-****4821', accountName: 'Smith Trust — Global Equity', accountType: 'brokerage', currency: 'USD', currentBalance: 45_200_000, currentBalanceUsd: 45_200_000, lastUpdated: '2026-03-19' },
  { id: 'acc-002', entityId: 'ent-001', familyId: 'fam-001', custodianName: 'Northern Trust', accountNumber: 'NT-****7743', accountName: 'Smith Trust — Fixed Income', accountType: 'brokerage', currency: 'USD', currentBalance: 22_800_000, currentBalanceUsd: 22_800_000, lastUpdated: '2026-03-19' },
  { id: 'acc-003', entityId: 'ent-002', familyId: 'fam-001', custodianName: 'Goldman Sachs', accountNumber: 'GS-****1190', accountName: 'Smith Ventures — PE', accountType: 'private_equity', currency: 'USD', currentBalance: 28_200_000, currentBalanceUsd: 28_200_000, lastUpdated: '2026-03-15' },
  { id: 'acc-004', entityId: 'ent-004', familyId: 'fam-002', custodianName: 'Julius Bär', accountNumber: 'JB-****3390', accountName: 'GR Holdings — Multi-Asset', accountType: 'brokerage', currency: 'USD', currentBalance: 52_000_000, currentBalanceUsd: 52_000_000, lastUpdated: '2026-03-19' },
  { id: 'acc-005', entityId: 'ent-006', familyId: 'fam-003', custodianName: 'DBS Private Bank', accountNumber: 'DBS-****5512', accountName: 'Chen Capital — Asia Equity', accountType: 'brokerage', currency: 'SGD', currentBalance: 51_000_000, currentBalanceUsd: 38_000_000, lastUpdated: '2026-03-19' },
  { id: 'acc-006', entityId: 'ent-008', familyId: 'fam-004', custodianName: 'Emirates NBD Private', accountNumber: 'EN-****8871', accountName: 'Al-Rashid — Multi-Asset', accountType: 'brokerage', currency: 'USD', currentBalance: 33_800_000, currentBalanceUsd: 33_800_000, lastUpdated: '2026-03-18' },
];

export const HOLDINGS: Holding[] = [
  { id: 'hld-001', accountId: 'acc-001', familyId: 'fam-001', securityName: 'Apple Inc.', ticker: 'AAPL', isin: 'US0378331005', assetClass: 'equity', assetSubclass: 'US Equity', quantity: 18000, price: 213.49, marketValueUsd: 3_842_820, costBasisUsd: 2_100_000, unrealizedPnl: 1_742_820, unrealizedPnlPct: 82.99, geography: 'North America', sector: 'Technology', currency: 'USD', isPrivate: false, asOfDate: '2026-03-19' },
  { id: 'hld-002', accountId: 'acc-001', familyId: 'fam-001', securityName: 'Microsoft Corporation', ticker: 'MSFT', isin: 'US5949181045', assetClass: 'equity', assetSubclass: 'US Equity', quantity: 9500, price: 415.20, marketValueUsd: 3_944_400, costBasisUsd: 1_900_000, unrealizedPnl: 2_044_400, unrealizedPnlPct: 107.6, geography: 'North America', sector: 'Technology', currency: 'USD', isPrivate: false, asOfDate: '2026-03-19' },
  { id: 'hld-003', accountId: 'acc-001', familyId: 'fam-001', securityName: 'MSCI World ETF (iShares)', ticker: 'IWDA', assetClass: 'equity', assetSubclass: 'Global Equity', quantity: 55000, price: 98.40, marketValueUsd: 5_412_000, costBasisUsd: 4_200_000, unrealizedPnl: 1_212_000, unrealizedPnlPct: 28.86, geography: 'Global', sector: 'Diversified', currency: 'USD', isPrivate: false, asOfDate: '2026-03-19' },
  { id: 'hld-004', accountId: 'acc-002', familyId: 'fam-001', securityName: 'US Treasury 4.25% 2030', ticker: 'T4.25 2030', assetClass: 'fixed_income', assetSubclass: 'Government Bond', quantity: 15_000_000, price: 98.72, marketValueUsd: 14_808_000, geography: 'North America', sector: 'Government', currency: 'USD', isPrivate: false, asOfDate: '2026-03-19' },
  { id: 'hld-005', accountId: 'acc-002', familyId: 'fam-001', securityName: 'EUR Corp Bond Fund', assetClass: 'fixed_income', assetSubclass: 'Corporate Bond', marketValueUsd: 7_992_000, geography: 'Europe', sector: 'Corporate', currency: 'EUR', isPrivate: false, asOfDate: '2026-03-19' },
  { id: 'hld-006', accountId: 'acc-003', familyId: 'fam-001', securityName: 'Sequoia Capital Fund XVI', assetClass: 'venture_capital', investmentType: 'venture_capital', marketValueUsd: 12_400_000, geography: 'North America', sector: 'Technology', currency: 'USD', isPrivate: true, asOfDate: '2026-03-15' } as any,
  { id: 'hld-007', accountId: 'acc-003', familyId: 'fam-001', securityName: 'Blackstone Real Estate Partners X', assetClass: 'real_estate', marketValueUsd: 15_800_000, geography: 'Global', sector: 'Real Estate', currency: 'USD', isPrivate: true, asOfDate: '2026-03-15' },
];

export const PRIVATE_INVESTMENTS: PrivateInvestment[] = [
  { id: 'pi-001', familyId: 'fam-001', accountId: 'acc-003', investmentName: 'Sequoia Capital Fund XVI', investmentType: 'venture_capital', fundManager: 'Sequoia Capital', vintageYear: 2021, commitmentAmount: 10_000_000, investedAmount: 7_500_000, unfundedCommitment: 2_500_000, currentNav: 12_400_000, navAsOfDate: '2026-03-15', irr: 0.228, moic: 1.65, tvpi: 1.65, dpi: 0.12, status: 'active', currency: 'USD' },
  { id: 'pi-002', familyId: 'fam-001', accountId: 'acc-003', investmentName: 'Blackstone BREP X', investmentType: 'real_estate', fundManager: 'Blackstone', vintageYear: 2022, commitmentAmount: 15_000_000, investedAmount: 12_000_000, unfundedCommitment: 3_000_000, currentNav: 15_800_000, navAsOfDate: '2026-03-15', irr: 0.142, moic: 1.32, tvpi: 1.32, dpi: 0.05, status: 'active', currency: 'USD' },
  { id: 'pi-003', familyId: 'fam-002', accountId: 'acc-004', investmentName: 'EQT X Private Equity', investmentType: 'private_equity', fundManager: 'EQT Partners', vintageYear: 2020, commitmentAmount: 8_000_000, investedAmount: 8_000_000, unfundedCommitment: 0, currentNav: 13_200_000, navAsOfDate: '2026-03-15', irr: 0.315, moic: 1.65, tvpi: 1.65, dpi: 0.40, status: 'active', currency: 'USD' },
  { id: 'pi-004', familyId: 'fam-003', accountId: 'acc-005', investmentName: 'GIC Real Estate Asia Fund', investmentType: 'real_estate', fundManager: 'GIC', vintageYear: 2022, commitmentAmount: 5_000_000, investedAmount: 3_800_000, unfundedCommitment: 1_200_000, currentNav: 4_100_000, navAsOfDate: '2026-03-15', irr: 0.089, moic: 1.08, tvpi: 1.08, dpi: 0, status: 'active', currency: 'USD' },
];

export const CAPITAL_CALLS: CapitalCall[] = [
  { id: 'cc-001', privateInvestmentId: 'pi-001', investmentName: 'Sequoia Capital Fund XVI', familyId: 'fam-001', callDate: '2026-03-15', dueDate: '2026-04-01', amount: 1_250_000, currency: 'USD', status: 'pending' },
  { id: 'cc-002', privateInvestmentId: 'pi-002', investmentName: 'Blackstone BREP X', familyId: 'fam-001', callDate: '2026-03-10', dueDate: '2026-03-28', amount: 2_000_000, currency: 'USD', status: 'pending' },
  { id: 'cc-003', privateInvestmentId: 'pi-003', investmentName: 'EQT X Private Equity', familyId: 'fam-002', callDate: '2026-02-20', dueDate: '2026-03-10', amount: 500_000, currency: 'USD', status: 'overdue' },
  { id: 'cc-004', privateInvestmentId: 'pi-004', investmentName: 'GIC Real Estate Asia Fund', familyId: 'fam-003', callDate: '2026-03-19', dueDate: '2026-04-15', amount: 600_000, currency: 'USD', status: 'pending' },
];

// ─── Consolidated Balance Sheets ───────────────────────────────────────────

export const BALANCE_SHEETS: ConsolidatedBalanceSheet[] = [
  {
    familyId: 'fam-001', familyName: 'Smith Family', asOfDate: '2026-03-19',
    totalNetWorth: 120_400_000, currency: 'USD',
    twrYtd: 0.0834, twrInception: 0.1122, benchmarkTwrYtd: 0.0612,
    allocation: [
      { assetClass: 'Equity', value: 46_000_000, pct: 38.2, color: '#6366f1' },
      { assetClass: 'Fixed Income', value: 22_800_000, pct: 18.9, color: '#22d3ee' },
      { assetClass: 'Private Equity', value: 15_800_000, pct: 13.1, color: '#f59e0b' },
      { assetClass: 'Venture Capital', value: 12_400_000, pct: 10.3, color: '#a78bfa' },
      { assetClass: 'Real Estate', value: 15_800_000, pct: 13.1, color: '#34d399' },
      { assetClass: 'Cash & Equiv', value: 7_600_000, pct: 6.4, color: '#94a3b8' },
    ],
    geographyExposure: [
      { name: 'North America', pct: 58 }, { name: 'Europe', pct: 22 },
      { name: 'Asia Pacific', pct: 12 }, { name: 'Emerging Markets', pct: 8 },
    ],
    currencyExposure: [
      { currency: 'USD', pct: 72 }, { currency: 'EUR', pct: 14 },
      { currency: 'GBP', pct: 8 }, { currency: 'CHF', pct: 6 },
    ],
    liquidityProfile: { dailyLiquid: 68_800_000, within30Days: 14_000_000, within90Days: 9_400_000, locked: 28_200_000 },
  },
  {
    familyId: 'fam-002', familyName: 'Rodríguez Family', asOfDate: '2026-03-19',
    totalNetWorth: 76_800_000, currency: 'USD',
    twrYtd: 0.0502, twrInception: 0.0812, benchmarkTwrYtd: 0.0612,
    allocation: [
      { assetClass: 'Equity', value: 28_000_000, pct: 36.5, color: '#6366f1' },
      { assetClass: 'Fixed Income', value: 18_400_000, pct: 24.0, color: '#22d3ee' },
      { assetClass: 'Private Equity', value: 13_200_000, pct: 17.2, color: '#f59e0b' },
      { assetClass: 'Real Estate', value: 11_200_000, pct: 14.6, color: '#34d399' },
      { assetClass: 'Cash & Equiv', value: 6_000_000, pct: 7.7, color: '#94a3b8' },
    ],
    geographyExposure: [
      { name: 'Latin America', pct: 42 }, { name: 'Europe', pct: 31 },
      { name: 'North America', pct: 18 }, { name: 'Other', pct: 9 },
    ],
    currencyExposure: [
      { currency: 'USD', pct: 52 }, { currency: 'EUR', pct: 33 }, { currency: 'MXN', pct: 15 },
    ],
    liquidityProfile: { dailyLiquid: 46_400_000, within30Days: 6_200_000, within90Days: 10_000_000, locked: 14_200_000 },
  },
  {
    familyId: 'fam-003', familyName: 'Chen Family', asOfDate: '2026-03-19',
    totalNetWorth: 54_200_000, currency: 'USD',
    twrYtd: 0.0721, twrInception: 0.0934, benchmarkTwrYtd: 0.0612,
    allocation: [
      { assetClass: 'Equity', value: 26_000_000, pct: 48.0, color: '#6366f1' },
      { assetClass: 'Fixed Income', value: 10_800_000, pct: 19.9, color: '#22d3ee' },
      { assetClass: 'Real Estate', value: 9_400_000, pct: 17.3, color: '#34d399' },
      { assetClass: 'Private Equity', value: 4_400_000, pct: 8.1, color: '#f59e0b' },
      { assetClass: 'Cash & Equiv', value: 3_600_000, pct: 6.7, color: '#94a3b8' },
    ],
    geographyExposure: [
      { name: 'Asia Pacific', pct: 62 }, { name: 'North America', pct: 22 }, { name: 'Europe', pct: 16 },
    ],
    currencyExposure: [
      { currency: 'USD', pct: 48 }, { currency: 'SGD', pct: 35 }, { currency: 'HKD', pct: 17 },
    ],
    liquidityProfile: { dailyLiquid: 36_800_000, within30Days: 4_200_000, within90Days: 5_000_000, locked: 8_200_000 },
  },
  {
    familyId: 'fam-004', familyName: 'Al-Rashid Family', asOfDate: '2026-03-19',
    totalNetWorth: 33_800_000, currency: 'USD',
    twrYtd: 0.0388, twrInception: 0.0512, benchmarkTwrYtd: 0.0612,
    allocation: [
      { assetClass: 'Equity', value: 14_000_000, pct: 41.4, color: '#6366f1' },
      { assetClass: 'Fixed Income', value: 8_200_000, pct: 24.3, color: '#22d3ee' },
      { assetClass: 'Real Estate', value: 7_400_000, pct: 21.9, color: '#34d399' },
      { assetClass: 'Cash & Equiv', value: 4_200_000, pct: 12.4, color: '#94a3b8' },
    ],
    geographyExposure: [
      { name: 'Middle East', pct: 55 }, { name: 'Europe', pct: 28 }, { name: 'North America', pct: 17 },
    ],
    currencyExposure: [
      { currency: 'USD', pct: 65 }, { currency: 'AED', pct: 20 }, { currency: 'EUR', pct: 15 },
    ],
    liquidityProfile: { dailyLiquid: 22_200_000, within30Days: 3_500_000, within90Days: 4_500_000, locked: 3_600_000 },
  },
];

// Performance chart data (last 12 months)
export function getPerformanceHistory(familyId: string): PerformancePoint[] {
  const base = familyId === 'fam-001' ? 100_000_000 : familyId === 'fam-002' ? 68_000_000 : familyId === 'fam-003' ? 48_000_000 : 30_000_000;
  const points: PerformancePoint[] = [];
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const portfolioFactors = [1.000, 1.018, 1.009, 1.034, 1.028, 0.984, 1.041, 1.055, 1.062, 1.078, 1.091, 1.083];
  const benchFactors    = [1.000, 1.012, 1.005, 1.022, 1.018, 0.992, 1.028, 1.039, 1.046, 1.058, 1.065, 1.061];
  months.forEach((m, i) => {
    points.push({ date: m, portfolioValue: Math.round(base * portfolioFactors[i]), benchmarkValue: Math.round(base * benchFactors[i]) });
  });
  return points;
}

// ─── Activities ────────────────────────────────────────────────────────────

export const ACTIVITIES: Activity[] = [
  { id: 'act-001', familyId: 'fam-001', familyName: 'Smith Family', memberName: 'Robert Smith', activityType: 'email', subject: 'Q1 2026 Portfolio Review — follow-up questions', summaryAi: 'Robert requests clarification on the PE allocation timeline and asks for updated IRR figures for Sequoia Fund XVI.', direction: 'inbound', occurredAt: '2026-03-19T09:30:00Z', createdBy: 'Email Sync', source: 'email_sync', tags: ['investments', 'pe'], sentiment: 'neutral' },
  { id: 'act-002', familyId: 'fam-003', familyName: 'Chen Family', memberName: 'Wei Chen', activityType: 'meeting', subject: 'Quarterly review meeting — Singapore office', summaryAi: 'Reviewed Asia Pacific allocation and discussed increasing exposure to Indian equity market. Wei requested allocation model for next board meeting.', occurredAt: '2026-03-18T14:00:00Z', createdBy: 'Alexandra Torres', source: 'manual', tags: ['investments', 'asia'], sentiment: 'positive' },
  { id: 'act-003', familyId: 'fam-002', familyName: 'Rodríguez Family', memberName: 'Eduardo Rodríguez', activityType: 'call', subject: 'Capital call notice — EQT X', summaryAi: 'Discussed the overdue EQT X capital call. Eduardo requested a 2-week extension and confirmed wire transfer will be initiated.', direction: 'outbound', occurredAt: '2026-03-17T11:00:00Z', createdBy: 'Carlos Mendes', source: 'manual', tags: ['capital_call', 'pe'], sentiment: 'concern' },
  { id: 'act-004', familyId: 'fam-001', familyName: 'Smith Family', activityType: 'note', subject: 'Estate planning review note', body: 'Discussed updating the Smith Family Trust deed to include next generation provisions. Claire Smith to be added as co-trustee.', occurredAt: '2026-03-15T10:00:00Z', createdBy: 'Alexandra Torres', source: 'manual', tags: ['estate', 'governance'] },
  { id: 'act-005', familyId: 'fam-004', familyName: 'Al-Rashid Family', memberName: 'Khalid Al-Rashid', activityType: 'email', subject: 'KYC document upload request', summaryAi: 'Sent KYC renewal request. Khalid acknowledged and confirmed documents will be submitted within 5 business days.', direction: 'outbound', occurredAt: '2026-03-14T08:00:00Z', createdBy: 'Email Sync', source: 'email_sync', tags: ['kyc', 'compliance'], sentiment: 'neutral' },
  { id: 'act-006', familyId: 'fam-003', familyName: 'Chen Family', activityType: 'document_shared', subject: 'Q4 2025 Performance Report shared', occurredAt: '2026-03-12T14:30:00Z', createdBy: 'Alexandra Torres', source: 'manual', tags: ['report'] },
  { id: 'act-007', familyId: 'fam-001', familyName: 'Smith Family', memberName: 'James Smith', activityType: 'email', subject: 'Real estate opportunity — Miami property', summaryAi: 'James sent details on a $4.2M Miami beachfront property he is considering. Requests portfolio liquidity analysis to determine funding capacity.', direction: 'inbound', occurredAt: '2026-03-11T16:20:00Z', createdBy: 'Email Sync', source: 'email_sync', tags: ['real_estate', 'concierge'], sentiment: 'positive' },
];

// ─── Task Queues ───────────────────────────────────────────────────────────

export const TASK_QUEUES: TaskQueue[] = [
  { id: 'q-compliance',   name: 'Compliance',       icon: '⚖️',  color: '#ef4444', memberIds: ['usr-comp-001', 'usr-admin-001'],             assignSlaMinutes: 60,  tenantType: 'global' },
  { id: 'q-client-svc',  name: 'Client Services',  icon: '🤝',  color: '#6366f1', memberIds: ['usr-rm-001', 'usr-rm-002'],                  assignSlaMinutes: 120, tenantType: 'global' },
  { id: 'q-back-office', name: 'Back Office',       icon: '🗄️', color: '#f59e0b', memberIds: ['usr-ctrl-001'],                               assignSlaMinutes: 240, tenantType: 'global' },
  { id: 'q-investment',  name: 'Investment',        icon: '📊',  color: '#22d3ee', memberIds: ['usr-cio-001', 'usr-rm-001'],                  assignSlaMinutes: 180, tenantType: 'global' },
  { id: 'q-concierge',   name: 'Concierge',         icon: '🛎️', color: '#a78bfa', memberIds: ['usr-rm-001', 'usr-rm-002', 'usr-admin-001'],  assignSlaMinutes: 90,  tenantType: 'global' },
];

// ─── Task Types ─────────────────────────────────────────────────────────────

export const TASK_TYPES: TaskType[] = [
  { id: 'tt-kyc',         name: 'KYC Review',            icon: '🪪',  completionSlaHours: 48,  defaultQueueId: 'q-compliance',  defaultPriority: 'urgent', color: '#ef4444' },
  { id: 'tt-report',      name: 'Performance Report',    icon: '📈',  completionSlaHours: 72,  defaultQueueId: 'q-investment',  defaultPriority: 'high',   color: '#22d3ee' },
  { id: 'tt-capital',     name: 'Capital Call',          icon: '💰',  completionSlaHours: 24,  defaultQueueId: 'q-back-office', defaultPriority: 'urgent', color: '#f59e0b' },
  { id: 'tt-estate',      name: 'Estate / Legal',        icon: '⚖️',  completionSlaHours: 168, defaultQueueId: 'q-compliance',  defaultPriority: 'normal', color: '#ef4444' },
  { id: 'tt-concierge',   name: 'Concierge Request',     icon: '🛎️', completionSlaHours: 48,  defaultQueueId: 'q-concierge',   defaultPriority: 'high',   color: '#a78bfa' },
  { id: 'tt-analysis',    name: 'Portfolio Analysis',    icon: '📊',  completionSlaHours: 48,  defaultQueueId: 'q-investment',  defaultPriority: 'high',   color: '#22d3ee' },
  { id: 'tt-compliance',  name: 'Compliance Review',     icon: '✅',  completionSlaHours: 120, defaultQueueId: 'q-compliance',  defaultPriority: 'normal', color: '#ef4444' },
];

// ─── Tasks ─────────────────────────────────────────────────────────────────

export const TASKS: Task[] = [
  { id: 'tsk-001', familyId: 'fam-001', familyName: 'Smith Family',
    title: 'Prepare Q1 2026 portfolio performance pack',
    description: 'Compile consolidated performance report for Smith Family — include PE IRR updates and benchmark comparison.',
    status: 'in_progress', priority: 'high',
    taskTypeId: 'tt-report', queueId: 'q-investment',
    assignedTo: 'Alexandra Torres', assignedUserId: 'usr-rm-001', assignedUserName: 'Alexandra Torres',
    pickedUpAt: '2026-03-11T09:00:00Z',
    dueDate: '2026-03-25', source: 'manual', tags: ['report', 'quarterly'], createdAt: '2026-03-10T08:00:00Z' },

  { id: 'tsk-002', familyId: 'fam-004', familyName: 'Al-Rashid Family',
    title: 'Collect outstanding KYC documents',
    description: 'Khalid and Fatima Al-Rashid KYC renewal due. Passport, proof of address, and source of funds required.',
    status: 'open', priority: 'urgent',
    taskTypeId: 'tt-kyc', queueId: 'q-compliance',
    assignedTo: 'Carlos Mendes', assignedUserId: 'usr-rm-002', assignedUserName: 'Carlos Mendes',
    pickedUpAt: '2026-03-14T14:30:00Z',
    dueDate: '2026-03-24', source: 'manual', tags: ['kyc', 'compliance'], createdAt: '2026-03-14T12:00:00Z',
    slaBreached: true, slaBreachMinutes: 47 },

  { id: 'tsk-003', familyId: 'fam-002', familyName: 'Rodríguez Family',
    title: 'Follow up on overdue EQT capital call',
    status: 'open', priority: 'urgent',
    taskTypeId: 'tt-capital', queueId: 'q-back-office',
    // No user assigned yet — sitting in queue
    dueDate: '2026-03-22', source: 'email_ai', tags: ['capital_call'], createdAt: '2026-03-17T10:00:00Z',
    slaBreached: true, slaBreachMinutes: 132 },

  { id: 'tsk-004', familyId: 'fam-001', familyName: 'Smith Family',
    title: 'Update beneficiary list — Smith Family Trust',
    description: 'Add Claire Smith as co-trustee. Coordinate with attorney (Martin & Associates, Cayman).',
    status: 'open', priority: 'normal',
    taskTypeId: 'tt-estate', queueId: 'q-compliance',
    // Unassigned in queue
    dueDate: '2026-04-10', source: 'manual', tags: ['estate', 'legal'], createdAt: '2026-03-15T09:00:00Z' },

  { id: 'tsk-005', familyId: 'fam-003', familyName: 'Chen Family',
    title: 'Prepare Asia Pacific allocation model',
    description: 'Model requested by Wei Chen for next board meeting. Include India equity exposure scenarios.',
    status: 'in_progress', priority: 'high',
    taskTypeId: 'tt-analysis', queueId: 'q-investment',
    assignedTo: 'Alexandra Torres', assignedUserId: 'usr-rm-001', assignedUserName: 'Alexandra Torres',
    pickedUpAt: '2026-03-18T08:00:00Z',
    dueDate: '2026-03-28', source: 'manual', tags: ['investments', 'asia'], createdAt: '2026-03-18T07:30:00Z' },

  { id: 'tsk-006', familyId: 'fam-001', familyName: 'Smith Family',
    title: 'Liquidity analysis for Miami property acquisition',
    description: 'James Smith requesting $4.2M. Review portfolio liquidity vs. upcoming capital calls.',
    status: 'open', priority: 'high',
    taskTypeId: 'tt-analysis', queueId: 'q-investment',
    // Unassigned in queue
    dueDate: '2026-03-26', source: 'email_ai', tags: ['real_estate', 'liquidity'], createdAt: '2026-03-11T10:00:00Z' },

  { id: 'tsk-007', familyId: 'fam-002', familyName: 'Rodríguez Family',
    title: 'Annual compliance review — GR Holdings BVI',
    status: 'completed', priority: 'normal',
    taskTypeId: 'tt-compliance', queueId: 'q-compliance',
    assignedTo: 'Carlos Mendes', assignedUserId: 'usr-rm-002', assignedUserName: 'Carlos Mendes',
    pickedUpAt: '2026-03-01T08:00:00Z',
    dueDate: '2026-03-15', completedAt: '2026-03-14T16:00:00Z', source: 'manual', tags: ['compliance'], createdAt: '2026-02-28T09:00:00Z' },

  { id: 'tsk-008', familyId: 'fam-001', familyName: 'Smith Family',
    title: 'Private jet booking — New York to Miami',
    description: 'Gulfstream G650 for 4 pax. KTEB → KOPF. Depart Apr 4 08:00 ET.',
    status: 'in_progress', priority: 'high',
    taskTypeId: 'tt-concierge', queueId: 'q-concierge',
    assignedTo: 'Alexandra Torres', assignedUserId: 'usr-rm-001', assignedUserName: 'Alexandra Torres',
    pickedUpAt: '2026-03-19T08:30:00Z',
    dueDate: '2026-04-04', source: 'concierge', tags: ['travel', 'concierge'], createdAt: '2026-03-19T08:00:00Z' },
];

// ─── Time Entries (mock) ────────────────────────────────────────────────────

export const TIME_ENTRIES: TimeEntry[] = [
  { id: 'te-001', taskId: 'tsk-001', userId: 'usr-rm-001', userName: 'Alexandra Torres', familyId: 'fam-001', activityType: 'note',    startedAt: '2026-03-11T09:00:00Z', endedAt: '2026-03-11T09:45:00Z', durationMinutes: 45 },
  { id: 'te-002', taskId: 'tsk-001', userId: 'usr-rm-001', userName: 'Alexandra Torres', familyId: 'fam-001', activityType: 'meeting', startedAt: '2026-03-12T10:00:00Z', endedAt: '2026-03-12T11:00:00Z', durationMinutes: 60 },
  { id: 'te-003', taskId: 'tsk-001', userId: 'usr-rm-001', userName: 'Alexandra Torres', familyId: 'fam-001', activityType: 'note',    startedAt: '2026-03-18T14:00:00Z', endedAt: '2026-03-18T14:30:00Z', durationMinutes: 30 },
  { id: 'te-004', taskId: 'tsk-002', userId: 'usr-rm-002', userName: 'Carlos Mendes',    familyId: 'fam-004', activityType: 'email',   startedAt: '2026-03-14T14:30:00Z', endedAt: '2026-03-14T15:00:00Z', durationMinutes: 30 },
  { id: 'te-005', taskId: 'tsk-002', userId: 'usr-rm-002', userName: 'Carlos Mendes',    familyId: 'fam-004', activityType: 'call',    startedAt: '2026-03-15T10:00:00Z', endedAt: '2026-03-15T10:30:00Z', durationMinutes: 30 },
  { id: 'te-006', taskId: 'tsk-005', userId: 'usr-rm-001', userName: 'Alexandra Torres', familyId: 'fam-003', activityType: 'note',    startedAt: '2026-03-18T08:00:00Z', endedAt: '2026-03-18T09:00:00Z', durationMinutes: 60 },
  { id: 'te-007', taskId: 'tsk-007', userId: 'usr-rm-002', userName: 'Carlos Mendes',    familyId: 'fam-002', activityType: 'note',    startedAt: '2026-03-10T09:00:00Z', endedAt: '2026-03-10T10:00:00Z', durationMinutes: 60 },
  { id: 'te-008', taskId: 'tsk-007', userId: 'usr-rm-002', userName: 'Carlos Mendes',    familyId: 'fam-002', activityType: 'meeting', startedAt: '2026-03-14T13:00:00Z', endedAt: '2026-03-14T14:30:00Z', durationMinutes: 90 },
  { id: 'te-009', taskId: 'tsk-008', userId: 'usr-rm-001', userName: 'Alexandra Torres', familyId: 'fam-001', activityType: 'call',    startedAt: '2026-03-19T08:30:00Z', endedAt: '2026-03-19T09:00:00Z', durationMinutes: 30 },
];

// ─── Documents ─────────────────────────────────────────────────────────────

export const DOCUMENTS: Document[] = [
  { id: 'doc-001', familyId: 'fam-001', familyName: 'Smith Family', entityId: 'ent-001', entityName: 'Smith Family Trust', documentType: 'trust_deed', title: 'Smith Family Trust Deed (2022 Amendment)', version: 3, fileName: 'Smith_Trust_Deed_v3_2022.pdf', fileSizeBytes: 2_840_000, mimeType: 'application/pdf', tags: ['trust', 'legal', 'cayman'], isConfidential: true, requiresSignature: false, uploadedBy: 'Alexandra Torres', createdAt: '2022-06-15T10:00:00Z' },
  { id: 'doc-002', familyId: 'fam-001', familyName: 'Smith Family', documentType: 'tax_return', title: 'Smith Family — US Federal Tax Return 2024', version: 1, fileName: 'Smith_Tax_Return_2024.pdf', fileSizeBytes: 1_240_000, mimeType: 'application/pdf', tags: ['tax', 'us', 'annual'], isConfidential: true, requiresSignature: false, uploadedBy: 'Controller', createdAt: '2025-04-15T09:00:00Z' },
  { id: 'doc-003', familyId: 'fam-001', familyName: 'Smith Family', documentType: 'report', title: 'Q4 2025 Portfolio Performance Report', version: 1, fileName: 'Smith_Q4_2025_Performance.pdf', fileSizeBytes: 3_200_000, mimeType: 'application/pdf', tags: ['report', 'performance', 'quarterly'], isConfidential: false, requiresSignature: false, uploadedBy: 'System', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'doc-004', familyId: 'fam-002', familyName: 'Rodríguez Family', entityId: 'ent-004', entityName: 'GR Holdings BVI', documentType: 'legal_agreement', title: 'GR Holdings — Shareholders Agreement', version: 2, fileName: 'GRH_Shareholders_Agreement_v2.pdf', fileSizeBytes: 1_980_000, mimeType: 'application/pdf', tags: ['legal', 'bvi'], isConfidential: true, requiresSignature: true, signatureStatus: 'signed', uploadedBy: 'Carlos Mendes', createdAt: '2021-09-01T14:00:00Z' },
  { id: 'doc-005', familyId: 'fam-003', familyName: 'Chen Family', documentType: 'investment_doc', title: 'GIC Real Estate Asia Fund — Subscription Agreement', version: 1, fileName: 'GIC_Subscription_Chen.pdf', fileSizeBytes: 890_000, mimeType: 'application/pdf', tags: ['pe', 'real_estate', 'subscription'], isConfidential: true, requiresSignature: true, signatureStatus: 'signed', uploadedBy: 'Alexandra Torres', createdAt: '2022-07-20T11:00:00Z' },
  { id: 'doc-006', familyId: 'fam-004', familyName: 'Al-Rashid Family', documentType: 'kyc', title: 'Khalid Al-Rashid — KYC Package (2023)', version: 1, fileName: 'AlRashid_KYC_2023.pdf', fileSizeBytes: 4_500_000, mimeType: 'application/pdf', tags: ['kyc', 'aml', 'compliance'], isConfidential: true, requiresSignature: false, expiryDate: '2026-06-30', uploadedBy: 'Carlos Mendes', createdAt: '2023-06-01T09:00:00Z' },
  { id: 'doc-007', familyId: 'fam-001', familyName: 'Smith Family', documentType: 'investment_doc', title: 'Sequoia Capital Fund XVI — LP Agreement', version: 1, fileName: 'Sequoia_XVI_LP_Smith.pdf', fileSizeBytes: 7_200_000, mimeType: 'application/pdf', tags: ['vc', 'sequoia', 'lp'], isConfidential: true, requiresSignature: true, signatureStatus: 'signed', uploadedBy: 'Alexandra Torres', createdAt: '2021-03-05T10:00:00Z' },
];

// ─── Governance ────────────────────────────────────────────────────────────

export const GOVERNANCE_STRUCTURES: GovernanceStructure[] = [
  { id: 'gov-001', familyId: 'fam-001', familyName: 'Smith Family', name: 'Smith Family Council', structureType: 'family_council', memberCount: 5, lastMeetingDate: '2025-12-15', nextMeetingDate: '2026-03-25' },
  { id: 'gov-002', familyId: 'fam-001', familyName: 'Smith Family', name: 'Smith Investment Committee', structureType: 'investment_committee', memberCount: 3, lastMeetingDate: '2026-02-10', nextMeetingDate: '2026-04-10' },
  { id: 'gov-003', familyId: 'fam-002', familyName: 'Rodríguez Family', name: 'Rodríguez Family Council', structureType: 'family_council', memberCount: 4, lastMeetingDate: '2026-01-20', nextMeetingDate: '2026-04-20' },
  { id: 'gov-004', familyId: 'fam-003', familyName: 'Chen Family', name: 'Chen Advisory Board', structureType: 'advisory_board', memberCount: 6, lastMeetingDate: '2026-03-05', nextMeetingDate: '2026-06-05' },
];

export const GOVERNANCE_MEETINGS: GovernanceMeeting[] = [
  { id: 'gm-001', governanceId: 'gov-001', governanceName: 'Smith Family Council', familyId: 'fam-001', familyName: 'Smith Family', meetingDate: '2026-03-25', location: 'New York — MFO Offices', agenda: 'Q1 review, Estate plan update, Next-gen education programme', status: 'scheduled', attendeeCount: 5 },
  { id: 'gm-002', governanceId: 'gov-002', governanceName: 'Smith Investment Committee', familyId: 'fam-001', familyName: 'Smith Family', meetingDate: '2025-12-15', location: 'New York — MFO Offices', agenda: 'Annual portfolio review, 2026 asset allocation targets', status: 'completed', attendeeCount: 3 },
  { id: 'gm-003', governanceId: 'gov-003', governanceName: 'Rodríguez Family Council', familyId: 'fam-002', familyName: 'Rodríguez Family', meetingDate: '2026-01-20', location: 'Mexico City', agenda: 'BVI holding company annual review, succession planning', status: 'completed', attendeeCount: 4 },
  { id: 'gm-004', governanceId: 'gov-004', governanceName: 'Chen Advisory Board', familyId: 'fam-003', familyName: 'Chen Family', meetingDate: '2026-03-05', location: 'Singapore — Four Seasons', agenda: 'Asia allocation strategy, Singapore family office MAS compliance review', status: 'completed', attendeeCount: 6 },
];

export const VOTES: Vote[] = [
  { id: 'vt-001', meetingId: 'gm-002', resolution: 'Approve 2026 Strategic Asset Allocation — increase PE to 25%', voteResult: 'passed', votesFor: 3, votesAgainst: 0, votesAbstain: 0, voteDate: '2025-12-15' },
  { id: 'vt-002', meetingId: 'gm-002', resolution: 'Appoint Blackstone as lead RE manager for 2026', voteResult: 'passed', votesFor: 2, votesAgainst: 1, votesAbstain: 0, voteDate: '2025-12-15' },
  { id: 'vt-003', meetingId: 'gm-003', resolution: 'Authorise EQT capital call payment extension request', voteResult: 'passed', votesFor: 4, votesAgainst: 0, votesAbstain: 0, voteDate: '2026-01-20' },
  { id: 'vt-004', meetingId: 'gm-004', resolution: 'Increase India equity allocation to 15% of Asia portfolio', voteResult: 'tabled', votesFor: 3, votesAgainst: 2, votesAbstain: 1, voteDate: '2026-03-05' },
];

// ─── Estate Plans ──────────────────────────────────────────────────────────

export const ESTATE_PLANS: EstatePlan[] = [
  { id: 'ep-001', familyId: 'fam-001', familyName: 'Smith Family', entityName: 'Smith Family Trust', planType: 'Revocable Living Trust', jurisdiction: 'Cayman Islands', estimatedEstateValue: 120_400_000, estimatedTaxLiability: 18_200_000, lastReviewedDate: '2025-06-01', attorneyName: 'Martin & Associates (Cayman)', primaryBeneficiaries: ['James Smith', 'Claire Smith'], notes: 'Amendment needed to add Claire as co-trustee' },
  { id: 'ep-002', familyId: 'fam-002', familyName: 'Rodríguez Family', entityName: 'GR Holdings BVI', planType: 'Corporate Holding Structure', jurisdiction: 'British Virgin Islands', estimatedEstateValue: 76_800_000, estimatedTaxLiability: 0, lastReviewedDate: '2026-01-20', attorneyName: 'Carey Olsen (BVI)', primaryBeneficiaries: ['Andrés Rodríguez'], notes: 'Tax-neutral BVI structure. Annual substance requirements met.' },
  { id: 'ep-003', familyId: 'fam-003', familyName: 'Chen Family', entityName: 'Chen Family Trust', planType: 'Discretionary Trust', jurisdiction: 'Jersey', estimatedEstateValue: 54_200_000, estimatedTaxLiability: 2_100_000, lastReviewedDate: '2025-11-15', attorneyName: 'Mourant (Jersey)', primaryBeneficiaries: ['Li Chen', 'Next Generation'] },
];

// ─── Service Requests ──────────────────────────────────────────────────────

export const SERVICE_REQUESTS: ServiceRequest[] = [
  { id: 'sr-001', familyId: 'fam-001', familyName: 'Smith Family', memberName: 'James Smith', serviceType: 'travel', title: 'Private jet booking — New York to Miami (Apr 4)', description: 'Gulfstream G650 needed for 4 pax. TETERBORO to MIAMI OPA-LOCKA. Depart 08:00 ET', status: 'in_progress', priority: 'high', assignedTo: 'Alexandra Torres', requestedDate: '2026-03-19', targetDate: '2026-04-04', createdAt: '2026-03-19T08:00:00Z' },
  { id: 'sr-002', familyId: 'fam-001', familyName: 'Smith Family', memberName: 'Margaret Smith', serviceType: 'property', title: 'Annual villa maintenance — Côte d\'Azur property', description: 'Schedule spring maintenance for Villa Les Oliviers (Cap Ferrat). Property manager contact: +33 6 12 34 56 78', status: 'open', priority: 'normal', assignedTo: 'Alexandra Torres', requestedDate: '2026-03-15', targetDate: '2026-04-30', createdAt: '2026-03-15T14:00:00Z' },
  { id: 'sr-003', familyId: 'fam-003', familyName: 'Chen Family', memberName: 'Wei Chen', serviceType: 'healthcare', title: 'Executive health screening — Mount Elizabeth Hospital Singapore', description: 'Annual executive health screening for Wei and Li Chen. VIP package requested.', status: 'resolved', priority: 'normal', assignedTo: 'Alexandra Torres', requestedDate: '2026-02-28', targetDate: '2026-03-15', createdAt: '2026-02-28T10:00:00Z' },
  { id: 'sr-004', familyId: 'fam-002', familyName: 'Rodríguez Family', memberName: 'Andrés Rodríguez', serviceType: 'education', title: 'MBA programme research — INSEAD & LBS options', description: 'Andrés considering MBA. Research INSEAD Fontainebleau and London Business School timelines, scholarship options, and application requirements.', status: 'in_progress', priority: 'normal', assignedTo: 'Carlos Mendes', requestedDate: '2026-03-10', createdAt: '2026-03-10T09:00:00Z' },
  { id: 'sr-005', familyId: 'fam-004', familyName: 'Al-Rashid Family', memberName: 'Fatima Al-Rashid', serviceType: 'event', title: 'Private dinner — 50th birthday celebration (Apr 12)', description: 'Upscale private dinner for 30 guests in Dubai. Preferred venue: Nobu or Four Seasons DIFC. Budget: AED 150,000.', status: 'open', priority: 'high', assignedTo: 'Carlos Mendes', requestedDate: '2026-03-18', targetDate: '2026-04-12', createdAt: '2026-03-18T15:00:00Z' },
];

// ─── Users & Admin ─────────────────────────────────────────────────────────

export const PLATFORM_USERS: PlatformUser[] = [
  { id: 'usr-admin-001', email: 'admin@mfonexus.com', displayName: 'System Admin', role: 'firm_admin', mfaEnabled: true, status: 'active', lastLoginAt: '2026-03-19T08:00:00Z', createdAt: '2020-01-01' },
  { id: 'usr-rm-001', email: 'a.torres@mfonexus.com', displayName: 'Alexandra Torres', role: 'relationship_manager', mfaEnabled: true, status: 'active', lastLoginAt: '2026-03-19T09:00:00Z', createdAt: '2021-03-15' },
  { id: 'usr-rm-002', email: 'c.mendes@mfonexus.com', displayName: 'Carlos Mendes', role: 'relationship_manager', mfaEnabled: true, status: 'active', lastLoginAt: '2026-03-18T17:30:00Z', createdAt: '2022-01-10' },
  { id: 'usr-cio-001', email: 'cio@mfonexus.com', displayName: 'David Park', role: 'cio', mfaEnabled: true, status: 'active', lastLoginAt: '2026-03-19T07:45:00Z', createdAt: '2020-01-01' },
  { id: 'usr-ctrl-001', email: 'controller@mfonexus.com', displayName: 'Sarah Kim', role: 'controller', mfaEnabled: true, status: 'active', lastLoginAt: '2026-03-18T14:00:00Z', createdAt: '2022-06-01' },
  { id: 'usr-comp-001', email: 'compliance@mfonexus.com', displayName: 'Michael Osei', role: 'compliance_officer', mfaEnabled: true, status: 'active', lastLoginAt: '2026-03-17T11:00:00Z', createdAt: '2023-01-15' },
  { id: 'usr-view-001', email: 'reporting@mfonexus.com', displayName: 'Emma Walsh', role: 'report_viewer', mfaEnabled: false, status: 'invited', createdAt: '2026-03-10' },
];

export const AUDIT_LOG: AuditLogEntry[] = [
  { id: 'al-001', tenantId: 'tenant-001', userId: 'usr-rm-001', userName: 'Alexandra Torres', action: 'POST /api/v1/activities', resourceId: 'act-123', resourceType: 'activity', resourceName: 'Smith Family — Email logged', ipAddress: '192.168.1.45', occurredAt: '2026-03-19T09:31:00Z' },
  { id: 'al-002', tenantId: 'tenant-001', userId: 'usr-ctrl-001', userName: 'Sarah Kim', action: 'POST /api/v1/ingest/upload', resourceId: 'job-456', resourceType: 'ingestion_job', resourceName: 'Morgan Stanley Holdings CSV', ipAddress: '192.168.1.22', occurredAt: '2026-03-19T08:15:00Z' },
  { id: 'al-003', tenantId: 'tenant-001', userId: 'usr-rm-002', userName: 'Carlos Mendes', action: 'GET /api/v1/families/fam-002/balance-sheet', resourceId: 'bs-789', resourceType: 'balance_sheet', resourceName: 'Rodríguez Family', ipAddress: '192.168.1.33', occurredAt: '2026-03-18T17:40:00Z' },
  { id: 'al-004', tenantId: 'tenant-001', userId: 'usr-comp-001', userName: 'Michael Osei', action: 'PATCH /api/v1/families/fam-004', resourceId: 'fam-004', resourceType: 'family', resourceName: 'Al-Rashid Family — KYC status update', ipAddress: '192.168.1.55', occurredAt: '2026-03-18T11:00:00Z' },
  { id: 'al-005', tenantId: 'tenant-001', userId: 'usr-cio-001', userName: 'David Park', action: 'GET /api/v1/families/balance-sheet (all)', resourceId: 'all-bs', resourceType: 'balance_sheet', resourceName: 'Consolidated — All families', ipAddress: '10.0.0.5', occurredAt: '2026-03-19T07:50:00Z' },
];

// ─── Dashboard Stats ───────────────────────────────────────────────────────

export const DASHBOARD_STATS: DashboardStats = {
  totalAum: 285_200_000,
  totalFamilies: 4,
  activeTasksCount: 5,
  capitalCallsDue: 3,
  capitalCallsAmount: 3_850_000,
  documentsAwaitingReview: 2,
  openServiceRequests: 4,
  pendingKyc: 1,
};

// Kept for backward compat — use DEFAULT_SUITABILITY_CONFIG.questions instead
export const SUITABILITY_QUESTIONS: SuitabilityQuestion[] = [
  { id: 'q1', category: 'risk_tolerance', question: 'Se o valor da sua carteira caísse 20% em um único mês, como reagiria?', weight: 2, required: true, order: 1,
    options: [
      { value: 'sell_all',  label: 'Venderia tudo imediatamente', score: 1 },
      { value: 'sell_some', label: 'Venderia parte para reduzir o risco', score: 2 },
      { value: 'hold',      label: 'Manteria e aguardaria a recuperação', score: 3 },
      { value: 'buy_more',  label: 'Aproveitaria para comprar mais', score: 4 },
    ]},
  { id: 'q2', category: 'knowledge', question: 'Qual é o seu nível de familiaridade com instrumentos financeiros complexos?', weight: 1, required: true, order: 2,
    options: [
      { value: 'none',     label: 'Nenhuma familiaridade', score: 1 },
      { value: 'basic',    label: 'Entendo conceitos básicos', score: 2 },
      { value: 'advanced', label: 'Invisto regularmente neles', score: 3 },
      { value: 'expert',   label: 'Conhecimento profissional', score: 4 },
    ]},
  { id: 'q3', category: 'time_horizon', question: 'Em quanto tempo pretende resgatar pelo menos 25% deste portfólio?', weight: 2, required: true, order: 3,
    options: [
      { value: 'within_2y', label: 'Dentro de 2 anos', score: 1 },
      { value: '3_5y',      label: '3 a 5 anos', score: 2 },
      { value: '6_10y',     label: '6 a 10 anos', score: 3 },
      { value: '10y_plus',  label: 'Mais de 10 anos', score: 4 },
    ]},
  { id: 'q4', category: 'liquidity', question: 'Qual parcela do patrimônio investido você pode manter sem liquidez por mais de 5 anos?', weight: 1, required: true, order: 4,
    options: [
      { value: 'none',    label: 'Nenhuma — preciso de liquidez total', score: 1 },
      { value: 'up25',    label: 'Até 25%', score: 2 },
      { value: '25to50',  label: '25% a 50%', score: 3 },
      { value: 'over50',  label: 'Mais de 50%', score: 4 },
    ]},
  { id: 'q5', category: 'objectives', question: 'Qual é o principal objetivo deste patrimônio?', weight: 2, required: true, order: 5,
    options: [
      { value: 'preserve', label: 'Preservação do capital a todo custo', score: 1 },
      { value: 'income',   label: 'Geração de renda com baixo risco', score: 2 },
      { value: 'growth',   label: 'Crescimento de longo prazo', score: 3 },
      { value: 'max',      label: 'Maximização do retorno (aceito volatilidade)', score: 4 },
    ]},
  { id: 'q6', category: 'experience', question: 'Há quanto tempo você investe em mercados financeiros?', weight: 1, required: true, order: 6,
    options: [
      { value: 'none',    label: 'Nunca investi', score: 1 },
      { value: 'lt2',     label: 'Menos de 2 anos', score: 2 },
      { value: '2to10',   label: 'De 2 a 10 anos', score: 3 },
      { value: 'gt10',    label: 'Mais de 10 anos', score: 4 },
    ]},
  { id: 'q7', category: 'risk_tolerance', question: 'Qual retorno anual esperado você considera adequado para o risco que aceita?', weight: 1, required: true, order: 7,
    helpText: 'Selecione a faixa que melhor representa sua expectativa realista.',
    options: [
      { value: 'low',    label: 'CDI / Poupança (baixo risco)', score: 1 },
      { value: 'mid',    label: 'CDI + 2% a 4% (risco moderado)', score: 2 },
      { value: 'high',   label: 'CDI + 5% a 8% (risco elevado)', score: 3 },
      { value: 'vhigh',  label: 'Acima de CDI + 8% (risco muito alto)', score: 4 },
    ]},
];

/** Default tenant suitability configuration — fully ANBIMA/CVM Res. 30 compliant */
export const DEFAULT_SUITABILITY_CONFIG: SuitabilityConfig = {
  tenantId: 'tenant-001',
  name: 'Perfil de Investidor — ANBIMA v2026',
  version: '2026.1',
  questions: SUITABILITY_QUESTIONS,
  renewalMonths: 24,
  requirePin: true,
  declarationText:
    'Declaro, sob as penas da lei, que as informações prestadas neste questionário são verdadeiras, ' +
    'completas e atualizadas. Estou ciente de que o perfil de investidor apurado reflete minhas ' +
    'respostas e será utilizado pela instituição financeira para recomendar produtos e serviços ' +
    'compatíveis com meu perfil, nos termos da Resolução CVM n.º 30/2021 e da Deliberação ' +
    'ANBIMA n.º 21/2022. Autorizo o armazenamento eletrônico desta declaração juntamente com ' +
    'os metadados de acesso (IP, data, hora e versão do questionário) como substituto válido ' +
    'à assinatura física.',
  bands: [
    { label: 'conservative', minScore: 0,  maxScore: 29,  description: 'Busca preservação de capital com mínima volatilidade. Produtos: CDB, Tesouro Direto, Fundos DI.', color: '#22d3ee' },
    { label: 'balanced',     minScore: 30, maxScore: 54,  description: 'Aceita volatilidade moderada por retornos acima da inflação. Produtos: Fundos Multimercado Baixo Risco, Debêntures.', color: '#a78bfa' },
    { label: 'growth',       minScore: 55, maxScore: 74,  description: 'Tolera volatilidade para crescimento no longo prazo. Produtos: Ações, Fundos Multimercado, FIIs.', color: '#f59e0b' },
    { label: 'aggressive',   minScore: 75, maxScore: 100, description: 'Aceita alta volatilidade para maximizar retornos. Produtos: Private Equity, Derivativos, Fundos de Ações Agressivos.', color: '#ef4444' },
  ],
};

export const MOCK_SUITABILITY_HISTORY: SuitabilityAuditRecord[] = [
  {
    id: 'suit-2024-001',
    familyId: 'fam-001',
    tenantId: 'tenant-001',
    configVersion: '2024.1',
    answers: { q1: 4, q2: 3, q3: 3, q4: 3, q5: 3, q6: 4, q7: 3 },
    totalScore: 23,
    weightedScore: 73,
    riskProfile: 'growth',
    clientName: 'Robert Smith',
    clientDeclaration: true,
    pinConfirmed: true,
    submittedAt: '2024-03-15T14:22:11Z',
    ipAddress: '177.34.112.58',
    userAgent: 'Mozilla/5.0 (Macintosh)',
    expiresAt: '2026-03-15T14:22:11Z',
    status: 'superseded',
  },
  {
    id: 'suit-2026-001',
    familyId: 'fam-001',
    tenantId: 'tenant-001',
    configVersion: '2026.1',
    answers: { q1: 4, q2: 4, q3: 3, q4: 3, q5: 3, q6: 4, q7: 3 },
    totalScore: 24,
    weightedScore: 78,
    riskProfile: 'aggressive',
    clientName: 'Robert Smith',
    clientDeclaration: true,
    pinConfirmed: true,
    submittedAt: '2026-03-15T10:08:44Z',
    ipAddress: '177.34.112.58',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18)',
    expiresAt: '2028-03-15T10:08:44Z',
    status: 'active',
  },
];


export const RESEARCH_NOTES: ResearchNote[] = [
  {
    id: 'rn1',
    authorId: 'u1',
    title: 'H1 2026 Macro Outlook',
    content: 'Expecting terminal rates to stabilize. Overweighting tech and high-yield fixed income...',
    assetClasses: ['equity', 'fixed_income'],
    conviction: 'high',
    publishedAt: '2026-01-15T09:00:00Z'
  },
  {
    id: 'rn2',
    authorId: 'u2',
    title: 'Private Equity Secondary Market',
    content: 'Increased liquidity in secondaries at attractive discounts...',
    assetClasses: ['private_equity'],
    conviction: 'medium',
    publishedAt: '2026-02-10T14:30:00Z'
  }
];

export const CASH_POSITIONS: CashPosition[] = [
  {
    id: 'cp1',
    entityId: 'ent-1',
    bankName: 'JP Morgan',
    amount: 2500000,
    currency: 'USD',
    yield: 0.052,
    liquidityType: 'immediate'
  },
  {
    id: 'cp2',
    entityId: 'ent-2',
    bankName: 'Goldman Sachs',
    amount: 5000000,
    currency: 'USD',
    yield: 0.057,
    maturityDate: '2026-12-31',
    liquidityType: 'term'
  }
];

export const PORTFOLIOS: any[] = [
  { id: 'port-001', familyId: 'fam-001', name: 'Global Growth Portfolio', totalValueUsd: 45000000 },
  { id: 'port-002', familyId: 'fam-002', name: 'Preservation Trust', totalValueUsd: 12000000 },
];

export const TRANSACTIONS: Transaction[] = [
  { 
    id: 'tx-001', accountId: 'acc-001', familyId: 'fam-001', 
    transactionDate: '2026-03-15', transactionType: 'buy', securityName: 'Apple Inc.', ticker: 'AAPL', 
    quantity: 1000, price: 185.50, netAmount: 185500, currency: 'USD', amountUsd: 185500, 
    source: 'api', reconciled: true 
  },
];
