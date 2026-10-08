import LegalPage from "./LegalPage";

export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service" updated="October 2026">
      <p>
        These terms govern your use of OrderFlow. By creating an account, you agree to them on behalf
        of yourself and the organization you represent.
      </p>

      <h2>The service</h2>
      <p>
        OrderFlow lets your organization track purchase orders, partial dispatches, and remaining
        balances. It is currently available as a free trial only. We don't sell paid plans yet and
        collect no payment details.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You're responsible for the accuracy of the data your organization enters.</li>
        <li>You're responsible for keeping your login credentials secure.</li>
        <li>Organization owners control who can be invited and what role they hold.</li>
      </ul>

      <h2>Trials and billing</h2>
      <ul>
        <li>Trials run for a fixed period and don't require a credit card to start.</li>
        <li>
          When a trial ends, the organization moves to read-only mode: your records stay available
          to view and export, but creating and editing pauses. Contact us and we can extend it.
        </li>
        <li>
          There is nothing to pay and nothing to cancel. We will publish paid plan terms, and tell
          existing organizations, before any charging begins.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Don't use OrderFlow to store data you don't have the right to store, attempt to access another
        organization's data, or interfere with the service's normal operation.
      </p>

      <h2>Availability and liability</h2>
      <p>
        OrderFlow is provided "as is" during this MVP phase. We aim for high availability but make no
        uptime guarantee at this stage. We're not liable for indirect or consequential damages arising
        from use of the service.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms as the product evolves. Material changes will be communicated by email.</p>

      <p className="pt-4 text-xs text-slate-400">
        This is a template agreement for OrderFlow's MVP and should be reviewed by legal counsel before
        relying on it for a commercial launch.
      </p>
    </LegalPage>
  );
}
