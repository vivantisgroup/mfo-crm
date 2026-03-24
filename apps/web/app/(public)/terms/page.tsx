import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — MFO Nexus',
  description: 'Terms of Service for the MFO Nexus multi-family office platform by Vivantis Group.',
};

const LAST_UPDATED = 'March 23, 2026';
const COMPANY      = 'Vivantis Group';
const PRODUCT      = 'MFO Nexus';
const CONTACT      = 'legal@vivantisgroup.com';
const WEBSITE      = 'https://mfo-crm-web.vercel.app';

export default function TermsPage() {
  return (
    <article style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'inline-block', background: 'var(--brand-500)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 4, marginBottom: 16 }}>
          Legal
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.2, marginBottom: 12 }}>Terms of Service</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Last updated: {LAST_UPDATED}
        </p>
      </div>

      <Section title="1. Acceptance of Terms">
        <p>
          These Terms of Service ("<strong>Terms</strong>") constitute a legally binding agreement between you
          ("<strong>User</strong>") and {COMPANY} ("<strong>Company</strong>", "<strong>we</strong>",
          "<strong>us</strong>") governing access to and use of the {PRODUCT} platform (the
          "<strong>Service</strong>").
        </p>
        <p>
          By creating an account or using the Service, you confirm that you are at least 18 years old, have the
          legal authority to enter into this agreement, and agree to be bound by these Terms. If you are using
          the Service on behalf of an organization, you represent that you have authority to bind that
          organization to these Terms.
        </p>
      </Section>

      <Section title="2. Service Description">
        <p>
          {PRODUCT} is a cloud-based enterprise CRM and wealth-management platform designed for multi-family
          offices. Features include client relationship management, portfolio oversight, task and calendar
          management, email integration (Gmail and Microsoft 365), AI-assisted communication tools, and
          reporting dashboards.
        </p>
        <p>
          We reserve the right to modify, suspend, or discontinue any part of the Service at any time, with
          reasonable prior notice to active subscribers.
        </p>
      </Section>

      <Section title="3. Account Registration &amp; Security">
        <ul>
          <li>You must provide accurate and complete registration information.</li>
          <li>You are responsible for maintaining the confidentiality of your credentials.</li>
          <li>You must notify us immediately at <a href="mailto:security@vivantisgroup.com" style={{ color: 'var(--brand-500)' }}>security@vivantisgroup.com</a> if you suspect unauthorized access to your account.</li>
          <li>We strongly recommend enabling multi-factor authentication (MFA). Platform administrators may enforce MFA as a mandatory policy for their tenants.</li>
          <li>You may not share accounts or allow third parties to access the platform using your credentials.</li>
        </ul>
      </Section>

      <Section title="4. Authorized Use">
        <p>You agree to use the Service only for lawful business purposes and in compliance with these Terms. You must not:</p>
        <ul>
          <li>Attempt to reverse-engineer, decompile, or extract source code from the platform.</li>
          <li>Use the Service to store or transmit malicious code, viruses, or harmful content.</li>
          <li>Circumvent security controls, authentication mechanisms, or access restrictions.</li>
          <li>Use automated scripts, bots, or crawlers to access the Service without written permission.</li>
          <li>Violate any applicable laws, including securities regulations, data protection laws, or financial industry rules.</li>
          <li>Attempt to access tenant data belonging to other organizations.</li>
        </ul>
      </Section>

      <Section title="5. Third-Party Integrations">
        <p>
          The Service allows optional connection to third-party platforms including Google Workspace (Gmail,
          Calendar) and Microsoft 365 (Outlook, Exchange). By connecting these integrations, you authorize
          {COMPANY} to access and process data from those platforms on your behalf, subject to the permissions
          you grant during the OAuth authorization flow.
        </p>
        <p>
          Your use of third-party services is additionally governed by their respective terms of service and
          privacy policies. {COMPANY} is not responsible for third-party service availability, data handling
          practices, or changes to their APIs.
        </p>
      </Section>

      <Section title="6. Data Ownership &amp; Processing">
        <p>
          <strong>Your data remains yours.</strong> {COMPANY} processes client and organizational data entered
          into the Service solely to provide and improve the platform. We do not claim ownership over any content
          you upload or create within the Service.
        </p>
        <p>
          You represent and warrant that you have the necessary rights and consents to submit any personal data
          about third parties (e.g., your clients) to the platform, and that doing so complies with applicable
          data protection laws including GDPR, LGPD, and CCPA as applicable.
        </p>
      </Section>

      <Section title="7. AI-Assisted Features">
        <p>
          {PRODUCT} includes optional AI-powered tools (summaries, drafting assistance, insights). Outputs
          generated by AI are provided for informational purposes only and do not constitute financial, legal,
          or professional advice. You are solely responsible for reviewing and validating AI-generated content
          before acting upon it or sharing it with clients.
        </p>
        <p>
          When you use AI features, relevant content may be transmitted to third-party AI providers (such as
          OpenAI or Google AI) subject to their API data usage policies. AI features can be disabled per tenant
          from the platform administration settings.
        </p>
      </Section>

      <Section title="8. Fees &amp; Subscription">
        <p>
          Access to the Service is provided under a subscription plan agreed between your organization and
          {COMPANY}. Subscription fees, billing cycles, and renewal terms are governed by the separate
          subscription agreement or order form in place between your organization and {COMPANY}.
        </p>
        <p>
          We reserve the right to suspend access upon non-payment following reasonable notice. Fees are
          non-refundable except where required by applicable law or as expressly stated in your subscription
          agreement.
        </p>
      </Section>

      <Section title="9. Intellectual Property">
        <p>
          All intellectual property rights in the Service — including its design, software, trade marks, and
          documentation — are owned by or licensed to {COMPANY}. These Terms do not transfer any intellectual
          property rights to you. You are granted a limited, non-exclusive, non-transferable licence to use
          the Service solely for your internal business purposes during the subscription term.
        </p>
      </Section>

      <Section title="10. Confidentiality">
        <p>
          Each party agrees to keep the other party's confidential information (including platform access
          credentials, product roadmaps, and client data) in strict confidence and not to disclose it to
          third parties without prior written consent, except as required by law.
        </p>
      </Section>

      <Section title="11. Disclaimer of Warranties">
        <p>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
          IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, OR NON-INFRINGEMENT. {COMPANY.toUpperCase()} DOES NOT WARRANT THAT THE SERVICE WILL BE
          UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
        </p>
      </Section>

      <Section title="12. Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {COMPANY.toUpperCase()} AND ITS OFFICERS, DIRECTORS,
          EMPLOYEES, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE,
          EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL AGGREGATE LIABILITY SHALL NOT
          EXCEED THE FEES PAID BY YOU IN THE THREE (3) MONTHS PRECEDING THE CLAIM.
        </p>
      </Section>

      <Section title="13. Termination">
        <p>
          Either party may terminate the agreement with 30 days' written notice. We may suspend or terminate
          your account immediately for material breach of these Terms, including unauthorized use, fraud, or
          non-payment. Upon termination, your right to access the Service ceases and data will be deleted
          in accordance with our Privacy Policy.
        </p>
      </Section>

      <Section title="14. Governing Law">
        <p>
          These Terms are governed by the laws of Brazil, without regard to conflict of law principles.
          Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts
          of São Paulo, Brazil, unless otherwise agreed in writing by both parties.
        </p>
      </Section>

      <Section title="15. Changes to These Terms">
        <p>
          We may update these Terms at any time. Material changes will be communicated via email or in-platform
          notice at least 14 days in advance. Continued use of the Service after the effective date of revised
          Terms constitutes your acceptance.
        </p>
      </Section>

      <Section title="16. Contact">
        <p>For legal notices and inquiries regarding these Terms, please contact:</p>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px', marginTop: 12, fontSize: 14, lineHeight: 2 }}>
          <strong>{COMPANY} — Legal Department</strong><br />
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
