export const DICT_EN = {
  // Types
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',

  // UI Labels
  accountCode: 'Account Code',
  accountName: 'Account Name',
  classificationType: 'Classification Type',
  isGroupAccount: 'This is a Group Account',
  cancel: 'Cancel',
  addAccount: 'Add Account',
  
  // Tabs
  tabCopilot: 'Copilot Hub',
  tabRecon: 'Bank Reconciliation',
  tabCOA: 'Chart of Accounts',
  tabDRE: 'Income Statement (P&L)',
  tabBalance: 'Balance Sheet',
  
  // General
  search: 'Search...',
};

export const DICT_PT = {
  // Types
  ASSET: 'Ativo',
  LIABILITY: 'Passivo',
  EQUITY: 'Patrimônio',
  REVENUE: 'Receita',
  EXPENSE: 'Despesa',

  // UI Labels
  accountCode: 'Código da Conta',
  accountName: 'Nome da Conta',
  classificationType: 'Tipo de Classificação',
  isGroupAccount: 'Esta é uma conta de grupo',
  cancel: 'Cancelar',
  addAccount: 'Adicionar Conta',

  // Tabs
  tabCopilot: 'Copilot Hub',
  tabRecon: 'Conciliação Bancária',
  tabCOA: 'Plano de Contas',
  tabDRE: 'DRE',
  tabBalance: 'Balanço Patrimonial',

  // General
  search: 'Buscar...',
};

export function getDictionary(languageCode: string) {
  if (languageCode?.toLowerCase().startsWith('pt')) {
    return DICT_PT;
  }
  // Default to English
  return DICT_EN;
}
