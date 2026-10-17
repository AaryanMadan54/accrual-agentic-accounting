# AI-native accounting: research and release roadmap

Research checked 17 October 2026. This is a product recommendation, not a claim that every capability below is implemented. Refer to the application README for delivered functionality.

The requested reference “Relate” is interpreted provisionally as **Rillet**, the AI-native accounting ERP. That identity has not been confirmed with the user.

## What the market already offers

These are vendor and founder descriptions from primary sources, not independently validated performance claims.

| Product | Publicly described approach | Lesson for this release |
|---|---|---|
| **Rillet** | Aura combines GL-grounded answers, task agents, ongoing anomaly monitoring, and reviewable actions with an audit trail. Its ERP includes AR, AP, a general ledger, and close workflows. | Make actions traceable to the underlying records. Reviewability is an expected capability, not a unique selling point. [Aura AI](https://www.rillet.com/product/aura-ai) |
| **Campfire** | A common accounting platform for GL, revenue, reporting, and close. It describes continuous invoice/payment matching and grouping related transactions for faster review, with configurable roles and approval workflows. | A useful home screen should organize decisions around related financial records. [Campfire product](https://campfire.ai/) |
| **DualEntry** | AR includes invoice management, aging, payment matching, and ledger posting. AP includes capture, approval routing, duplicate and mismatch detection, purchase-order matching, and reconciliation. | Competing on a broad checklist immediately would dilute the first release. Pick a small number of workflows and finish them properly. [AR](https://www.dualentry.com/core-financials/accounts-receivable-automation), [AP](https://www.dualentry.com/core-financials/accounts-payable-automation) |
| **Alder — YC Fall 2025** | An AR agent that reads invoices and correspondence, diagnoses collection blockers, drafts or performs follow-up, and retains human approval for customer-facing actions. | Prioritize understanding why an invoice is stuck over generic overdue reminders. [Founder/company profile](https://www.ycombinator.com/companies/alder) |
| **Clerked — YC Fall 2025** | AP agents covering invoice capture, GL coding, matching, approvals, and accounting sync; its founder launch describes a workflow from incoming invoice to recorded payment. | Invoice intake should lead to an actionable approval with evidence, rather than end at extracted fields. [Founder/company profile](https://www.ycombinator.com/companies/clerked) |

## Recommended first release

**A daily finance work queue for a small B2B team, connecting receivables and payables to a minimal general ledger.** Start with one entity and one base currency. Treat other currencies as explicitly unsupported until conversion and settlement rules are implemented.

Three complete workflows provide a coherent first release:

1. **AP review and posting.** Create or import a bill; suggest a ledger category; check likely duplicates; show the source and proposed journal; approve or reject; post once. A suspected duplicate remains on hold until resolved.
2. **AR follow-up.** Create an invoice; track outstanding amounts and aging; surface overdue invoices; prepare an editable follow-up with the invoice, due date, amount, and any recorded promise to pay. Approval of a draft and successful email delivery must remain distinct states.
3. **Cash application.** Record a payment; propose matches from amount, currency, counterparty, and reference; let the user inspect the evidence; apply an approved match; update the invoice balance and balanced ledger entry together.

The ledger foundation should support a chart of accounts, journal lines, posting dates, source links, and a trial balance. Use integer minor units or an exact decimal type for money. Posted entries should be corrected through linked reversals, not silently rewritten. Repeated approval requests must not create duplicate postings.

## The agent interaction

The default experience is a queue of proposed work. Each item answers five questions: **What happened? What evidence supports it? What will change? Who must approve it? What happened after execution?**

An action card should include its source records, an explanation, a proposed amount/account/status change, blocking conditions, and an activity history. Confidence can help triage, but must not bypass deterministic validation or required approval.

Separate three responsibilities in the implementation:

- **Model:** extract, classify, explain, and draft structured proposals.
- **Policy and accounting code:** validate identifiers, currency, amounts, permissions, state transitions, balanced entries, and repeated requests.
- **Execution:** perform only the approved operation, record its outcome, and update the queue from the actual result.

If the initial build uses rules or seeded examples, label that mode clearly. Do not describe a deterministic demo as a live language-model agent or imply that simulated emails, bank transfers, integrations, or background runs occurred.

## A plausible differentiator to validate

**One small, understandable queue that closes the loop from cash exception to accounting result** is a useful product hypothesis. Pair collections priorities with upcoming obligations, make source-to-action-to-journal navigation immediate, and minimize setup for small finance teams.

This is an inference from the comparison, not evidence of an uncontested market gap. Existing products already advertise agents, approvals, evidence, and continuous accounting. The practical differentiation would have to come from the chosen customer segment, faster onboarding, better exception resolution, and measurable reduction in work.

Validate with finance users using completion time, proposal acceptance rate, correction rate, unresolved exceptions, and time from invoice issue to payment. Avoid presenting claimed hours saved or accuracy percentages before measuring them.

## Next iterations

| Iteration | Deliverable | Exit condition |
|---|---|---|
| **First release** | Reviewable AR/AP workflows, payment allocation, minimal double-entry ledger, useful seeded examples, exports, and honest capability labels. | Each visible action works, approved postings balance, retrying an action does not duplicate it, and amounts reconcile across the UI. |
| **Connected pilot** | Durable server storage, authentication and organization isolation, approved model integration, document extraction with evidence, one accounting/email integration, scheduled execution, and role-based approvals. | Pilot users can operate on their own data; access controls and failures are tested; outbound actions have reliable delivery status. |
| **Accounting depth** | Bank statement reconciliation, credits/refunds, partial and excess payments, period locks, posting controls, stronger reversals, reconciliation reports, and accountant-reviewed workflows. | Subledgers reconcile to the GL, corrections preserve history, and close-period controls hold under concurrent use. |
| **Broader ERP** | Multi-entity and currency accounting, purchase orders and receipt matching, revenue schedules, recurring billing, and additional integrations. | Add one area at a time with explicit accounting policy, migrations, reconciliation, and acceptance tests. |

Production accounting and any jurisdiction-specific reporting need separate professional review and operational validation. This research and an initial product release establish no financial, tax, audit, or regulatory compliance claim.
