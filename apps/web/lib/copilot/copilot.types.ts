/**
 * copilot.types.ts
 *
 * Single source of truth for all AI Co-Pilot data models.
 * These interfaces define the contract between:
 *   - Whisper transcription hook
 *   - /api/copilot/analyze edge function (Groq)
 *   - Firestore real-time state
 *   - Seller UI components
 */

// ─── Session ──────────────────────────────────────────────────────────────────

export type SalesMethodology = 'MEDDIC' | 'SPIN' | 'Challenger' | 'Custom';
export type SessionStatus = 'idle' | 'recording' | 'paused' | 'ended';

/** Injected before the session starts — fully agnostic of industry/product */
export interface SessionContext {
  sessionId:          string;
  tenantId:           string;
  userId:             string;
  startedAt:          string;
  status:             SessionStatus;
  // User-configurable context
  industry:           string;      // e.g. "Wealth Management"
  productName:        string;      // e.g. "Vivantis Family Office Platform"
  targetPersona:      string;      // e.g. "UHNW Family Principal"
  methodology:        SalesMethodology;
  customMethodology?: string[];    // Stage names when methodology === 'Custom'
  knowledgeBaseId?:   string;      // Qdrant collection ID
  language:           string;      // BCP-47 code, e.g. "en" | "pt"
  // Session metadata
  callTitle?:         string;
  endedAt?:           string;
}

// ─── Transcript ───────────────────────────────────────────────────────────────

export type SpeakerLabel = 'seller' | 'buyer' | 'unknown';

export interface TranscriptChunk {
  sessionId:  string;
  chunkId:    string;
  speaker:    SpeakerLabel;
  text:       string;
  confidence: number;              // 0–1
  startMs:    number;              // offset from session start in ms
  endMs:      number;
  createdAt:  string;
}

// ─── Methodology State Fields ─────────────────────────────────────────────────

export interface MethodologyField {
  covered:   boolean;
  evidence:  string;               // quoted transcript text that satisfied this field
  score:     number;               // 0–100 coverage score
  updatedAt: string;
}

// ─── MEDDIC ───────────────────────────────────────────────────────────────────

export interface MeddicState {
  sessionId:        string;
  metrics:          MethodologyField;
  economicBuyer:    MethodologyField;
  decisionCriteria: MethodologyField;
  decisionProcess:  MethodologyField;
  identifyPain:     MethodologyField;
  champion:         MethodologyField;
  overallScore:     number;
  updatedAt:        string;
}

export const MEDDIC_FIELDS: (keyof Omit<MeddicState, 'sessionId' | 'overallScore' | 'updatedAt'>)[] = [
  'metrics', 'economicBuyer', 'decisionCriteria', 'decisionProcess', 'identifyPain', 'champion',
];

export const MEDDIC_LABELS: Record<string, string> = {
  metrics:          'Metrics',
  economicBuyer:    'Economic Buyer',
  decisionCriteria: 'Decision Criteria',
  decisionProcess:  'Decision Process',
  identifyPain:     'Identify Pain',
  champion:         'Champion',
};

// ─── SPIN ─────────────────────────────────────────────────────────────────────

export interface SpinState {
  sessionId:    string;
  situation:    MethodologyField;
  problem:      MethodologyField;
  implication:  MethodologyField;
  needPayoff:   MethodologyField;
  overallScore: number;
  updatedAt:    string;
}

export const SPIN_FIELDS: (keyof Omit<SpinState, 'sessionId' | 'overallScore' | 'updatedAt'>)[] = [
  'situation', 'problem', 'implication', 'needPayoff',
];

export const SPIN_LABELS: Record<string, string> = {
  situation:   'Situation',
  problem:     'Problem',
  implication: 'Implication',
  needPayoff:  'Need-Payoff',
};

// ─── Challenger ───────────────────────────────────────────────────────────────

export interface ChallengerState {
  sessionId:    string;
  teach:        MethodologyField;
  tailor:       MethodologyField;
  takeControl:  MethodologyField;
  overallScore: number;
  updatedAt:    string;
}

export const CHALLENGER_FIELDS: (keyof Omit<ChallengerState, 'sessionId' | 'overallScore' | 'updatedAt'>)[] = [
  'teach', 'tailor', 'takeControl',
];

export const CHALLENGER_LABELS: Record<string, string> = {
  teach:       'Teach',
  tailor:      'Tailor',
  takeControl: 'Take Control',
};

// ─── Union type for methodology state ─────────────────────────────────────────

export type MethodologyState = MeddicState | SpinState | ChallengerState;

