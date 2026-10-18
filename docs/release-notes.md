# Accrual — Agentic Accounting — MVP v1

Application version: 0.1.0. First published 17 October 2026; release labelled MVP v1 on 18 October 2026.

Private early-access release for a single UK services or SaaS company using GBP.

[Open Accrual](https://accrual-finance.deepgnat260.chatgpt.site). Access remains restricted to the owner. This is a browser app with a white desktop-style interface, not an installed Electron binary.

## Delivered

- AR drafts, invoice posting, customer balances, and partial/full receipts.
- AP drafts, expense coding, duplicate-reference checks, approvals, and payments.
- A balanced double-entry ledger with integer pennies, manual journals, linked reversals, and period locks.
- Trial balance, cumulative P&L, balance sheet, and historical AR/AP ageing.
- An evidence-linked review queue for bills, duplicates, and reminder drafts.
- Separate sample and personal books, durable owner-scoped storage, activity history, and CSV exports.

## Final release improvements

- Replaced the ambiguous “AI paused” wording with **Live AI is off** and explained that rule-based checks remain available.
- Added a provider-neutral extraction contract with prepared Groq and OpenAI adapters. They are not connected to an application route. No live model API calls were made.
- Added strict output validation and eight offline adapter tests. Disabled adapters make no network requests; provider errors are sanitised and never retried automatically.
- Corrected dialog focus when switching to payment entry. Added this release guide, provider documentation, and a self-contained README.

## Verification

The first deployment passed 28 accounting tests, ten local HTTP checks, TypeScript checking, and the production build. Browser checks covered the narrow responsive layout, invoice creation, posting, a partial receipt, and bill approval. The final update passed eight offline adapter tests, a fresh TypeScript check, and a fresh production build; the revised review-queue wording was verified in the browser. The handoff receipt records the final source commit and deployment result.

The accounting suite covers exact money and VAT rounding, balanced posting, overpayment prevention, idempotency, stale proposals, duplicate bills, linked reversals, closed periods, and historical ageing. HTTP checks cover authentication, isolation, persistence, cross-origin rejection, concurrent writes, and the AI spending lock. Adapter tests use mocked responses; model quality has not been evaluated.

Full desktop-width browser inspection, broader device/accessibility testing, and independent accountant acceptance testing remain outstanding.

## Boundaries and next work

This is an early MVP. Recording payments does not move money; approving reminders does not send email. VAT treatment is entered manually. There are no credit notes, settled-payment reversals, bank reconciliation, tax filing, multi-currency, team roles, or background jobs. The P&L is cumulative, and the simple checkpoint persistence design has a 1.8 MB state limit.

Next: connect a confirmed free-tier provider securely, complete reviewed extraction, add payment reversals and credit notes, then implement statement import and reconciliation. Before wider production use, add backup/restore operations, normalised ledger storage, roles, monitoring, and accounting review.
