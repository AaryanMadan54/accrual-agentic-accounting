# Accrual 0.1

A private, single-company GBP accounting workspace for UK services and SaaS businesses. The interface uses a white desktop-style canvas, a quiet grey sidebar, compact controls, and responsive layouts. It is a browser application; Electron packaging is not required for this interface.

## Included

- **Receivables:** create drafts, review and post invoices, record partial or full receipts, inspect source evidence, and export CSV.
- **Payables:** create and code bills, detect duplicate supplier references, approve and post, record payments, and reverse unpaid documents.
- **General ledger:** balanced double-entry postings, a chart of accounts, manual journals, linked reversals, and period locks.
- **Reports:** trial balance, cumulative profit and loss, balance sheet, and historical receivable/payable ageing.
- **Review queue:** policy checks propose bill reviews and overdue-invoice reminder drafts. Each proposal carries evidence, a status, and a snapshot of the document used for approval.
- **Controls:** append-only revision storage, optimistic concurrency, request idempotency, authenticated personal workspaces, separate sample and personal books, and an activity trail.

## AI and spending

Paid AI calls are **disabled by the owner's explicit choice**. `/api/agent` returns 403 after authentication, regardless of environment keys. No live model calls were made during implementation or testing.

The current review queue is a deterministic policy engine. Reminder text is a template, not a model-generated response. A server-side OpenAI Responses adapter for structured bill extraction is prepared in `lib/ai.ts`, but is not called by any route. Enabling it requires explicit spending consent, a selected model, usage controls, server-side secret configuration, and live evaluation.

An API key was saved to the ignored `.env.local` file. Never publish or share that file. It is not required for the current release. The first key created during setup could not be recovered after the environment removed its temporary encryption file; it was never used and should be revoked in the OpenAI project. The saved replacement has the same name, “Agentic Accounting”, and a 30-day expiry.

## Try the release

1. Sign in to the private Site.
2. Start in **Sample books** to explore realistic records.
3. Open **Agent inbox**, review a bill, and choose **Approve & post**.
4. Open **Receivables**, select an invoice, and record a receipt that has already happened.
5. Inspect the resulting journal and reports.
6. Switch to **My books** for an empty, separately stored workspace. Set your company name in Settings.

Recording a payment does not move money. Approving a reminder does not send email. No bank feeds, email delivery, tax filing, automatic reconciliation, multi-currency, multi-entity consolidation, credit notes, or payment reversals are included yet. VAT rates are selected manually; the app does not determine tax eligibility. The P&L is cumulative through the selected date, not a configurable period comparison.

## Architecture

- React 19 client interface with Vinext routing and Cloudflare Workers deployment through Sites.
- Cloudflare D1 durable storage and Sites-managed ChatGPT authentication.
- `lib/accounting.mjs`: pure accounting rules, exact integer pennies, ledger validation, subledger reconciliation, and command transitions.
- `lib/workspace.ts`: owner-scoped persistence, immutable checkpoints, and revision conflict handling.
- `app/api/workspace/route.ts`: authenticated read/write boundary, origin checks, and bounded requests.
- `app/workspace.jsx`: desktop-style interface and workflows.
- `tests/accounting.test.mjs`: accounting regression suite.
- `tests/http-smoke.mjs`: local-only HTTP checks; mutates sample books only.

Each accepted command creates one complete state checkpoint in `workspace_revisions`. A composite primary key on owner, workspace, and revision ensures only one concurrent writer can commit. The journal, subledger, proposal state, idempotency history, and audit trail change together. The app exposes no update/delete path for saved checkpoints.

This deliberately favours a simple atomic transaction boundary for a small first release. Checkpoints grow with the complete workspace state, and a 1.8 MB state limit is enforced. Before larger deployments, move to a normalised append-only journal and event store with database constraints, retention and backup policies, background jobs, stronger audit verification, team roles, and accounting review. Application-level immutability is not a claim of tamper-proof database administration.

## Development

Node.js >=22.13 is required. Keep the bundled Sites build integration.

```sh
npm run dev
node --test tests/accounting.test.mjs
npx tsc --noEmit
npm run build
```

The local development server uses the starter's simulated sign-in at `/signin-with-chatgpt?return_to=/`. It is limited to loopback development and is not included in hosted production builds. Production identity headers are supplied by the Sites gateway; do not expose the Worker directly without that authentication boundary.

Database migrations are in `drizzle/`. Generate future migrations with `npm run db:generate`; never rewrite applied migrations. Build the project before applying a new local migration using the starter's Wrangler configuration.

On this Windows host, the system npm command shim needed a checkout-local wrapper in ignored `.sites-runtime/bin/`; the source and lockfile are portable. Use the documented Sites helper for source sync, packaging, and private deployment.

## Validation

The 28 accounting regression checks, 10 local HTTP checks, TypeScript check, and production build passed. Browser checks verified the narrow responsive layout, invoice creation, posting and partial receipts. Publication details are recorded in `../release-notes.md`.

Browser verification initially hit an approval-review usage limit. After the reported reset, browser access resumed and the narrow layout and primary invoice flow were verified. A focus reset issue between dialogs was corrected. Full desktop-width visual inspection and broader device/accessibility testing remain outstanding.

## Next iteration

1. Complete browser acceptance testing and accountant review with representative real workflows.
2. Add receipt/payment reversals and credit notes before expanding accounting use.
3. Activate budgeted bill extraction with reviewed evaluations, then add proposal-only tool use and evidence-linked analysis.
4. Add bank-statement import and reconciliation; email drafts should use an explicit delivery outbox and delivery status.
5. Add roles, approval thresholds, backups, normalised ledger storage, operational monitoring, and accounting exports for a production rollout.

See `../research-and-roadmap.md` for competitor research and the broader staged roadmap.
