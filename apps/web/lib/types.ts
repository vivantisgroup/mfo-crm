// ─── Core Enums ────────────────────────────────────────────────────────────

export type RiskProfile = 'conservative' | 'balanced' | 'growth' | 'aggressive';
export type ServiceTier = 'platinum' | 'gold' | 'standard';
export type KycStatus = 'pending' | 'in_review' | 'approved' | 'flagged';
export type EntityType = 'trust' | 'corporation' | 'foundation' | 'llc' | 'partnership' | 'individual';
export type AssetClass = 'equity' | 'fixed_income' | 'private_equity' | 'real_estate' | 'hedge_fund' | 'cash' | 'structured' | 'venture_capital';
export type ActivityType = 'email' | 'call' | 'meeting' | 'note' | 'task_completed' | 'document_shared' | 'capital_call';
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type DocumentType = 'trust_deed' | 'will' | 'tax_return' | 'financial_statement' | 'investment_doc' | 'kyc' | 'legal_agreement' | 'passport' | 'report';
export type ServiceRequestType = 'travel' | 'property' | 'healthcare' | 'education' | 'event' | 'legal' | 'other';
export type UserRole = 'firm_admin' | 'cio' | 'relationship_manager' | 'controller' | 'compliance_officer' | 'report_viewer';

export interface Tenant {
  id: string;
  name: string;
  subdomain?: string;
  logoUrl?: string;
  brandColor?: string;
  status: 'active' | 'suspended' | 'onboarding';
  createdAt: string;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: UserRole;
  joinedAt: string;
}

// ─── Family & CRM ──────────────────────────────────────────────────────────

export interface FamilyMember {
  id: string;
  familyId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  nationality?: string[];
  roleInFamily: string;
  generation: number;
  email?: string;
  phone?: string;
  kycStatus: KycStatus;
  pepFlag: boolean;
  avatarUrl?: string;
  tags?: string[];
}

export interface Entity {
  id: string;
  familyId: string;
  name: string;
  entityType: EntityType;
  jurisdiction: string;
  currency: string;
  status: 'active' | 'dormant' | 'dissolved';
  totalValue?: number;
  parentEntityId?: string;
  tags?: string[];
}

export interface ServiceProvider {
  id: string;
  providerType: 'attorney' | 'accountant' | 'banker' | 'investment_advisor' | 'consultant';
  firmName?: string;
  contactName: string;
  email?: string;
  jurisdiction?: string;
  specialty?: string[];
}

export interface NetworkNode {
  id: string;
  name: string;
  nodeType: 'family' | 'member' | 'entity' | 'provider' | 'group';
  subType?: string; // e.g. 'trust', 'attorney', 'Patriarch'
  avatar?: string;
  familyId?: string;
  /** For provider contacts: the institution they belong to. Nodes sharing a groupKey collapse under one card. */
  groupKey?: string;
  /** Display name for the collapsed group card */
  groupLabel?: string;
}


export interface RelationshipEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: 'owns' | 'parent_of' | 'married_to' | 'advises' | 'trustee_of' | 'beneficiary_of' | 'board_member' | 'partner';
  note?: string;
}

export interface Family {
  id: string;
  name: string;
  code: string;
  inceptionDate?: string;
  domicileCountry: string;
  riskProfile: RiskProfile;
  serviceTier: ServiceTier;
  assignedRmId: string;
  assignedRmName: string;
  kycStatus: KycStatus;
  amlStatus: 'clear' | 'flagged' | 'review';
  totalAum: number; // USD
  currency: string;
  members: FamilyMember[];
  entities: Entity[];
  lastActivityAt: string;
  tags?: string[];
  notes?: string;
}

export type DocumentCategory = 
  | 'onboarding' // KYC, Agreements
  | 'suitability' // Questionnaires, Risk Profiles, IPS
  | 'investment' // Planning, Proposals, Trade Records
  | 'compliance' // Form CRS, Privacy, Regulatory
  | 'correspondence' // Emails, Meeting Notes
  | 'legal' // Trust Deeds, Passports
  | 'tax'; // K-1s, Returns

