# 90-day customer pilot roadmap

**November 2026:** Finish demonstrable POC; run accounting test cases; prepare fictional walkthrough and guarded example data. Review competitors and identify 15–25 independent testing laboratories for discovery. Do not collect patient or confidential data by email.

**December 2026:** Conduct discovery interviews and secure 2–3 authorized de-identified historical data samples. Build robust XLSX importer and mapping; add contract-term confirmation workflow for a single service family; independently validate discrepancies with an accountant or customer finance reviewer.

**January 2027:** Implement critical fixes from customer data, secure pilot data retention and access policies, and complete controlled shadow-mode testing. Obtain written evaluation criteria with pilot customers.

**February 2027:** Offer fixed-scope paid assessments only if real cases are verified and the data processing practices are appropriate. Measure validated dollar discrepancies, recovered amounts, false positives, analyst time saved and onboarding/support hours.

## Launch gates

1. Three customer interviews confirm the same financially significant problem.
2. At least two data sets use the same mapping/rules without custom code.
3. No known invalid financial outcomes in reviewed pilot cases.
4. At least one customer agrees to pay for a clearly scoped assessment.
5. Written security, retention and error-correction procedures in place before real uploads.

## Not built yet

- XLSX/PDF contract and invoice ingestion with human-reviewed extracted clauses.
- Contract amendments, tiered pricing, complex adjustments, tax or currency rules.
- Account authentication, tenant isolation, durable audit log and encrypted cloud storage.
- Accounting and LIMS connectors, approved invoice amendments, collections.

The current app is intentionally **offline and read-only**. Do not market it as compliant clinical billing software or imply that detected discrepancies have been recovered.
