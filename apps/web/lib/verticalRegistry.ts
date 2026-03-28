/**
 * verticalRegistry.ts
 *
 * Single source of truth for all supported industry verticals on the platform.
 * Each vertical defines available modules, default roles, sidebar navigation,
 * and provisioning settings that are applied when a new tenant is created.
 *
 * PRIMARY VERTICAL: multi_family_office  (MFO — full feature set, GA)
 * All other verticals are either GA (general), beta, or coming_soon.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type IndustryVerticalId =
  | 'multi_family_office'
  | 'independent_advisor'
  | 'medical_practice'
  | 'legal_firm'
  | 'accounting_cpa'
  | 'real_estate'
  | 'generic_business';

export type ModuleId =
  // MFO / Advisory modules
  | 'families'         // Client family management (MFO core)
  | 'contacts_crm'     // Contacts directory (people)
  | 'organizations'    // Organizations (companies, trusts, entities)
  | 'portfolio'        // Portfolio monitoring and analytics
  | 'wealth'           // Wealth planning and reports
  | 'documents'        // Document vault
  | 'activities'       // Communication & activity log
  | 'tasks'            // Task management
  | 'calendar'         // Calendar & scheduling
  | 'governance'       // Fund governance & voting
  | 'estate'           // Succession & estate planning
  | 'concierge'        // Lifestyle & concierge services
  | 'reports'          // Report generation
  | 'inbox'            // Email inbox integration
  | 'copilot'          // AI Co-Pilot
  // Medical modules
  | 'patients'         // Patient records
  | 'appointments'     // Appointment scheduling
  | 'billing_medical'  // Medical billing & insurance
  | 'prescriptions'    // Prescription management
  | 'records'          // Clinical records
  // Legal modules
  | 'clients'          // Client management
  | 'cases'            // Case / matter management
  | 'billing_legal'    // Time & billing
  | 'contracts'        // Contract management
  // Accounting modules
  | 'engagements'      // Client engagements
  | 'billing_acct'     // Billing & invoicing
  | 'deadlines'        // Tax / filing deadlines
  // Real estate modules
  | 'properties'       // Property listings
  | 'deals'            // Deal pipeline
  | 'listings'         // MLS / listing management
  // Generic
  | 'contacts'         // Generic contacts CRM
  | 'projects'         // Project management
  | 'invoicing';       // Invoicing / payments

export interface NavSection {
  section:  string;
  items:    Array<{ href: string; icon: string; label: string; badge?: string; subItems?: Array<{ href: string; label: string }> }>;
}

export interface VerticalDefinition {
  id:               IndustryVerticalId;
  label:            string;
  shortLabel:       string;
  icon:             string;
  tagline:          string;
  color:            string;             // accent color for this vertical
  status:           'ga' | 'beta' | 'coming_soon';
  availableModules: ModuleId[];
  defaultModules:   ModuleId[];         // enabled by default on tenant creation
  defaultRoles:     string[];           // roles to create in tenant
  nav:              NavSection[];       // sidebar navigation for tenant users
  complianceFrameworks: string[];       // regulatory frameworks to pre-configure
  defaultCurrencies: string[];          // most common currencies for vertical
}

// ─── MFO Navigation (primary) ─────────────────────────────────────────────────

const MFO_NAV: NavSection[] = [
  {
    section: 'Main',
    items: [
      { href: '/dashboard',   icon: '◉',  label: 'Dashboard' },
      { href: '/inbox',       icon: '📬', label: 'Inbox' },
      { href: '/copilot',     icon: '🤖', label: 'Co-Pilot' },
    ],
  },
  {
    section: 'CRM Central',
    items: [
      {
        href: '/relationships',
        icon: '👥',
        label: 'Relationships',
        subItems: [
          { href: '/clients',                     label: 'Clients (360°)' },
          { href: '/relationships/organizations', label: 'Organizations' },
          { href: '/relationships/contacts',      label: 'Contacts' },
        ]
      },
      { href: '/activities',     icon: '💬', label: 'Activities' },
      { href: '/tasks',          icon: '✓',  label: 'Tasks' },
      { href: '/calendar',       icon: '📅', label: 'Calendar' },
    ],
  },
  {
    section: 'Wealth',
    items: [
      { href: '/portfolio',          icon: '📊', label: 'Portfolio' },
      { href: '/financial-engineer', icon: '⚙', label: 'Financial Eng.' },
      { href: '/documents',          icon: '🗄', label: 'Documents' },
      { href: '/reports',            icon: '📈', label: 'Reports' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { href: '/governance', icon: '🏛', label: 'Governance' },
      { href: '/estate',     icon: '⚖', label: 'Succession' },
      { href: '/concierge',  icon: '🛎', label: 'Concierge' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { href: '/admin/users', icon: '👤', label: 'Users' },
      { href: '/admin',       icon: '⚙',  label: 'Admin' },
    ],
  },
];

const ADVISOR_NAV: NavSection[] = [
  {
    section: 'Main',
    items: [
      { href: '/dashboard',  icon: '◉',  label: 'Dashboard' },
      { href: '/inbox',      icon: '📬', label: 'Inbox' },
      { href: '/copilot',    icon: '🤖', label: 'Co-Pilot' },
    ],
  },
  {
    section: 'CRM',
    items: [
      { href: '/clients',        icon: '👥', label: 'Clients' },
      { href: '/contacts',       icon: '👤', label: 'Contacts' },
      { href: '/organizations',  icon: '🏢', label: 'Organizations' },
      { href: '/activities',     icon: '💬', label: 'Activities' },
      { href: '/tasks',          icon: '✓',  label: 'Tasks' },
      { href: '/calendar',       icon: '📅', label: 'Calendar' },
    ],
  },
  {
    section: 'Advisory',
    items: [
      { href: '/portfolio',          icon: '📊', label: 'Portfolios' },
      { href: '/financial-engineer', icon: '⚙', label: 'Financial Eng.' },
      { href: '/reports',            icon: '📈', label: 'Reports' },
      { href: '/documents',          icon: '🗄', label: 'Documents' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { href: '/admin/users', icon: '👤', label: 'Users' },
      { href: '/admin',       icon: '⚙',  label: 'Admin' },
    ],
  },
];

const MEDICAL_NAV: NavSection[] = [
  {
    section: 'Main',
    items: [
      { href: '/dashboard',    icon: '◉',  label: 'Dashboard' },
      { href: '/patients',     icon: '🩺', label: 'Patients' },
      { href: '/appointments', icon: '📅', label: 'Appointments' },
      { href: '/tasks',        icon: '✓',  label: 'Tasks' },
      { href: '/inbox',        icon: '📬', label: 'Inbox' },
    ],
  },
  {
    section: 'Clinical',
    items: [
      { href: '/records',       icon: '📋', label: 'Records' },
      { href: '/prescriptions', icon: '💊', label: 'Prescriptions' },
      { href: '/documents',     icon: '🗄', label: 'Documents' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { href: '/billing',   icon: '💳', label: 'Billing' },
      { href: '/reports',   icon: '📈', label: 'Reports' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { href: '/admin/users', icon: '👤', label: 'Users' },
      { href: '/admin',       icon: '⚙',  label: 'Admin' },
    ],
  },
];

const LEGAL_NAV: NavSection[] = [
  {
    section: 'Main',
    items: [
      { href: '/dashboard', icon: '◉',  label: 'Dashboard' },
      { href: '/clients',   icon: '👥', label: 'Clients' },
      { href: '/cases',     icon: '⚖',  label: 'Cases' },
      { href: '/calendar',  icon: '📅', label: 'Hearings' },
      { href: '/tasks',     icon: '✓',  label: 'Tasks' },
      { href: '/inbox',     icon: '📬', label: 'Inbox' },
    ],
  },
  {
    section: 'Practice',
    items: [
      { href: '/contracts',  icon: '📜', label: 'Contracts' },
      { href: '/documents',  icon: '🗄', label: 'Documents' },
      { href: '/billing',    icon: '⏱', label: 'Time & Billing' },
      { href: '/reports',    icon: '📈', label: 'Reports' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { href: '/admin/users', icon: '👤', label: 'Users' },
      { href: '/admin',       icon: '⚙',  label: 'Admin' },
    ],
  },
];

const GENERIC_NAV: NavSection[] = [
  {
    section: 'Main',
    items: [
      { href: '/dashboard',  icon: '◉',  label: 'Dashboard' },
      { href: '/contacts',   icon: '👥', label: 'Contacts' },
      { href: '/activities', icon: '💬', label: 'Activities' },
      { href: '/tasks',      icon: '✓',  label: 'Tasks' },
      { href: '/calendar',   icon: '📅', label: 'Calendar' },
      { href: '/inbox',      icon: '📬', label: 'Inbox' },
    ],
  },
  {
    section: 'Business',
    items: [
      { href: '/projects',   icon: '📋', label: 'Projects' },
      { href: '/documents',  icon: '🗄', label: 'Documents' },
      { href: '/invoicing',  icon: '💳', label: 'Invoicing' },
      { href: '/reports',    icon: '📈', label: 'Reports' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { href: '/admin/users', icon: '👤', label: 'Users' },
      { href: '/admin',       icon: '⚙',  label: 'Admin' },
    ],
  },
];

// ─── The Registry ─────────────────────────────────────────────────────────────

export const VERTICAL_REGISTRY: VerticalDefinition[] = [
  {
    id:           'multi_family_office',
    label:        'Multi-Family Office',
    shortLabel:   'MFO',
    icon:         '🏛',
    tagline:      'Complete wealth management platform for institutional family offices',
    color:        '#8b5cf6',
    status:       'ga',
    availableModules: ['families','contacts_crm','organizations','portfolio','wealth','documents','activities','tasks','calendar','governance','estate','concierge','reports','inbox','copilot'],
    defaultModules:   ['families','contacts_crm','organizations','portfolio','documents','activities','tasks','calendar','reports','inbox','copilot'],
    defaultRoles: ['tenant_admin','relationship_manager','cio','controller','compliance_officer','report_viewer','external_advisor'],
    nav:          MFO_NAV,
    complianceFrameworks: ['ANBIMA','CVM175','SEC_RIA','FINRA'],
    defaultCurrencies:    ['BRL','USD','EUR'],
  },
  {
    id:           'independent_advisor',
    label:        'Independent Advisor / RIA',
    shortLabel:   'RIA',
    icon:         '📊',
    tagline:      'Streamlined platform for independent financial advisors and RIAs',
    color:        '#06b6d4',
    status:       'ga',
    availableModules: ['clients','contacts_crm','organizations','portfolio','documents','activities','tasks','calendar','reports','inbox','copilot'],
    defaultModules:   ['clients','contacts_crm','organizations','portfolio','documents','activities','tasks','calendar','reports'],
    defaultRoles: ['tenant_admin','relationship_manager','report_viewer'],
    nav:          ADVISOR_NAV,
    complianceFrameworks: ['SEC_RIA','FINRA','CVM300'],
    defaultCurrencies:    ['USD','BRL'],
  },
  {
    id:           'medical_practice',
    label:        'Medical Practice',
    shortLabel:   'Medical',
    icon:         '🏥',
    tagline:      'Patient management and clinical operations for healthcare providers',
    color:        '#10b981',
    status:       'beta',
    availableModules: ['patients','appointments','billing_medical','prescriptions','records','documents','tasks','calendar','inbox','reports'],
    defaultModules:   ['patients','appointments','records','tasks','calendar'],
    defaultRoles: ['tenant_admin','report_viewer'],
    nav:          MEDICAL_NAV,
    complianceFrameworks: ['HIPAA','LGPD_HEALTH'],
    defaultCurrencies:    ['USD','BRL','EUR'],
  },
  {
    id:           'legal_firm',
    label:        'Legal / Law Firm',
    shortLabel:   'Legal',
    icon:         '⚖',
    tagline:      'Matter management, time tracking, and client billing for law firms',
    color:        '#f59e0b',
    status:       'beta',
    availableModules: ['clients','cases','billing_legal','contracts','documents','tasks','calendar','inbox','reports'],
    defaultModules:   ['clients','cases','documents','tasks','calendar'],
    defaultRoles: ['tenant_admin','report_viewer'],
    nav:          LEGAL_NAV,
    complianceFrameworks: ['ABA_RULES','OAB'],
    defaultCurrencies:    ['USD','BRL','GBP'],
  },
  {
    id:           'accounting_cpa',
    label:        'Accounting / CPA Firm',
    shortLabel:   'CPA',
    icon:         '🧾',
    tagline:      'Client engagements, deadline tracking, and billing for CPA firms',
    color:        '#3b82f6',
    status:       'coming_soon',
    availableModules: ['clients','engagements','billing_acct','deadlines','documents','tasks','reports'],
    defaultModules:   ['clients','engagements','deadlines'],
    defaultRoles: ['tenant_admin','report_viewer'],
    nav:          GENERIC_NAV,
    complianceFrameworks: ['GAAP','IFRS','CFC'],
    defaultCurrencies:    ['USD','BRL'],
  },
  {
    id:           'real_estate',
    label:        'Real Estate Firm',
    shortLabel:   'Real Estate',
    icon:         '🏠',
    tagline:      'Property listings, deal pipeline, and client management',
    color:        '#ef4444',
    status:       'coming_soon',
    availableModules: ['properties','deals','listings','clients','documents','tasks','calendar','reports'],
    defaultModules:   ['properties','deals','clients'],
    defaultRoles: ['tenant_admin','report_viewer'],
    nav:          GENERIC_NAV,
    complianceFrameworks: ['CRECI','NAR'],
    defaultCurrencies:    ['USD','BRL'],
  },
  {
    id:           'generic_business',
    label:        'Generic Business',
    shortLabel:   'Business',
    icon:         '🏢',
    tagline:      'Flexible platform foundation for any business type',
    color:        '#64748b',
    status:       'ga',
    availableModules: ['contacts','projects','invoicing','documents','tasks','calendar','inbox','reports'],
    defaultModules:   ['contacts','tasks','calendar','documents'],
    defaultRoles: ['tenant_admin','report_viewer'],
    nav:          GENERIC_NAV,
    complianceFrameworks: [],
    defaultCurrencies:    ['USD','BRL','EUR'],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getVertical(id: IndustryVerticalId): VerticalDefinition {
  return VERTICAL_REGISTRY.find(v => v.id === id) ?? VERTICAL_REGISTRY.find(v => v.id === 'generic_business')!;
}

export function getVerticalNav(id: IndustryVerticalId | undefined): NavSection[] {
  if (!id) return MFO_NAV; // fallback to MFO for existing tenants without vertical set
  return getVertical(id).nav;
}

export const DEFAULT_VERTICAL: IndustryVerticalId = 'multi_family_office';