export interface Document {
  id: string;
  tenantId?: string;
  familyId: string;
  familyName?: string;
  memberId?: string;
  entityId?: string;
  entityName?: string;
  documentType?: DocumentType | string;
  title: string;
  category?: DocumentCategory;
  fileUrl?: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  fileSizeBytes?: number;
  mimeType?: string;
  uploadedBy: string;
  uploadedAt?: string;
  createdAt?: string;
  tags?: string[];
  status?: 'draft' | 'final' | 'archived';
  version?: number;
  isConfidential?: boolean;
  requiresSignature?: boolean;
  signatureStatus?: string;
  expiryDate?: string;
}

// ─── Financial ─────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  entityId: string;
  familyId: string;
  custodianName: string;
  accountNumber?: string;
  accountName: string;
  accountType: string;
  currency: string;
  currentBalance: number; // in account currency
  currentBalanceUsd: number;
  lastUpdated: string;
}

export interface Holding {
  id: string;
  accountId: string;
  familyId: string;
  securityName: string;
  isin?: string;
  ticker?: string;
  assetClass: AssetClass;
  assetSubclass?: string;
  quantity?: number;
  price?: number;
  marketValueUsd: number;
  costBasisUsd?: number;
  unrealizedPnl?: number;
  unrealizedPnlPct?: number;
  geography?: string;
  sector?: string;
  currency: string;
  isPrivate: boolean;
  asOfDate: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  familyId: string;
  transactionDate: string;
  transactionType: string;
  securityName?: string;
  ticker?: string;
  quantity?: number;
  price?: number;
  netAmount: number;
  currency: string;
  amountUsd: number;
  description?: string;
  source: 'manual' | 'ocr' | 'api' | 'csv_import';
  reconciled: boolean;
}

export interface PrivateInvestment {
  id: string;
  familyId: string;
  accountId: string;
  investmentName: string;
  investmentType: 'private_equity' | 'venture_capital' | 'hedge_fund' | 'real_estate' | 'direct';
  fundManager?: string;
  vintageYear?: number;
  commitmentAmount: number;
  investedAmount: number;
  unfundedCommitment: number;
  currentNav: number;
  navAsOfDate: string;
  irr?: number;
  moic?: number;
  tvpi?: number;
  dpi?: number;
  status: 'active' | 'fully_realized' | 'partially_realized';
  currency: string;
}

export interface CapitalCall {
  id: string;
  privateInvestmentId: string;
  investmentName: string;
  familyId: string;
  callDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue';
}

// ─── Consolidated Portfolio ─────────────────────────────────────────────────

export interface AllocationSlice {
  assetClass: string;
  value: number;
  pct: number;
  color: string;
}

export interface ConsolidatedBalanceSheet {
  familyId: string;
  familyName: string;
  asOfDate: string;
  totalNetWorth: number;
  currency: string;
  allocation: AllocationSlice[];
  geographyExposure: { name: string; pct: number }[];
  currencyExposure: { currency: string; pct: number }[];
  liquidityProfile: {
    dailyLiquid: number;
    within30Days: number;
    within90Days: number;
    locked: number;
  };
  twrYtd: number;
  twrInception: number;
  benchmarkTwrYtd: number;
}

export interface PerformancePoint {
  date: string;
  portfolioValue: number;
  benchmarkValue: number;
}

// ─── CRM ───────────────────────────────────────────────────────────────────

export interface Activity {
  id: string;
  familyId: string;
  familyName: string;
  memberName?: string;
  activityType: ActivityType;
  subject: string;
  body?: string;
  summaryAi?: string;
  direction?: 'inbound' | 'outbound';
  occurredAt: string;
  createdBy: string;
  source: 'manual' | 'email_sync' | 'calendar_sync';
  tags: string[];
  sentiment?: 'neutral' | 'positive' | 'concern' | 'urgent';
}

