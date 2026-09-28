import { Link } from 'react-router'
import { SITE } from '@/config/site'
import { LegalLayout } from './LegalLayout'

// DRAFT TEMPLATE, not legal advice. Review before real users sign up.
export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms & Conditions"
      description={`The rules for using ${SITE.name}.`}
    >
      <p>
        By creating an account or using {SITE.name}, you agree to these Terms &amp; Conditions and to our{' '}
        <Link to="/privacy" className="underline underline-offset-4">Privacy Policy</Link>. If you do not agree,
        please do not use the service.
      </p>

      <h2>1. The service</h2>
      <p>
        {SITE.name} is a learning platform with separate portals for students, instructors, parents and
        administrators. Features may change as the platform develops.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>Provide accurate information and choose the role that truly applies to you.</li>
        <li>Keep your password secret. You are responsible for activity on your account.</li>
        <li>Tell us promptly at <a className="underline underline-offset-4" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> if you suspect unauthorised use.</li>
        <li>Users under 18 may use the service only with the consent of a parent or guardian.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You must not:</p>
      <ul>
        <li>access another user&apos;s account or data, or try to bypass security or role restrictions;</li>
        <li>upload unlawful, harmful, abusive or infringing content;</li>
        <li>send spam, automate sign-ups, or overload the service;</li>
        <li>copy, reverse-engineer or resell the service without permission.</li>
      </ul>

      <h2>4. Content</h2>
      <p>
        You keep ownership of content you submit. You allow us to store and display it as needed to provide the
        service to you and to the users you share it with.
      </p>

      <h2>5. Suspension and termination</h2>
      <p>
        We may suspend or close accounts that break these terms. You can stop using the service and ask us to delete
        your account at any time.
      </p>

      <h2>6. Disclaimer and liability</h2>
      <p>
        The service is provided &quot;as is&quot;. We work to keep it available and secure but cannot guarantee it
        will be uninterrupted or error-free. To the extent the law allows, we are not liable for indirect or
        consequential losses.
      </p>

      <h2>7. Governing law</h2>
      <p>These terms are governed by the laws of India.</p>

      <h2>8. Changes</h2>
      <p>
        We may update these terms and will show the new &quot;Last updated&quot; date. Continuing to use the service
        after a change means you accept the updated terms.
      </p>
    </LegalLayout>
  )
}