// ─── Intent Classification ────────────────────────────────────────────────────

export type IntentLabel =
  | 'objection'
  | 'buying_signal'
  | 'discovery'
  | 'pain_expressed'
  | 'budget_mentioned'
  | 'competitor_mentioned'
  | 'timeline_mentioned'
  | 'stakeholder_mentioned'
  | 'closing_signal'
  | 'neutral';

export interface IntentResult {
  sessionId:     string;
  chunkId:       string;
  label:         IntentLabel;
  confidence:    number;           // 0–1
  reasoning:     string;           // Groq's one-line rationale
  updatedFields: string[];         // Which methodology fields were affected
  createdAt:     string;
}

export const INTENT_LABELS: Record<IntentLabel, string> = {
  objection:             'Objection',
  buying_signal:         'Buying Signal',
  discovery:             'Discovery',
  pain_expressed:        'Pain Expressed',
  budget_mentioned:      'Budget',
  competitor_mentioned:  'Competitor',
  timeline_mentioned:    'Timeline',
  stakeholder_mentioned: 'Stakeholder',
  closing_signal:        'Closing Signal',
  neutral:               'Neutral',
};

export const INTENT_COLORS: Record<IntentLabel, string> = {
  objection:             '#ef4444',
  buying_signal:         '#22c55e',
  discovery:             '#6366f1',
  pain_expressed:        '#f59e0b',
  budget_mentioned:      '#38bdf8',
  competitor_mentioned:  '#f97316',
  timeline_mentioned:    '#8b5cf6',
  stakeholder_mentioned: '#06b6d4',
  closing_signal:        '#10b981',
  neutral:               '#475569',
};

// ─── Flashcard ────────────────────────────────────────────────────────────────

export type FlashcardType =
  | 'objection_handler'
  | 'value_statement'
  | 'discovery_prompt'
  | 'competitor_counter'
  | 'closing_move'
  | 'insight';

export interface Flashcard {
  sessionId:  string;
  cardId:     string;
  type:       FlashcardType;
  trigger:    string;              // Transcript text that triggered this card
  headline:   string;              // Short, bold title ≤ 8 words
  body:       string;              // Full suggested response (1–3 sentences)
  source?:    string;              // RAG source doc reference
  dismissed:  boolean;
  createdAt:  string;
  priority:   'high' | 'normal';
}

export const FLASHCARD_TYPE_LABELS: Record<FlashcardType, string> = {
  objection_handler:  'Handle Objection',
  value_statement:    'Value Statement',
  discovery_prompt:   'Discovery',
  competitor_counter: 'Competitor Counter',
  closing_move:       'Closing Move',
  insight:            'Insight',
};

export const FLASHCARD_TYPE_COLORS: Record<FlashcardType, string> = {
  objection_handler:  '#ef4444',
  value_statement:    '#22c55e',
  discovery_prompt:   '#6366f1',
  competitor_counter: '#f97316',
  closing_move:       '#10b981',
  insight:            '#8b5cf6',
};

// ─── Edge Function Payloads ───────────────────────────────────────────────────

export interface AnalyzeRequest {
  context:      SessionContext;
  chunk:        TranscriptChunk;
  recentChunks: TranscriptChunk[];       // last N chunks for conversational context
  currentState: MethodologyState | null;
}

export interface AnalyzeResponse {
  intent:       IntentResult;
  flashcard:    Flashcard | null;
  statePatches: Record<string, Partial<MethodologyField>>;
}

// ─── Default state factories ──────────────────────────────────────────────────

const emptyField = (): MethodologyField => ({
  covered: false, evidence: '', score: 0, updatedAt: new Date().toISOString(),
});

export function defaultMeddicState(sessionId: string): MeddicState {
  return {
    sessionId,
    metrics:          emptyField(),
    economicBuyer:    emptyField(),
    decisionCriteria: emptyField(),
    decisionProcess:  emptyField(),
    identifyPain:     emptyField(),
    champion:         emptyField(),
    overallScore: 0,
    updatedAt:    new Date().toISOString(),
  };
}

export function defaultSpinState(sessionId: string): SpinState {
  return {
    sessionId,
    situation:   emptyField(),
    problem:     emptyField(),
    implication: emptyField(),
    needPayoff:  emptyField(),
    overallScore: 0,
    updatedAt:    new Date().toISOString(),
  };
}

export function defaultChallengerState(sessionId: string): ChallengerState {
  return {
    sessionId,
    teach:       emptyField(),
    tailor:      emptyField(),
    takeControl: emptyField(),
    overallScore: 0,
    updatedAt:    new Date().toISOString(),
  };
}