export interface Task {
  id: string;
  familyId: string;
  familyName: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  taskTypeId?: string;         // links to TaskType for SLA
  queueId?: string;            // queue this task lives in
  assignedTo?: string;         // legacy name field
  assignedUserId?: string;     // user who picked it up
  assignedUserName?: string;
  pickedUpAt?: string;         // ISO — when a user accepted from queue
  dueDate?: string;
  completedAt?: string;
  source: 'manual' | 'email_ai' | 'concierge';
  createdAt: string;
  tags: string[];
  slaBreached?: boolean;
  slaBreachMinutes?: number;   // how many minutes over SLA
}

// ─── Task Queues ───────────────────────────────────────────────────────────

export interface TaskQueue {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;               // CSS color for queue chip
  memberIds: string[];         // user IDs who belong to this queue
  assignSlaMinutes: number;    // SLA: max time before task must be picked up
}

// ─── Task Types ────────────────────────────────────────────────────────────

export interface TaskType {
  id: string;
  name: string;
  icon: string;
  completionSlaHours: number;  // SLA: max hours to complete
  defaultQueueId?: string;
  defaultPriority: TaskPriority;
  color?: string;
}

// ─── Time Tracking ─────────────────────────────────────────────────────────

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  familyId?: string;
  activityType: ActivityType;
  startedAt: string;           // ISO
  endedAt?: string;            // ISO — undefined if clock still running
  durationMinutes?: number;    // computed on stop; rounded to tenant interval (default 15)
  notes?: string;
}

// ─── Notifications ─────────────────────────────────────────────────────────

export type NotificationType =
  | 'sla_assign_breach'
  | 'sla_completion_breach'
  | 'task_assigned'
  | 'task_overdue'
  | 'task_completed';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  taskId?: string;
  queueId?: string;
  familyId?: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;           // ISO
  dismissedAt?: string;
  readAt?: string;
}


// [REMOVED REDUNDANT DOCUMENT INTERFACE]

// ─── Governance ────────────────────────────────────────────────────────────

export interface GovernanceStructure {
  id: string;
  familyId: string;
  familyName: string;
  name: string;
  structureType: 'family_council' | 'advisory_board' | 'investment_committee';
  memberCount: number;
  lastMeetingDate?: string;
  nextMeetingDate?: string;
}

export interface GovernanceMeeting {
  id: string;
  governanceId: string;
  governanceName: string;
  familyId: string;
  familyName: string;
  meetingDate: string;
  location?: string;
  agenda?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  attendeeCount?: number;
}

export interface Vote {
  id: string;
  meetingId: string;
  resolution: string;
  voteResult: 'passed' | 'rejected' | 'tabled';
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  voteDate: string;
}

// ─── Estate ────────────────────────────────────────────────────────────────

export interface EstatePlan {
  id: string;
  familyId: string;
  familyName: string;
  entityName?: string;
  planType: string;
  jurisdiction: string;
  estimatedEstateValue: number;
  estimatedTaxLiability: number;
  lastReviewedDate?: string;
  attorneyName?: string;
  primaryBeneficiaries: string[];
  notes?: string;
}

// ─── Concierge ─────────────────────────────────────────────────────────────

export interface ServiceRequest {
  id: string;
  familyId: string;
  familyName: string;
  memberName?: string;
  serviceType: ServiceRequestType;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  priority: TaskPriority;
  assignedTo?: string;
  requestedDate: string;
  targetDate?: string;
  createdAt: string;
}

// ─── Platform ──────────────────────────────────────────────────────────────

export interface PlatformUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  familyScope?: string[];
  lastLoginAt?: string;
  mfaEnabled: boolean;
  status: 'active' | 'inactive' | 'invited';
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  action: string;
  resourceId: string;
  resourceType: string;
  resourceName?: string;
  status?: 'success' | 'failure' | 'warning';
  metadata?: string; // JSON string
  ipAddress?: string;
  userAgent?: string;
  occurredAt: string;
}

