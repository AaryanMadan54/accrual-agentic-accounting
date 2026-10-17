# AI providers and activation

Accrual is the app's working name. The app and the language model are separate systems: the app keeps the books; a future model connection can propose draft information for review.

## What works today

All AR, AP, ledger, reporting, and review-queue workflows work without an API key. Bill checks and reminder drafts use rules and templates. The label **Live AI is off** describes only external model calls. It is unrelated to Codex usage limits and does not mean the accounting app is paused.

`POST /api/agent` authenticates the caller and then always returns 403. No model request is made, regardless of any environment variables. There is no UI switch that can incur API charges.

## Prepared adapters

`lib/ai.ts` exposes one validated bill-extraction contract with two provider adapters:

| Provider | API | Release status |
| --- | --- | --- |
| Groq | Chat Completions with strict JSON Schema | Implemented and tested with mocked responses; not connected or live-tested |
| OpenAI | Responses with strict JSON Schema and `store: false` | Implemented and tested with mocked responses; not connected or live-tested |
| OpenRouter, Gemini, Anthropic | Provider-specific integration | Possible future additions; not implemented in this release |

No model writes accounting records. The adapter only returns proposed fields and warnings. Missing information stays null; malformed financial fields, impossible dates, and extra keys are rejected. Non-GBP currency and unsupported VAT rates are flagged. Timeouts and provider failures stop the request, with no automatic retry or fallback that could add usage.

## Recommended first connection

Start with a **Groq Free-tier account** and synthetic sample bills. Groq documents a separate paid Developer tier and per-model free limits. An API key alone does not prove which billing tier an account uses. Confirm Free tier in the provider dashboard before authorising any live test. The current code must not infer free usage from a model name or silently upgrade the account.

`openai/gpt-oss-20b` is listed by Groq as supporting strict structured output. Although the model name starts with `openai/`, a Groq request uses a Groq key, Groq's service, and Groq's account limits. Recheck availability and the account's limits at activation time.

Sources checked on 17 October 2026: [Groq billing](https://console.groq.com/docs/billing-faqs), [rate limits](https://console.groq.com/docs/rate-limits), [structured outputs](https://console.groq.com/docs/structured-outputs), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). OpenRouter also documents [free model variants](https://openrouter.ai/docs/guides/routing/model-variants/free) with limits; it is an alternative to evaluate, not a connected provider here.

## Activation work remaining

1. Confirm the provider account and usage plan. Preserve the owner's instruction to avoid paid calls.
2. Provision the chosen key using a secure secret-entry mechanism. Never paste a key into chat, commit it, put it in a browser bundle, or use a public-prefixed environment variable. Local development uses an ignored environment file; deployment needs a separate server-side secret. No Groq key has been provided or saved.
3. Add the authenticated extraction route with origin checks, bounded input, rate limits, and auditable request status. The current unconditional 403 is intentional; changing an environment variable does not unlock it.
4. Show source text and extracted fields together in an editable draft form. Reject unsupported currency or unresolved required fields before saving. Preserve the existing explicit approval before ledger posting.
5. Evaluate representative bills, missing fields, prompt injection, duplicates, ambiguous dates, and model refusals. The eight mocked adapter tests verify integration behaviour, not model accuracy.
6. Run a small authorised live evaluation on sample data before enabling real documents. Review the provider's data terms for the deployment's region and account plan.

There is no autonomous background agent, OCR/PDF ingestion, tool loop, email sending, or bank connection in v0.1. These are future iterations, not hidden features awaiting a key.
