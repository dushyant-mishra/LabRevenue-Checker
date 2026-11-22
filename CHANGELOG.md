# Progress log

## 2026-11-22 — v4.0: audited and redesigned POC

- Rebuilt UI with four responsive areas: overview, case workbench, data room, and methodology.
- Fixed mis-selected notice icon that caused duplicated overlay text on the dashboard.
- Corrected HTML `hidden` behavior for dialogs, previews, and dismissible warnings.
- Fixed horizontal overflow in mobile case-review actions.
- Added strict date, quantity, money and duplicate-ID validation; bad imports block findings.
- Added effective-dated contract rates; uncertain and overlapping rates cannot generate false dollar estimates.
- Corrected historical audit cutoff handling for work, invoices, payments and adjustments.
- Separated potentially unbilled work, customer-side discrepancy, adjusted past due and verified cash collections.
- Added evidence cases for orphan payments/credits and invoices marked paid without matching allocations.
- Added safe reviewer states, mandatory documentation for resolutions, and limited documented outcome types by financial category.
- Added privacy-conscious local JSON save/restore for reviewer progress, matched to exact audit inputs and date.
- Added CSV export formula-injection protection and source-row provenance.
- Added **42 engine assertions** plus browser navigation, search, uploads, review evidence, remediation, exports and mobile UI tests.

**Known limitations:** CSV-only import, customer-specific simple unit rates, no PDF/XLSX parsing, no cloud persistence or enterprise security, no financial-system integration, no demonstrated customer recovery.
