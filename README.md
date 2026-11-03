# Accrual · Agentic accounting

Accrual 0.2 gives a UK services or SaaS company a private GBP ledger, receivables, payables and one bank account. Start in **My books** for your own records. **Sample books** has its own data. [Open Accrual](https://accrual-finance.deepgnat260.chatgpt.site)

## Run a transaction through the books

1. Open Settings and enter the company details that should appear on invoices. Record an opening bank balance with a balanced journal dated before the first statement.
2. Open Document intake. Paste a supplier bill's text or import a text file, review the fields, choose its expense account and VAT rate, then save the draft. Keep the original invoice or attachment separately.
3. Run the checks in Agent inbox. Inspect the source and proposed posting before approving the bill. Receivables supports the corresponding customer workflow and printable invoice downloads.
4. Import a GBP bank CSV in Banking. Give the statement dates and balances, choose the date format and preview the rows. Supported columns include Date, Description and signed Amount, or separate Money in and Money out.
5. Review suggested matches. Linking an existing payment adds bank evidence. Matching an unpaid document records the payment and links it in the same transaction. Categorise bank-only entries separately.
6. Review outstanding ledger items, compare the adjusted statement balance with the ledger, and finalise the reconciliation. Inspect the resulting journals, trial balance, P&L, balance sheet and historical ageing in Reports.

Credit notes reduce outstanding invoices or bills at the original VAT rate. Payment and credit corrections create linked reversing journals. Posted documents retain their history. Period locks protect closed books. Settings provides a JSON export of workspace records.

## What the agent does

On request, accounting rules read the current books, flag duplicate references, repeat charges and unusually large supplier bills, propose bill postings, prepare collection reminders and find bank matches. Approvals recheck the underlying record before posting. These workflows run with no model key.

Two optional model workflows are integrated. Bill extraction returns editable fields from supplied text. Finance review prioritises actual pending proposals and can ask questions about the current books. Both record a run history. External calls are disabled in the hosted release. [Provider configuration](docs/ai-providers.md)

## Run locally

Use Node 24 and the included lockfile. Install dependencies and build the Worker.

```sh
npm ci
npm run build
```

On a **fresh local database** apply each migration in order. On an existing database apply only outstanding migrations.

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_awesome_deathbird.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_outstanding_frightful_four.sql
npm run dev
```

The development sign-in simulates a local user. Hosted identity depends on the Sites authentication gateway. Run `npm test` for the accounting and offline provider suites and `npx tsc --noEmit` for TypeScript. With a local server at port 5173, run `node tests/http-smoke.mjs` and `node tests/http-reconciliation.mjs` against disposable sample books.

## Architecture and operating limits

React and Vinext serve a desktop-style web interface on Cloudflare Workers. Authenticated commands apply double-entry rules in integer pennies and commit an entire workspace revision to D1. The owner, workspace and revision form a unique key to prevent lost updates. Command IDs make retries safe. Provider credentials stay on the server. Agent run history has its own database table.

This release is suitable for a small, owner-operated pilot. Each checkpoint has a 1.8 MB application limit. Team roles, multiple currencies, bank feeds, payment initiation, email delivery, PDF/OCR intake, tax filing and a tested backup restore workflow are outside this release. VAT classification requires review. A JSON export is available for inspection and independent recordkeeping.

The source is public under the [MIT licence](LICENSE). The hosted books are private. [Release notes](docs/release-notes.md) · [Product research](docs/research-and-roadmap.md)
