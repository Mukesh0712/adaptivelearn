import { SITE } from '@/config/site'
import { LegalLayout } from './LegalLayout'

// DRAFT TEMPLATE, not legal advice. Written to match what the app actually
// stores today; review it (and update it whenever new data is collected)
// before real users sign up.
export default function PrivacyPage() {
  const email = <a className="underline underline-offset-4" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>

  return (
    <LegalLayout
      title="Privacy Policy"
      description={`How ${SITE.name} collects, uses and protects your personal data.`}
    >
      <p>
        This Privacy Policy explains how {SITE.organisation} (&quot;we&quot;, &quot;us&quot;) collects, uses and
        protects personal data when you use {SITE.name}. It is written with India&apos;s Digital Personal Data
        Protection Act, 2023 (DPDP Act) in mind.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address and role (student, instructor, parent or admin).</li>
        <li><strong>Password:</strong> stored only as a one-way bcrypt hash. We never store or see your actual password.</li>
        <li><strong>Consent record:</strong> the date and time you accepted these terms.</li>
        <li><strong>Security data:</strong> hashed session and password-reset tokens, and technical request logs (time, address requested, IP address) used to protect the service against abuse.</li>
      </ul>

      <h2>2. Why we use it</h2>
      <ul>
        <li>To create and secure your account and log you in.</li>
        <li>To show you the portal that matches your role.</li>
        <li>To send service emails you ask for, such as password-reset links.</li>
        <li>To detect and prevent fraud, spam and unauthorised access.</li>
      </ul>
      <p>We do not sell your personal data and we do not use it for advertising.</p>

      <h2>3. Cookies and analytics</h2>
      <p>
        We use one <strong>strictly necessary</strong> cookie, <code>refreshToken</code>, which keeps you logged in.
        It cannot be read by page scripts, is sent only to our login service, and is deleted when you log out (or
        when you close the browser, unless you chose &quot;Remember me&quot;, in which case it lasts up to 30 days).
        Because it is essential for the service to work, it does not require consent.
      </p>
      <p>
        We may measure anonymous, aggregate page visits using a privacy-friendly analytics tool (Umami) that does
        not use cookies and does not collect personal data.
      </p>

      <h2>4. Sharing</h2>
      <p>
        We share data only with service providers that help us run {SITE.name}, such as our database host (MongoDB
        Atlas) and email provider, under their data-protection terms, or where the law requires it.
      </p>

      <h2>5. Security and retention</h2>
      <p>
        Data is encrypted in transit (HTTPS), passwords are hashed, and access is limited by role. We keep your
        account data while your account is active and delete it within a reasonable time after you ask us to close
        it, unless the law requires us to keep it longer.
      </p>

      <h2>6. Your rights</h2>
      <p>
        You can ask to access, correct or erase your personal data, withdraw consent, or raise a grievance by
        emailing {email}. We will respond within the time required by law.
      </p>

      <h2>7. Children</h2>
      <p>
        Where a user is under 18, we process their data only with verifiable consent from a parent or lawful
        guardian, as required by the DPDP Act.
      </p>

      <h2>8. Changes</h2>
      <p>
        We will update this page when our practices change and show the new &quot;Last updated&quot; date. For
        significant changes, we will notify you by email or in the app.
      </p>

      <h2>9. Contact</h2>
      <p>Questions or grievances: {email}.</p>
    </LegalLayout>
  )
}
