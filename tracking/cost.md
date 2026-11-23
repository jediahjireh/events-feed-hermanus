# Cost Tracking

All numbers verified as of 22 November 2026.

## Build Phase

| Item                    | Model/Service                                  | Usage            | Cost                      |
| ----------------------- | ---------------------------------------------- | ---------------- | ------------------------- |
| Design iteration        | Claude Opus 4.6 (via Claude Code / Claude Max) | ~50K tokens      | $0 (subscription)         |
| Backend code generation | Claude Opus 4.6 (via Claude Code / Claude Max) | ~100K tokens     | $0 (subscription)         |
| Frontend + verification | Claude Opus 4.6 (via Claude Code / Claude Max) | ~150K tokens     | $0 (subscription)         |
| Ask API agent           | Claude Opus 4.6 (via Claude Code / Claude Max) | ~30K tokens      | $0 (subscription)         |
| SerpAPI testing         | Google Events, Eventbrite engines              | ~5 test searches | $0 (free tier: 250/month) |
| Apify actor testing     | Facebook, Quicket actors                       | ~10 test runs    | $0 (free tier: $5 credit) |
| Database                | Neon PostgreSQL                                | <10 MB           | $0 (free tier: 1 GB)      |
| Hosting (dev)           | Vercel                                         | Dev server       | $0 (Hobby tier)           |
| **Total build cost**    |                                                |                  | **$0**                    |

Note: The frontend build, Ask API agent, /verify audit, multi-fix cycle, and doc updates were all done via Claude Code (Opus 4.6) under the Claude Max subscription. No additional API costs — the frontend and Ask API are pure client-side code calling the existing API routes. The Ask API chat endpoint uses Claude Haiku 5.5 for function calling at runtime (~$0.0001/query).

## Production Run Cost (Weekly — v1, Hermanus only)

| Item                         | Model/Service                        | Volume            | Unit cost                                               | Weekly cost    |
| ---------------------------- | ------------------------------------ | ----------------- | ------------------------------------------------------- | -------------- |
| SerpAPI                      | Google Events, Eventbrite, TripAdvisor | ~35 searches/week | Free tier (250/month)                                 | $0             |
| Apify actors                 | Facebook, Quicket                    | ~8 runs/week      | ~$0.01–0.05/run (platform compute), free tier covers v1 | $0             |
| Claude Haiku 5.5 (ingestion) | `claude-haiku-5-5` via Anthropic API | ~100K tokens      | $0.10/M input, $0.50/M output                           | ~$0.02         |
| Claude Haiku 5.5 (review)    | `claude-haiku-5-5` via Anthropic API | ~60K tokens       | same                                                    | ~$0.01         |
| Claude Haiku 5.5 (relevance) | `claude-haiku-5-5` via Anthropic API | ~20K tokens       | same                                                    | ~$0.005        |
| Claude Haiku 5.5 (Ask API)   | `claude-haiku-5-5` via Anthropic API | ~10K tokens       | same                                                    | ~$0.005        |
| Database                     | Neon PostgreSQL                      | <100 MB           | —                                                       | $0 (1 GB free) |
| Hosting                      | Vercel                               | Hobby             | —                                                       | $0             |
| **Total weekly**             |                                      |                   |                                                         | **~$0.04**     |
| **Monthly estimate**         |                                      |                   |                                                         | **~$0.17**     |

## Model Choice Rationale

| Model                          | Used for                                                               | Why this model                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Haiku 5.5 (`claude-haiku-5-5`) | All production tasks (extraction, review, relevance) via Anthropic API | $0.10/M input, $0.50/M output — 90% cheaper than Haiku 4.5. Structured extraction from HTML doesn't need reasoning. ~$0.002/page. Released Oct 2026. |
| Opus 4.6 (`claude-opus-4-6`)   | Design phase only (via Claude Code / Claude Max subscription)          | Used interactively during design and code generation. Never in production — cost would be prohibitive for batch extraction.                          |
| Sonnet                         | Not used                                                               | Mid-range model. Not needed: Haiku handles extraction, Opus handles design. No middle ground required for this workload.                             |
| GPT-4o / GPT-6                 | Not used                                                               | No advantage over Haiku 5.5 for structured extraction. Claude's tool use and structured output is more reliable for this use case.                   |

## Scaling Cost Projection

| Destinations | Apify plan             | Apify/month | Haiku 5.5/month | Total/month |
| ------------ | ---------------------- | ----------- | --------------- | ----------- |
| 1 (Hermanus) | Free ($5 credit/month) | $0          | $0.17           | **$0.17**   |
| 10           | Starter ($49/month)    | $49         | $1.70           | **~$51**    |
| 50           | Scale ($499/month)     | $499        | $8.50           | **~$508**   |
| 100          | Business (custom)      | ~$800       | $17             | **~$817**   |

Hybrid source strategy: SerpAPI for Google Events + Eventbrite + TripAdvisor (structured search APIs), Apify for Facebook + Quicket (social media scraping). SerpAPI free tier (250 searches/month) covers v1 easily. At scale, SerpAPI tiers ($50/5000 searches) are competitive. Apify platform compute dominates cost for the scraping sources. Claude Haiku 5.5 at $0.10/M input tokens is negligible for structured extraction workloads.

**Options to reduce cost at scale:** Cache SerpAPI results (1h cache built-in, `no_cache=false`). Don't re-run Apify actors within 24h. Reduce run frequency for low-change destinations.

## Key Pricing Sources (verified Nov 2026)

- Claude Haiku 5.5: $0.10/M input, $0.50/M output — [Anthropic pricing](https://www.anthropic.com/pricing)
- SerpAPI: 250 searches/month free, then $50/5000 searches — [SerpAPI pricing](https://serpapi.com/pricing)
- Apify: $5 free credit/month, then $49/month (Starter) — [Apify pricing](https://apify.com/pricing)
- Neon: 1 GB free, 100 CU-hours/month — [Neon pricing](https://neon.tech/pricing)
- Vercel Hobby: $0, cron limited to 1x/day — [Vercel pricing](https://vercel.com/pricing)
