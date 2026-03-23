export const en = {
  // Sidebar & Navigation
  'nav.dashboard': 'Dashboard',
  'nav.families': 'Families & CRM',
  'nav.portfolio': 'Portfolio',
  'nav.activities': 'Activities',
  'nav.tasks': 'Tasks',
  'nav.calendar': 'Calendar',
  'nav.documents': 'Document Vault',
  'nav.governance': 'Governance',
  'nav.estate': 'Estate & Succession',
  'nav.concierge': 'Concierge',
  'nav.reports': 'Reports',
  'nav.admin': 'Admin & Config',
  'nav.billing': 'Billing & Subscriptions',
  'nav.crm': 'Sales CRM',
  'nav.support': 'Support Center',
  'nav.audit': 'Audit & Compliance',
  'nav.tenants': 'Tenant Management',
  'nav.plans': 'Subscription Plans',
  'nav.users': 'User Management',

  // Header & User Profile
  'header.search': 'Search families, documents, tasks… (⌘K)',
  'header.notifications': 'Notifications',
  'header.help': 'Help',
  'profile.language': 'Language',
  'profile.speed': 'Ticker Speed',
  'profile.slow': 'Slow',
  'profile.fast': 'Fast',
  'profile.signout': 'Sign Out',

  // Common
  'common.all': 'All',
  'common.search': 'Search',
  'common.close': 'Close',

  // Ticker
  'ticker.live_alerts': 'LIVE ALERTS',
  'ticker.show': 'Show Ticker',

  // Roles
  'role.relationship_manager': 'Relationship Manager',
  'role.admin': 'Administrator',
  'role.family_member': 'Family Member',

  // Pages
  'page.activities.title': 'Activities & Communications',
  'page.activities.subtitle': 'Centralized timeline of emails, calls, notes, and AI insights',
  'page.activities.sync': 'Sync Email (M365)',
  'page.activities.log': 'Log Activity',
  'page.activities.empty': 'No activities found',
  'page.activities.empty_hint': 'Try adjusting your filters',

  // Calendar
  'calendar.sync.outlook': 'Sync Outlook',
  'calendar.sync.google': 'Sync Google',
  'calendar.sync.last': 'Last synced',
  'calendar.sync.now': 'Sync Now',
  'calendar.view.month': 'Month',
  'calendar.view.week': 'Week',
  'calendar.view.day': 'Day',
  'calendar.event.task': 'Task',
  'calendar.event.activity': 'Activity',
  'calendar.event.meeting': 'Meeting',
  'calendar.event.governance': 'Governance',
  'calendar.event.concierge': 'Concierge',
};

export type TranslationKey = keyof typeof en;
