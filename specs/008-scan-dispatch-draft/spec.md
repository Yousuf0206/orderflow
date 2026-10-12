# Feature Specification: Scan a Delivery Note into a Dispatch Draft

**Feature Branch**: `008-scan-dispatch-draft`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Scan to dispatch draft (008)": on a purchase order, photograph a
delivery note or goods-received note, get a draft dispatch with lines and quantities filled in,
fix anything wrong, then confirm, after which remaining balances update exactly as for a typed
dispatch. Governed by constitution v2.1.0 Principles XXXVIII–XLI.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan a note on a purchase order and confirm it (Priority: P1)

A clerk at the gate is looking at a purchase order on their phone. A truck arrives with a printed
delivery note. They tap **Scan delivery note**, take a photo, and within a few seconds see a
dispatch draft: date, vehicle number, and a quantity against each order line the note mentions.
They check it, tap **Confirm dispatch**, and the order's remaining quantities update.

**Why this priority**: this is the whole feature: less typing per truck, with the same trusted
remaining balance.

**Independent Test**: on a three-line purchase order, scan a clear printed note that names two of
the lines with quantities; confirm; the order shows one new dispatch with those two quantities and
remaining is reduced per line exactly as if the dispatch had been typed.

**Acceptance Scenarios**:

1. **Given** an open purchase order with three lines, **When** the user scans a clear note naming
   two of them with quantities, **Then** a draft shows those two lines with the read quantities,
   the third line at zero, and the note's date and vehicle number where they were found.
2. **Given** a draft, **When** the user confirms, **Then** exactly one dispatch is recorded with
   the confirmed values, remaining updates per line, and the audit log shows a normal dispatch
   entry by that user.
3. **Given** a draft, **When** the user leaves without confirming, **Then** no dispatch exists,
   remaining is unchanged, and nothing on the order says a dispatch is pending.
4. **Given** a draft whose quantities would exceed a line's remaining, **When** the user confirms,
   **Then** the same over-dispatch warning and confirmation as a typed dispatch appear.

---

### User Story 2 - Fix what the scan got wrong before saving (Priority: P2)

The note calls a material "OPC 53 Grade" while the order line says "Cement OPC-53"; a quantity
is smudged; the date is read wrong. The user sees which fields the scan was unsure of, picks the
right order line for any row it couldn't match, skips rows that aren't on this order, and corrects
date, vehicle, remarks and every quantity before confirming.

**Why this priority**: real notes are messy; a scan that can't be corrected is worse than typing.

**Independent Test**: scan a note with one alias-named material, one unreadable quantity and one
item not on the order; correct all three; the confirmed dispatch carries only the corrected values.

**Acceptance Scenarios**:

1. **Given** a read row whose description doesn't clearly match any open line, **When** the draft
   shows, **Then** it is listed as "Unmatched — pick a line or skip" and contributes no quantity
   until the user picks a line.
2. **Given** a field the scan was unsure of, **When** the draft shows, **Then** that field is
   visibly marked as needing a check.
3. **Given** a matched row, **When** the user changes its line, quantity, or removes it, **Then**
   the draft reflects the change and confirm uses only the edited values.
4. **Given** a row that names an item not on this order, **When** the user confirms, **Then** no
   new order line is created; the row is either matched to an existing line or skipped.

---

### User Story 3 - Works on the phone browser and in the apps (Priority: P3)

The same scan works from the mobile website and from the iOS and Android apps, with camera or
photo-library choice, and a clear permission request that says why the camera is needed.

**Why this priority**: field users use both; the apps must not lag the web (Principle XXXIV).

**Independent Test**: on one physical iPhone and one physical Android phone, in the browser and
in the app, scan by camera and by picking a saved photo; deny camera permission once and confirm
the user can still pick a photo.

**Acceptance Scenarios**:

1. **Given** the app has never asked for the camera, **When** the user taps scan, **Then** the
   system prompt shows OrderFlow's reason ("to photograph delivery notes for a dispatch").
2. **Given** camera permission is denied, **When** the user taps scan, **Then** they are told how
   to allow it and can still choose a photo from the library.

---

### Edge Cases

- Blurry, dark, or blank photo, or no text found: clear message saying the note couldn't be read,
  with **Retake** and **Type it instead** (opens the normal dispatch form). Nothing saved.
- Some fields read, others not: the draft still opens with empty fields for the user to fill.
- Nothing matches any line: draft opens with every row unmatched; the user may pick lines or type.
- No connection, timeout, or server error during reading: says the note wasn't read; no draft is
  invented. During confirm: the existing "couldn't confirm this dispatch was saved" handling
  applies (no blind retry, order re-read first).
- The note's unit differs from the line's unit (e.g. bags vs tonnes): the quantity is not
  converted; the field is marked for checking and the line's own unit is shown.
- The order is fully dispatched or closed: scanning is not offered.
- The order changed while the draft was open (another dispatch recorded): confirm uses current
  remaining for warnings; the draft never relies on remaining as it was at scan time.
