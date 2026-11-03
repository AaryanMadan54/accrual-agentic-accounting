# Accrual 0.2 · Agentic accounting

My books now opens by default. This release adds source-text bill intake, full draft editing, printable invoices, credit notes, payment corrections, statement CSV import, approval of bank matches, reconciliation with outstanding timing items, and period P&L. Accounting commands, evidence and approvals persist across sign-ins.

The Agent inbox can propose real book changes. An approved match links an existing bank movement or posts the missing payment. An outdated proposal must be reviewed again. Optional Groq and OpenAI integration provides structured bill extraction and a read-only finance review with server-side limits and run history. Activation awaits provider credentials and explicit usage approval.

Local integration verification covers authenticated document posting, a partial receipt, concurrent writes, duplicate requests, a complete supplier bill and bank reconciliation, and subsequent corrections. Offline tests cover ledger invariants, period controls, statement balancing, provider boundaries and invalid model responses.

See the [README](../README.md) for operating limits and setup. The original public MVP is available at the `mvp-v1` Git tag.
