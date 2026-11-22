# LabRevenue Check — Rebuilt proof of concept (v3.0)

A realistic offline billing-reconciliation demonstration for independent **non-clinical B2B testing laboratories**. This application is an **auditing and case-review POC**, not a production financial system, an AI agent, or certified medical billing software.

## Quick start

**Option A — single file:** Open `LabRevenue_Check_v3_Demo.html` in a current browser. No installation, account, key, internet connection or backend is needed.

**Option B — editable project:** Open `index.html` in a browser. Keep `app.js`, `engine.js`, `demo-data.js` and `styles.css` in the same directory.

The initial workspace is fictional. It deliberately includes underbilling, invoiced quantities that exceed work records, past-due balances, approved credits/write-offs, a void invoice, a missing rate and an overlapping rate. Nothing is sent externally.

## Working features

- Four-section responsive desktop/mobile UI (overview, cases, data room, methods)
- Audit-as-of date and rigorous validation before findings are shown
- CSV import of work, contract rate schedules, issued invoice lines, payment allocations and credit/write-off adjustments
- **No mixing of fictional demonstration files with customer files:** uploading the first custom CSV clears all sample data
- Customer-specific effective-dated rates (missing/overlapping rates produce unquantified evidence cases)
- Completed work vs invoice quantity; under-rate/over-rate; customer-side overbilling risk
- Overdue invoice reconciliation using both payments and approved credits/write-offs
- Past-due financial totals disabled if either payments or adjustment export is omitted
- Possible repeated invoice line warning, orphan payments, invoice-without-work, overpayment review
- Distinct financial buckets; never add potential underbilling and A/R into a “recovered” total
- Filterable exception register, searchable by customer/job/invoice
- Case details with calculations and expandable original source rows
- Statuses, review notes, resolution outcomes and mandatory proof references for logged recoveries
- Reviewable correction/payment follow-up drafts (not automatically sent)
- CSV export of the entire audit register or individual cases; export values sanitized against spreadsheet-formula injection

## Fictional sample audit (as of 2026-11-22)

| Metric | Amount |
|---|---:|
| Potential underbilling | $1,390.00 |
| Past-due adjusted receivables | $610.00 |
| Customer-side quantity/rate variance | $210.00 |
| Additional evidence needed | 2 cases (unquantified) |
| Total exceptions | 8 |
| Confirmed recoveries | $0 until a reviewer logs and documents an actual outcome |

**Do not add these financial categories together as cash that can be recovered.** They overlap conceptually in customer balances, and documented collection requires separate verification.

## Uploading your own CSV data

In **Data room**, upload 3 required files: `completed_work.csv`, `contract_rates.csv` and `invoice_lines.csv`. Optional: `payments.csv` and `adjustments.csv`. The A/R module runs only if BOTH optional datasets are supplied, to avoid mistakenly assuming there were no payments or credits.

Download the `Sample ↓` buttons for column order and examples; column headers must match exactly. All sample files also live under `samples/`.

Click **Run reconciliation**. Fix any blocking validation errors. Review exceptions and export case details. **Never enter sensitive patient records in this demonstration.**

### Core rules and assumptions

- Amounts use integer cents; quantities allow up to three decimals. Dates use ISO `YYYY-MM-DD`.
- A service group matches on `job_id + customer_id + service_code`.
- A dated rate is accepted only if exactly one rate matches every completed unit in its group and every matched rate has the same value; otherwise the group is unquantified.
- Draft and void invoices, future-dated work, future-dated invoices, future-dated payments and future-dated adjustments are excluded from a historical snapshot.
- Work identified as nonbillable is excluded.
- Invalid source data blocks the audit rather than skipping dubious rows.
- Incomplete contracts, unrecorded discounts, bundled rates or missing billing-system exports can invalidate a finding; **all cases require human review.**
- Unmatched payments and adjustments outside the invoice export are reported as warnings, not silently allocated.
- No adjustments to invoices or records are performed by the application.

## Limitations / production blockers

This POC **does not** implement PDF/XLSX extraction, OCR, AI contract interpretation, invoice dispatch, accounting-system write-back, tax logic, currencies beyond USD, tiered/ranged rates, bundled prices, deposits, payment splitting across invoices, historical data retention or authenticated multi-tenant storage. No legal enforceability or credit entitlement is inferred.

It is a self-contained local evaluation, **not** an online SaaS or a secure system approved for regulated customer/patient data. State and notes disappear on refresh (export the case register to save them). Validate contracts and complete source coverage before using any result in a real financial decision.

## Testing

With Node.js (v18 or newer):

```bash
node tests/engine.test.js
```

With Python and Playwright plus Chromium installed:

```bash
python tests/browser_smoke.py
```

The browser test injects the HTML, CSS and JS directly to accommodate restricted test environments; a normal local browser opens the stand-alone file directly.

**Tests:** 34 deterministic accounting/validation scenarios, plus automated browser navigation, filters, CSV upload, rejected invalid audit, evidence viewer, reviewer save, documented resolution, CSV export and mobile viewport checks.

## Research-informed design decisions

- A 2026 community clinical-research site case study documented large potentially unclaimed amounts and late/inconsistent revenue records. It is contextual evidence, **not** a statistical forecast for commercial laboratories: https://pmc.ncbi.nlm.nih.gov/articles/PMC13202494/
- Stripe notes the importance of invoice-linked credit memos and correctly classifying partial payments: https://stripe.com/guides/payment-processing
- OWASP documents spreadsheet formula-injection risk when exporting user-controlled CSV fields: https://owasp.github.io/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Injection/21-CSV_Injection
- Existing lab billing/RCM vendors already solve many adjacent problems. A credible business needs real pilots, outcomes and measured differences—not claims of a completely unserved market.

## Proposed next development stage (after pilot feedback)

1. Verified XLSX/PDF ingestion and column mapping, with explicit extraction confidence and human approval.
2. Contract-term extraction into versioned, signed-off rate tables; no unrestricted AI rule generation.
3. Provenance-rich immutable audit history and end-to-end remediation tracker.
4. Secure, authenticated, multi-tenant product and accounting/LIMS connectors, with independent security review before customer data.

Copyright © 2026. Prototype provided for evaluation; no independent security certification or legal/accounting review is implied.
