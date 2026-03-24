import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — MFO Nexus',
  description: 'Privacy Policy for the MFO Nexus multi-family office platform by Vivantis Group.',
};

const LAST_UPDATED = 'March 23, 2026';
const COMPANY      = 'Vivantis Group';
const PRODUCT      = 'MFO Nexus';
const CONTACT      = 'privacy@vivantisgroup.com';
const WEBSITE      = 'https://mfo-crm-web.vercel.app';

export default function PrivacyPage() {
  return (
    <article style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'inline-block', background: 'var(--brand-500)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 4, marginBottom: 16 }}>
          Legal
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.2, marginBottom: 12 }}>Privacy Policy</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Last updated: {LAST_UPDATED}
        </p>
      </div>

      <Section title="1. Introduction">
        <p>
          {COMPANY} ("<strong>we</strong>", "<strong>our</strong>", or "<strong>us</strong>") operates the {PRODUCT} platform (the
          "<strong>Service</strong>") — an enterprise wealth-management and client-relationship platform designed for
          multi-family offices and ultra-high-net-worth families. This Privacy Policy explains how we collect,
          use, disclose, and safeguard your information when you use our Service.
        </p>
        <p>
          By accessing or using {PRODUCT}, you agree to the collection and use of information in accordance with
          this policy. If you do not agree, please discontinue use of the Service immediately.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <h3>2.1 Information You Provide</h3>
        <ul>
          <li><strong>Account information:</strong> name, professional email address, job title, and authentication credentials.</li>
          <li><strong>Profile data:</strong> avatar photo, contact preferences, language, and timezone settings.</li>
          <li><strong>Integration credentials:</strong> OAuth tokens for connected email or calendar accounts (Google Workspace, Microsoft 365). We store encrypted refresh tokens; we never store your passwords.</li>
          <li><strong>CRM data:</strong> client records, notes, documents, tasks, and financial information entered by your organization.</li>
        </ul>

        <h3>2.2 Information Collected Automatically</h3>
        <ul>
          <li><strong>Log data:</strong> IP address, browser type, pages visited, timestamps, and referring URLs.</li>
          <li><strong>Usage analytics:</strong> feature interactions, session duration, and error reports collected via anonymous telemetry.</li>
          <li><strong>Cookies &amp; storage:</strong> session cookies and browser local storage for authentication state and user preferences.</li>
        </ul>

        <h3>2.3 Third-Party Integrations</h3>
        <p>
          When you connect a Google account, we request read and compose access to Gmail and calendar access in
          order to sync communications to the CRM activity feed. We use this data solely to provide the integration
          feature. We do <strong>not</strong> sell, share, or use this data for advertising purposes.
          You may disconnect these integrations at any time from your profile settings.
        </p>
      </Section>

      <Section title="3. How We Use Your Information">
        <ul>
          <li>To authenticate users and manage secure access to the platform.</li>
          <li>To sync and display email and calendar activity within the CRM at your direction.</li>
          <li>To generate AI-assisted summaries, prompts, and recommendations within the platform.</li>
          <li>To send transactional notifications (task assignments, reminders, system alerts).</li>
          <li>To investigate security incidents and enforce our Terms of Service.</li>
          <li>To improve platform features based on aggregated, anonymized usage patterns.</li>
        </ul>
      </Section>

      <Section title="4. Data Sharing &amp; Disclosure">
        <p>We do <strong>not</strong> sell your personal information. We may share data with:</p>
        <ul>
          <li><strong>Service providers:</strong> Firebase (Google) for authentication and database services; Vercel for hosting; and AI providers (OpenAI, Google AI, Anthropic) only when you invoke AI features — data sent to AI providers is covered by their respective privacy policies.</li>
          <li><strong>Your organization:</strong> Administrators of your tenant account can view user profiles and audit logs.</li>
          <li><strong>Law enforcement:</strong> when required by law, court order, or governmental authority.</li>
        </ul>
      </Section>

      <Section title="5. Data Retention">
        <p>
          We retain your data for as long as your account is active or as necessary to provide the Service.
          Upon account termination or tenant deprovisioning, data is deleted within 90 days unless a longer
          retention period is required by law or your organization's data retention policy.
        </p>
      </Section>

      <Section title="6. Security">
        <p>
          All data is transmitted over TLS/HTTPS. Authentication is managed via Firebase Authentication with
          support for multi-factor authentication (MFA). OAuth tokens are stored in encrypted Firestore
          collections with access governed by Firestore Security Rules. We conduct periodic security reviews
          and follow industry-standard practices for software development and data protection.
        </p>
      </Section>

      <Section title="7. Your Rights">
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li><strong>Access</strong> the personal data we hold about you.</li>
          <li><strong>Correct</strong> inaccurate or incomplete data.</li>
          <li><strong>Delete</strong> your account and associated personal data.</li>
          <li><strong>Restrict</strong> or object to certain processing activities.</li>
          <li><strong>Portability:</strong> request a machine-readable export of your data.</li>
          <li><strong>Withdraw consent</strong> for integrations (e.g., disconnecting Gmail or Microsoft 365) at any time.</li>
        </ul>
        <p>To exercise any of these rights, contact us at <a href={`mailto:${CONTACT}`} style={{ color: 'var(--brand-500)' }}>{CONTACT}</a>.</p>
      </Section>

      <Section title="8. Cookies">
        <p>
          We use strictly necessary cookies for session management and authentication. We do not use tracking or
          advertising cookies. You may configure your browser to refuse cookies, but this will prevent you from
          signing in to the Service.
        </p>
      </Section>

      <Section title="9. Children's Privacy">
        <p>
          {PRODUCT} is an enterprise platform intended for professional use only. We do not knowingly collect
          personal information from individuals under the age of 18. If you believe a minor's data has been
          submitted, please contact us immediately.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify registered users of material
          changes via email or in-platform notification at least 14 days before the changes take effect.
          Continued use of the Service after the effective date constitutes acceptance of the revised policy.
        </p>
      </Section>

      <Section title="11. Contact Us">
        <p>If you have questions about this Privacy Policy, please contact:</p>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px', marginTop: 12, fontSize: 14, lineHeight: 2 }}>
          <strong>{COMPANY}</strong><br />
          Email: <a href={`mailto:${CONTACT}`} style={{ color: 'var(--brand-500)' }}>{CONTACT}</a><br />
          Website: <a href={WEBSITE} style={{ color: 'var(--brand-500)' }}>{WEBSITE}</a>
        </div>
      </Section>

    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {title}
      </h2>
      <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </section>
  );
}
