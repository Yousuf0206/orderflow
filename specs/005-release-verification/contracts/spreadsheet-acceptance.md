# Contract: Spreadsheet Acceptance

Covers FR-013 to FR-015 and Constitution Principle XXV.

## When

Once per release train, as a post-deploy item in `docs/SMOKE_CHECKLIST.md`. Not per pull request
(research R3): the thing being verified is the file a user downloads from the deployed product,
and most releases change neither the export code nor the data shape.

## What is opened

Every format the application actually offers at the time of the check — currently CSV, Excel and
PDF — from both export surfaces:

- a party's remaining balances, from the party screen
- the organization reports: Remaining by Party, Overdue Orders, Dispatch History

"Every format offered" rather than a fixed list, so adding a format adds it to the acceptance
without anyone having to remember to update this file.

## Where

Excel **and** Google Sheets, both. They disagree: Sheets infers types on import where Excel reads
what the file declares, so a file that is fine in one can be wrong in the other. Checking one is
checking half.

## What "opens correctly" means

Pass conditions, each answerable yes or no without judgement:

| Check | Pass condition |
| --- | --- |
| Columns | Each column lands in its own column. Not one column of comma-separated text |
| Header | The first row is the header, recognisable as labels rather than data |
| Quantities | Right-aligned numbers. Selecting a quantity column shows a sum in the status bar |
| Dates | Read as dates, not as text that merely looks like one |
| Encoding | A party name with a comma, a quote or a non-ASCII character renders intact |
| Empty report | A report with no matching rows still shows its header row and is recognisably an empty report, not a blank file |

The quantities row is the one with teeth. Numbers stored as text look identical on screen and
make `SUM` return zero — which a trader discovers while reconciling, not while reading.

The empty-report row exists because `overdue-orders.csv` once exported as two bytes. That is fixed
in code and covered by `test_report_columns.py`; this confirms the fix also *renders* as an empty
table rather than as a file the spreadsheet refuses to open.

## Recording the result

A checked line in `SMOKE_CHECKLIST.md` for that release, naming which applications were used. A
failure is recorded as a defect against the export, not worked around by the person who found it
(spec US3 scenario 4) — the next person to download it will not know about the workaround.

## What this does not replace

The automated checks that run on every change: media types, download filenames, exact columns,
numeric cells in the workbook, PDF magic bytes and trailer. Those catch structure, and they run
constantly. This catches rendering, and it runs once per release. Neither substitutes for the
other.