export interface DashboardStats {
  totalAum: number;
  totalFamilies: number;
  activeTasksCount: number;
  capitalCallsDue: number;
  capitalCallsAmount: number;
  documentsAwaitingReview: number;
  openServiceRequests: number;
  pendingKyc: number;
}

// ─── KYI & Suitability ──────────────────────────────────────────────────────

export interface SuitabilityQuestionOption {
  value: string;
  label: string;
  score: number;
}

export interface SuitabilityQuestion {
  id: string;
  question: string;
  helpText?: string;
  options: SuitabilityQuestionOption[];
  category: 'risk_tolerance' | 'knowledge' | 'time_horizon' | 'liquidity' | 'objectives' | 'experience';
  weight: number;    // relative weight in final score (default 1)
  required: boolean;
  order: number;
}

/** Per-tenant suitability configuration — customizable via admin panel */
export interface SuitabilityConfig {
  tenantId: string;
  name: string;            // e.g. "ANBIMA Perfil de Investidor v2"
  version: string;
  questions: SuitabilityQuestion[];
  /** Score bands → profile mapping */
  bands: {
    label: RiskProfile;
    minScore: number;
    maxScore: number;
    description: string;
    color: string;
  }[];
  /** Renewal interval in months (ANBIMA standard: 24) */
  renewalMonths: number;
  /** Legal declaration text shown before acceptance */
  declarationText: string;
  /** Whether to request a transactional PIN from the client */
  requirePin: boolean;
}

export interface SuitabilityAssessment {
  id: string;
  familyId: string;
  assessedBy: string;
  date: string;
  scores: {
    risk: number;
    knowledge: number;
    horizon: number;
  };
  finalProfile: RiskProfile;
  status: 'draft' | 'submitted' | 'expired';
  notes?: string;
}

/** Immutable audit record created on each compliant digital submission */
export interface SuitabilityAuditRecord {
  id: string;
  familyId: string;
  tenantId: string;
  configVersion: string;
  answers: Record<string, number>;   // questionId → option score
  totalScore: number;
  weightedScore: number;
  riskProfile: RiskProfile;
  clientName: string;
  clientDeclaration: boolean;        // "Declaro que as informações são verdadeiras"
  pinConfirmed: boolean;             // transactional PIN accepted
  submittedAt: string;               // ISO timestamp
  ipAddress: string;
  userAgent: string;
  expiresAt: string;                 // submittedAt + renewalMonths
  status: 'active' | 'superseded' | 'expired';
}

export interface SuitabilitySubmission {
  id: string;
  assessmentId: string;
  familyId: string;
  clientName: string;
  answers: Record<string, number>;
  score: number;
  riskProfile: RiskProfile;
  signedAt: string;
  signatureBase64?: string; // Digital signature
  ipAddress: string;
  userAgent: string;
}


// ─── Investment Advisory ─────────────────────────────────────────────────────

export interface InvestmentProposal {
  id: string;
  familyId: string;
  title: string;
  summary: string;
  proposingRmId: string;
  status: 'draft' | 'presented' | 'approved' | 'rejected' | 'implemented';
  assetAllocationImpact: {
    assetClass: AssetClass;
    currentPct: number;
    targetPct: number;
  }[];
  rationale: string;
  createdAt: string;
}

export interface ResearchNote {
  id: string;
  authorId: string;
  title: string;
  content: string;
  assetClasses: AssetClass[];
  conviction: 'low' | 'medium' | 'high';
  publishedAt: string;
}

export interface CashPosition {
  id: string;
  entityId: string;
  bankName: string;
  amount: number;
  currency: string;
  yield: number;
  maturityDate?: string;
  liquidityType: 'immediate' | 'term' | 'notice';
}