- A handwritten note: best effort only; the user is told results may need more checking.
- A user without permission to record dispatches: the scan action is not shown.
- The note is a multi-page document: only the photographed page is read (v1).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 Capture**: On a purchase order's detail screen, a user who may record dispatches MUST
  be able to start a scan by taking a photo or choosing one existing image from the phone. One
  image per scan in v1.
- **FR-002 Read**: From the image, the system MUST extract candidates for document date,
  vehicle/reference number, and line items (description, quantity, and unit where present), with
  a per-field confidence wherever the reading service provides one.
- **FR-003 Match**: Read line items MUST be matched to the current purchase order's open lines by
  material name, tolerating spacing, punctuation, case, and common abbreviations. A row without a
  confident match MUST be shown as "Unmatched — pick a line or skip". Quantities apply only to
  matched lines. Confirming MUST NOT create, rename, or alter purchase order lines.
- **FR-004 Draft review**: The draft MUST show and allow editing of dispatch date, vehicle
  reference, remarks, and the quantity and matched line of every row, including adding a line the
  scan missed and removing a row. Low-confidence fields MUST be visibly marked. Each line's own
  unit MUST be shown and quantities MUST NOT be converted between units.
- **FR-005 Confirm**: The primary action MUST read **Confirm dispatch**. Confirming MUST record
  the dispatch through the same rules as a typed dispatch: validation, over-dispatch warning and
  confirmation, permissions, audit entry, and remaining calculation. Nothing about the order
  changes before confirm.
- **FR-006 Abandon**: Leaving the draft without confirming MUST leave the order unchanged. A
  draft is not saved for later in v1.
- **FR-007 Failures**: An unreadable image MUST produce a plain message with Retake and Type it
  instead. A network failure, timeout, or service error MUST NOT show a draft or success. A
  partial read MUST still open the draft with empty fields.
- **FR-008 Privacy and retention**: Images MUST travel only over encrypted connections and be
  visible only within the user's organization. Each image MUST be deleted 30 days after the scan,
  or when the organization or the scanning user's account is deleted, whichever comes first.
  Before release, the privacy policy MUST state this retention, name any outside reading service,
  and state whether that service keeps or learns from images.
- **FR-009 Platforms**: Scanning MUST work in the mobile browser and in the iOS and Android apps,
  released on both apps together. The apps MUST request camera and photo access only when the user
  first scans, with a reason shown in the system prompt; denial MUST still allow choosing a photo
  where the platform permits, or typing the dispatch.
- **FR-010 Honest wording**: No screen, listing, or announcement may describe scanning as fully
  accurate, as removing typing, or as working offline.
- **FR-011 Usage limit**: Scans per organization MUST be capped at a daily limit to bound reading
  costs during the free trial; reaching it shows a plain message and the typed form still works.

### Key Entities

- **Scan**: one image read for one purchase order by one user; holds the image (until deleted per
  FR-008), when it was taken, its outcome (read, unreadable, failed), and, once confirmed, the
  dispatch it produced. Not a dispatch and never counted in remaining.
- **Draft dispatch** (not stored in v1): the editable result of a scan: date, vehicle, remarks,
  and rows of (read description, read quantity and unit, matched order line or none, confidence).
- **Dispatch**: unchanged. A confirmed scan produces an ordinary dispatch with ordinary lines.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On clear printed notes, a user goes from tapping scan to a confirmed dispatch in under
  45 seconds for a two-line note, versus typing the same dispatch.
- **SC-002**: On a test set of at least 20 real printed delivery notes, at least 80% of line
  quantities are read correctly and at least 80% of rows are matched to the right order line
  before any correction.
- **SC-003**: 100% of confirmed scanned dispatches produce the same remaining balances as typing
  the same values (no separate scanned figure anywhere).
- **SC-004**: 0 dispatches are recorded from a scan without the user pressing Confirm dispatch,
  including after network failures.
- **SC-005**: A draft appears, or a clear failure message, within 15 seconds of taking the photo on
  a normal mobile connection.
- **SC-006**: Recorded passes on one physical iPhone and one physical Android phone, browser and
  app, before release.
- **SC-007**: No image older than 30 days remains stored.

## Assumptions

- v1 starts only from a purchase order's detail screen, so the purchase order is always known;
  scanning from the home screen (which would require choosing an order first, Principle XXXIX) is
  out of scope for v1.
- An outside document-reading service will likely be used; which one is a planning decision,
  constrained by FR-008 (no training on images, or disclosed).
- 30-day image retention follows the user's example and the existing 30-day account purge window;
  images are kept that long only to support questions about a dispatch.
- A daily cap of around 50 scans per organization is enough for trial users; the exact figure is
  set in planning.
- Mostly printed notes in English with digits; other languages and handwriting are best effort.
- The dispatch record already holds date, vehicle reference, and remarks, so no new dispatch
  fields are needed.
- Native camera access needs a new app release on both platforms (Principle XXXIV).

## Non-goals (v1)

- Accuracy guarantees for handwriting.
- Creating purchase orders or new order lines from a note.
- Invoices, payments, or accounting.
- Multi-page or batch PDF documents.
- Saving drafts to finish later; offline scanning or queued scans.
- Storing notes as a document library.
