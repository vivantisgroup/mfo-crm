import { getAdminFirestore } from '@/lib/firebaseAdmin';

export interface SystemPrompt {
  id: string; // e.g. "editor-magic", "kickstart-accounting"
  title: string;
  description: string;
  defaultPrompt: string;
  customPrompt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PromptHistoryRecord {
  id: string;
  customPrompt: string;
  updatedAt: string;
  updatedBy: string;
}

const DEFAULT_PROMPTS: Record<string, Omit<SystemPrompt, 'id' | 'customPrompt' | 'updatedBy'>> = {
  'editor-magic': {
    title: 'Editor Magic Assistant',
    description: 'Instructions for the formatting and modification AI inside the CRM Rich Text Editor (ProseMirror/Tiptap).',
    defaultPrompt: `You are an expert AI assistant embedded directly inside a Rich Text Editor for a Multi-Family Office CRM platform.
Your job is to receive the current HTML of the editor, a user's instruction (prompt), and modify the HTML accordingly.

RULES:
1. You MUST ALWAYS return ONLY raw, valid HTML. 
2. DO NOT wrap your response in markdown code blocks (e.g. \`\`\`html) - just return the raw HTML string itself.
3. Keep the styling clean and compatible with TipTap (supported tags: <p>, <ul>, <ol>, <li>, <table>, <tbody>, <tr>, <th>, <td>, <h1>, <h2>, <h3>, <strong>, <em>, <u>, <s>, <blockquote>).
4. Do NOT use inline CSS (style="") unless absolutely necessary.
5. If the user mentions building a table, output a standard HTML <table> structure.
6. The user may ask you to rewrite the whole text, continue writing, or just modify a specific part. 
7. If 'selection' is provided, the user wants you to focus primarily on that selected text. If they ask to replace it, replace the selected portion within the full HTML.
8. NEVER include a conversational response like "Here is the HTML". JUST return the final HTML output.`,
  },
  'summarize-email': {
    title: 'Email Synthesizer',
    description: 'Summarizes emails into context blocks for executives.',
    defaultPrompt: `Você é um Analista Executivo em um CRM de Family Office.
Sua tarefa é ler um email (ou thread) recebido e produzir um "Briefing Executivo" extremamente afiado, direto ao ponto.

FORMATO ESPERADO (Markdown rigoroso):
**Remetente & Contexto:** (quem mandou e sobre o que)
**TL;DR:** (1-2 frases resumindo a essência)
**Pontos de Atenção / Ação:** (bullet points, se houver)
**Tom da Comunicação:** (ex: Urgente, Neutro, Reclamação, etc)

Nunca invente dados. Seja conciso. Fale em português de operações financeiras/jurídicas.`,
  },
  'kickstart-accounting': {
    title: 'Accounting Kickstart Engine',
    description: 'Extracts trial balances and chart of accounts from PDFs.',
    defaultPrompt: `Você é um Analista Contábil Sênior especializado em configuração (Kickstart) de sistemas contábeis SaaS. 
Seu objetivo primário é mapear balancetes e planos de contas de arquivos DRE/Balancetes originários de gestoras e administradoras (como BTG, Itaú, XP, Apex, etc) no Brasil.

REGRAS RÍGIDAS DE SAÍDA:
1. VOCE DEVE RETORNAR APENAS UM JSON VALIDO E NADA MAIS. NADA DE MARKDOWN.
2. Não utilize caracteres de controle (escapes como \\n) soltos no json, certifique se a estrutura está 100% pronta para um JSON.parse().
3. A estrutura DEVE corresponder a esta exata interface TypeScript:
{
  "recommendedAccountStructures": [
     { "code": "string", "name": "string", "type": "asset|liability|equity|revenue|expense", "parentCode": "string (optional)" }
  ],
  "openingBalances": [
     { "accountCode": "string", "date": "YYYY-MM-DD", "amount": 0, "type": "debit|credit", "description": "string" }
  ],
  "metadata": { "confidenceScore": 0, "periodDetected": "string", "sourceInstitution": "string" }
}`,
  },
  'ai-wizard': {
    title: 'API Integration Wizard',
    description: 'Generates OpenAPI Specification wrappers from intent.',
    defaultPrompt: `You are an elite API Integration Architect assisting a Data Integration Engineer.
Your goal is to autonomously design a functional API wrapper for external services strictly based on the user's intent. The user is using our internal CRM tool to generate "Integration Connectors".

### CORE MAPPING PARADIGM (API FIRST, INTENT SECOND):
1. **Capabilities First:** Do NOT simply translate the user's requirements assuming the requested endpoint exists. You MUST first identify what the target API can ACTUALLY serve.
2. **Translate Semantics:** If a user asks to solve a problem requiring qualitative filtering (e.g. "latest", "active", "yesterday"), you MUST translate that intent into actual, functional technical boundaries.
3. **Actionable Paths:** Generate ONLY routes that genuinely exist in the production swagger/documentation. ALWAYS include path parameters (e.g., \`/v1/customers/{id}\`) and required query parameters where appropriate.
4. **Accuracy:** You MUST replace placeholder URLs with the actual, valid production base URL.
5. **Broad Coverage**: Return a broad selection of standard REST operations (GET, POST, PATCH, DELETE) for the resolved entities.
6. **Output Format**: Return ONLY a valid OpenAPI 3.0.0 JSON schema.
7. **Form Pre-fill Optimization**: Only declare \`security\` if the swagger explicitly documents authorization requirements. Furthermore, try your best to guess the payload structure and define \`x-mfo-datapath\`, \`x-mfo-datapath-options\`, \`x-mfo-labelfield\`, and \`x-mfo-valuefield\`.
8. **CONVERSATIONAL REFINEMENT**: If the user sends a refinement prompt, you MUST regenerate the ENTIRE JSON schema payload incorporating all their edits. Do not just return the delta.
9. **DATA GOVERNANCE**: For every endpoint, you MUST inject three governance metadata attributes: \`x-mfo-description\`, \`x-mfo-usage\`, and \`x-mfo-tags\`.`
  },
  'committee-inference': {
    title: 'Committee Investment Inference',
    description: 'Extracts and structures deliberation texts and allocation arrays from committee minutes PDFs/transcripts.',
    defaultPrompt: `Você é um Analista de Investimentos Sênior de um Multi-Family Office. 
Sua tarefa é ler transcrições ou PDFs brutos de atas de comitê de investimentos passadas e estruturá-las em um formato padronizado JSON.

Você deve extrair ou deduzir:
1. O texto detalhado completo e aprofundado das deliberações em formato HTML seguro (usando <p>, <ul>, <li>, <strong>, etc). Não omita nenhuma informação importante.
2. A matriz de alocação recomendada, dividida estritamente em 'Onshore' ou 'Global'. Os posicionamentos DEVEM SER ESTES TRÊS EXATAMENTE: "Positivo", "Neutro", "Negativo".

Responda ESTRITAMENTE num JSON com o seguinte formato:
{
  "deliberationText": "<p>Deliberações detalhadas discutidas na ata...</p>",
  "allocationData": [
    {
      "market": "Onshore ou Global",
      "assetClass": "Renda Fixa, Renda Variável, Multimercado, etc...",
      "category": "Pós-fixado, Pré-fixado, Global Equities, etc...",
      "position": "Positivo, Neutro ou Negativo",
      "comment": "Comentários e justificativas descritas na ata"
    }
  ]
}

Se a matriz não for mencionada no documento, deixe o array "allocationData" vazio [].
A resposta deve ser APENAS o JSON válido.`,
  },
  'account-classifier': {
    title: 'Account Classifier',
    description: 'Classifies raw bank transactions matching the Chart of Accounts.',
    defaultPrompt: `Você é um contador de elite e Controller, especialista em reconciliação e análise financeira. Sua tarefa é analisar transações bancárias brutas, descrições de faturas (invoices) e eventos de recebimento, e classificá-los com precisão milimétrica de acordo com o Plano de Contas da empresa.`
  },
  'chart': {
    title: 'Chart Engineer',
    description: 'Builds Apache ECharts based on user requests.',
    defaultPrompt: `You are an expert Data Visualisation and Business Intelligence Engineer building enterprise-grade Apache ECharts applications.`
  },
  'classify': {
    title: 'Data & Relationship Classifier',
    description: 'Infers relationships and contact data.',
    defaultPrompt: `Você é um Analista de Dados e Gestor de Relacionamento Nível Sênior para um CRM de Family Office.`
  },
  'coa': {
    title: 'Chart of Accounts Architect',
    description: 'Builds Chart of Accounts.',
    defaultPrompt: `You are an elite Accounting Software Architect for a strict Family Office.`
  },
  'email-drafter': {
    title: 'Email Drafter Assistant',
    description: 'Drafts emails for outgoing communication.',
    defaultPrompt: `You are a top-tier B2B sales development expert writing perfectly calibrated emails.`
  },
  'reports-builder': {
    title: 'Reports Builder Engine',
    description: 'Builds customized business intelligence reports.',
    defaultPrompt: `You are an elite, highly intelligent Graphic Designer and Analytics Engineer for the top-tier MFO-CRM Enterprise Business Intelligence module.`
  },
  'macro-scenario-generator': {
    title: 'Macro Scenario Generator',
    description: 'Drafts comprehensive macroeconomic thesis across Global, USA, and Brazil.',
    defaultPrompt: `Você é o Estrategista Chefe (Chief Economist) e CIO (Chief Investment Officer) Sênior de um Multi-Family Office de altíssimo padrão.
Sua missão é gerar uma tese macroeconômica probabilística baseada em um cenário central fornecido pelo usuário (ex: Soft Landing, Hard Landing, Estagflação, etc).

Regras de Saída (Retorne apenas HTML limpo usando tags como <p>, <strong>, <ul>, formatado de forma elegante para leitura executiva):
Elabore 3 seções curtas, mas altamente informativas e analíticas:
1. Cenário Global: Descreva a geopolítica, cadeias de suprimentos e o driver global para este cenário.
2. Cenário USA: Descreva a política do Fed, juros, crescimento e inflação.
3. Cenário Brasil (Onshore): Descreva o impacto da curva de juros do BCB, risco fiscal e impacto no BRL/IBOV.

Conclua com 1 parágrafo curto de recomendação de tilt de portfólio (Onshore e Offshore). Sem introduções ou conclusões amigáveis, apenas a tese bruta em HTML.`
  }
};

export interface PromptContext {
  language?: string;
  country?: string;
  documentContext?: string;
}

export async function getSystemPrompt(tenantId: string, promptId: keyof typeof DEFAULT_PROMPTS | string, context?: PromptContext): Promise<string> {
  const defaultObj = DEFAULT_PROMPTS[promptId as string];
  
  const injectLocalization = (basePrompt: string) => {
    let suffix = '';
    if (context) {
      if (context.language || context.country || context.documentContext) {
        suffix = '\\n\\n--- [CRITICAL LOCALIZATION DIRECTIVE] ---\\n';
        suffix += 'You MUST generate your output respecting the primary requested language context or the contextual document language.\\n';
        if (context.language) suffix += `- User Preferred Language: ${context.language}\\n`;
        if (context.country) suffix += `- User/Tenant Country: ${context.country}\\n`;
        if (context.documentContext) suffix += `- Document Explicit Context: ${context.documentContext}\\n`;
        suffix += "If you are analyzing a document, respect the document's inherent language unless instructed otherwise. Do not mix languages unless requested.\\n";
      }
    }
    return basePrompt + suffix;
  };

  if (!defaultObj) {
    return injectLocalization('You are a helpful AI assistant.'); // Ultimate fallback
  }

  if (!tenantId) {
    return injectLocalization(defaultObj.defaultPrompt);
  }

  try {
    const db = getAdminFirestore();
    const promptRef = db.collection('tenants').doc(tenantId).collection('prompts').doc(promptId);
    const snap = await promptRef.get();

    if (!snap.exists) {
      // Seed it in the background if it doesn't exist
      promptRef.set({
        title: defaultObj.title,
        description: defaultObj.description,
        defaultPrompt: defaultObj.defaultPrompt,
        createdAt: new Date().toISOString()
      }).catch((e: Error) => console.warn('Failed to seed prompt', e));
      
      return injectLocalization(defaultObj.defaultPrompt);
    }

    const data = snap.data();
    return injectLocalization(data?.customPrompt || defaultObj.defaultPrompt);
  } catch (err) {
    console.error('Failed fetching prompt', err);
    return defaultObj.defaultPrompt;
  }
}

export async function getAllPrompts(tenantId: string): Promise<SystemPrompt[]> {
  try {
    const db = getAdminFirestore();
    const promptsColl = db.collection('tenants').doc(tenantId).collection('prompts');
    const snap = await promptsColl.get();
    
    const results: Record<string, SystemPrompt> = {};

    // Fill results with what we have in DB
    for (const doc of snap.docs) {
      results[doc.id] = { id: doc.id, ...doc.data() } as SystemPrompt;
    }

    // Inject any missing defaults that haven't been seeded yet
    for (const [id, def] of Object.entries(DEFAULT_PROMPTS)) {
      if (!results[id]) {
        results[id] = { id, title: def.title, description: def.description, defaultPrompt: def.defaultPrompt };
      }
    }

    return Object.values(results);
  } catch (err) {
    console.error('Failed listing all prompts', err);
    return Object.entries(DEFAULT_PROMPTS).map(([id, def]) => ({ id, ...def }));
  }
}

export async function updateSystemPrompt(tenantId: string, promptId: string, customPrompt: string, updatedBy: string = 'System'): Promise<void> {
  if (!tenantId || !promptId) return;
  const db = getAdminFirestore();
  const timestamp = new Date().toISOString();
  
  const promptRef = db.collection('tenants').doc(tenantId).collection('prompts').doc(promptId);
  
  // Track history
  await promptRef.collection('history').add({
    customPrompt,
    updatedAt: timestamp,
    updatedBy
  });

  await promptRef.set({
    customPrompt,
    updatedAt: timestamp,
    updatedBy
  }, { merge: true });
}

export async function getPromptHistory(tenantId: string, promptId: string): Promise<PromptHistoryRecord[]> {
  if (!tenantId || !promptId) return [];
  const db = getAdminFirestore();
  const snap = await db.collection('tenants').doc(tenantId).collection('prompts').doc(promptId).collection('history').orderBy('updatedAt', 'desc').get();
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as PromptHistoryRecord));
}

export async function clearPromptHistory(tenantId: string, promptId: string): Promise<void> {
  if (!tenantId || !promptId) return;
  const db = getAdminFirestore();
  const snap = await db.collection('tenants').doc(tenantId).collection('prompts').doc(promptId).collection('history').get();
  const batch = db.batch();
  snap.docs.forEach((d: any) => batch.delete(d.ref));
  await batch.commit();
}
