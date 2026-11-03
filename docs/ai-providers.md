# Using a model with Accrual

The deployed app runs accounting checks immediately. Optional external model calls are off by default. A server administrator can configure either Groq or OpenAI for a later approved trial.

| Server setting | Purpose |
| --- | --- |
| AI_PROVIDER | groq or openai |
| AI_MODEL | A model available on that account that supports the provider's strict JSON schema output |
| GROQ_API_KEY or OPENAI_API_KEY | Private credential for the selected provider |
| AI_ENABLED | Explicit enable switch, default false |
| AI_USAGE_APPROVED | Separate usage approval switch, default false |
| AI_DAILY_LIMIT | Maximum reservations per owner across both workspaces in a rolling 24 hours, default 20, maximum 50 |

Store the key in a server secret. Use an ignored local environment file only for development. Both switches must be true and the selected provider, key and model present. Opening the workspace or running accounting rules makes no model request. Account pricing and usage limits belong to the provider. The request-count cap is not a currency budget.

**Document intake** sends the supplied bill text to the selected provider. Missing fields and extraction warnings remain visible for review. Saving creates an editable draft linked to the stored source and extraction run.

**Agent inbox** can send the company name, trial balance, document count and evidence for current proposals to prioritise. The model must refer to supplied proposal IDs. The server rejects an invalid structure or unknown ID. Posting goes through a separate approval and accounting validation step.

Accrual stores the input, output, model, status and timestamps for each reserved run. Reusing a successful request ID returns its saved output. Failed or interrupted runs can consume quota. The UI lists recent runs per workspace. Check that history before repeating a request.

Provider adapters are covered by offline fixtures. A live trial with representative redacted bills, an approved provider account and review of missing fields, VAT and totals is still required.
