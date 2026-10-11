import LegalPage from "./LegalPage";

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" updated="October 2026">
      <p>
        This policy explains what information OrderFlow collects when you use the service, how it's
        used, and the choices you have. OrderFlow is a business tool for tracking purchase orders and
        dispatches — we collect only what's needed to run that service for your organization.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account details: your name, email address, and organization name.</li>
        <li>
          Business records you enter: parties, purchase orders, dispatches, and the audit log of
          actions taken in your organization.
        </li>
        <li>
          No payment information. OrderFlow is free-trial only at the moment, so we don't ask for
          or hold card details.
        </li>
        <li>Basic technical data (IP address, browser) for security and abuse prevention.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide and operate the purchase order tracking service for your organization.</li>
        <li>To send transactional email (password resets, team invites, due-date notifications).</li>
        <li>To secure accounts and investigate abuse or suspicious activity.</li>
      </ul>

      <h2>Data isolation</h2>
      <p>
        Each organization's data is isolated from every other organization's data. Team members only
        see data belonging to organizations they've been invited to.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your data. We share data with service providers only as needed to run the
        product — currently our email delivery provider, for transactional email. We'll update this
        page before adding any other processor.
      </p>

      <h2>Mobile apps</h2>
      <p>
        The OrderFlow apps for iPhone, iPad, and Android show the same service as the website and send
        your data only to OrderFlow. Your sign-in session is kept in your phone's secure storage
        (Keychain on iOS, Keystore on Android) and removed when you sign out. The apps do not track you,
        show ads, or store your business records on the phone.
      </p>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account at any time from <strong>Settings → Delete account</strong>, on the
        website or in the app. Your access ends immediately. If you are the only owner of an
        organization, that organization is deleted too and every member loses access; otherwise only
        your own login is removed and the organization's records stay with the rest of the team.
      </p>
      <p>
        Deleted data is kept for <strong>30 days</strong> so a mistaken deletion can be reversed, then
        permanently removed. We keep only a record that a deletion took place, with no names, email
        addresses, or business records.
      </p>

      <h2>Your choices</h2>
      <p>
        You can export your data, delete your account as described above, or contact us with questions at{" "}
        <a href="mailto:privacy@orderflow.example" className="underline">
          privacy@orderflow.example
        </a>
        .
      </p>

      <p className="pt-4 text-xs text-slate-400">
        This is a template policy for OrderFlow's MVP and should be reviewed by legal counsel before
        relying on it for compliance purposes.
      </p>
    </LegalPage>
  );
}
