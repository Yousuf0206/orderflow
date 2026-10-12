# Privacy policy draft: delivery-note scanning (T034)

Not live. Paste into `frontend/src/pages/legal/PrivacyPolicy.tsx` in the same release that sets
`SCAN_ENABLED=true` (T043), and only after T041 is recorded: Anthropic has enabled Zero Data
Retention (ZDR) for the organization that owns the production key, and
`ANTHROPIC_ZERO_RETENTION_CONFIRMED=true` is set. The server refuses to scan without that flag, so
this text and the running system cannot disagree.

## 1. Add to "Sharing" (new list item after Supabase)

```tsx
<li>
  <strong>Anthropic</strong> — only if you use <em>Scan delivery note</em>: reads the photo of the
  note so OrderFlow can fill in a dispatch for you to check. The photo is sent from our server over
  an encrypted connection. Anthropic processes it under a zero data retention agreement: it does not
  store the photo or what it read once the result is returned, and does not use it to train its
  models.
</li>
```

## 2. New section after "Mobile apps"

```tsx
<h2>Scanning delivery notes</h2>
<p>
  Scanning is optional. When you tap <strong>Scan delivery note</strong>, OrderFlow asks for camera
  or photo access only then, and uses it only to take or choose that one photo. The photo is shrunk
  on your phone and sent to OrderFlow over an encrypted connection.
</p>
<ul>
  <li>
    The photo and the text read from it are stored in OrderFlow's database, visible only within
    your organization, for <strong>30 days</strong> so a question about a dispatch can be answered.
    Then both are deleted automatically.
  </li>
  <li>
    They are deleted sooner if your account or your organization is deleted.
  </li>
  <li>
    Nothing from a scan changes your records until you check the filled-in form and press{" "}
    <strong>Confirm dispatch</strong>. Readings can be wrong, so always check the figures.
  </li>
  <li>
    The reading service (Anthropic) keeps nothing and trains on nothing — see Sharing above.
  </li>
</ul>
<p>
  To have a scan's photo deleted before 30 days, contact us at the address below.
</p>
```

## 3. Change in "Mobile apps"

Replace "The apps do not track you, show ads, or store your business records on the phone." with:

```tsx
The apps do not track you, show ads, or store your business records on the phone. They use the
camera only when you choose to scan a delivery note.
```

## Source of the Anthropic statements (checked 2026-10-13)

- [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention):
  without ZDR, API inputs/outputs are deleted within 30 days; under ZDR, "Anthropic does not store
  customer prompts or responses at rest after the API response is returned"; ZDR is enabled per
  organization by Anthropic's sales/account team; "Retained data is never used for model training
  without your express permission." Messages API, client tools and inline images (what
  `scan_reader.py` uses) are ZDR-eligible; Files API, Batches, code execution, MCP connector and
  skills are not.
- [Covered Models](https://support.claude.com/en/articles/15425695-covered-models): Fable 5 / 5.1
  and Mythos 5 / 5.1 require 30-day retention and are refused by `zero_retention_ready()`.
  `claude-sonnet-5-5` is not a Covered Model.

Re-check both pages on release day; if either changes, update this text or keep scanning off.
