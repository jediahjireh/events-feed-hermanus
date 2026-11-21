# Cost Tracking

All numbers verified as of 21 November 2026.

## Build Phase

| Item | Model/Service | Usage | Cost |
|---|---|---|---|
| Design iteration | Claude Opus 4.6 (via Claude Max) | ~50K tokens | $0 (subscription) |
| Code generation | Claude Opus 4.6 (via Claude Max) | ~100K tokens | $0 (subscription) |
| Apify actor testing | Google Events, Facebook, Eventbrite, TripAdvisor, Quicket actors | ~15 test runs | $0 (free tier: $5 credit) |
| Database | Neon PostgreSQL | <10 MB | $0 (free tier: 1 GB) |
| Hosting (dev) | Vercel | Dev server | $0 (Hobby tier) |
| **Total build cost** | | | **$0** |

## Production Run Cost (Weekly — v1, Hermanus only)

| Item | Model/Service | Volume | Unit cost | Weekly cost |
|---|---|---|---|---|
| Apify actors | Google Events, Facebook, Eventbrite, TripAdvisor, Quicket | ~20 runs/week | ~$0.01–0.05/run (platform compute), free tier covers v1 | $0 |
| Claude Haiku 5.5 (ingestion) | `claude-haiku-5-5` via Anthropic API | ~100K tokens | $0.10/M input, $0.50/M output | ~$0.02 |
| Claude Haiku 5.5 (review) | `claude-haiku-5-5` via Anthropic API | ~60K tokens | same | ~$0.01 |
| Claude Haiku 5.5 (relevance) | `claude-haiku-5-5` via Anthropic API | ~20K tokens | same | ~$0.005 |
| Database | Neon PostgreSQL | <100 MB | — | $0 (1 GB free) |
| Hosting | Vercel | Hobby | — | $0 |
| **Total weekly** | | | | **~$0.04** |
| **Monthly estimate** | | | | **~$0.15** |

## Model Choice Rationale

| Model | Used for | Why this model |
|---|---|---|
| Haiku 5.5 (`claude-haiku-5-5`) | All production tasks (extraction, review, relevance) via Anthropic API | $0.10/M input, $0.50/M output — 90% cheaper than Haiku 4.5. Structured extraction from HTML doesn't need reasoning. ~$0.002/page. Released Oct 2026. |
| Opus 4.6 (`claude-opus-4-6`) | Design phase only (via Claude Code / Claude Max subscription) | Used interactively during design and code generation. Never in production — cost would be prohibitive for batch extraction. |
| Sonnet | Not used | Mid-range model. Not needed: Haiku handles extraction, Opus handles design. No middle ground required for this workload. |
| GPT-4o / GPT-6 | Not used | No advantage over Haiku 5.5 for structured extraction. Claude's tool use and structured output is more reliable for this use case. |

## Scaling Cost Projection

| Destinations | Apify plan | Apify/month | Haiku 5.5/month | Total/month |
|---|---|---|---|---|
| 1 (Hermanus) | Free ($5 credit/month) | $0 | $0.15 | **$0.15** |
| 10 | Starter ($49/month) | $49 | $1.50 | **~$51** |
| 50 | Scale ($499/month) | $499 | $7.50 | **~$507** |
| 100 | Business (custom) | ~$800 | $15 | **~$815** |

Apify platform compute is the dominant cost at scale. Claude Haiku 5.5 at $0.10/M input tokens is essentially free for structured extraction workloads. All 5 Apify actors (Google Events, Facebook Events, Eventbrite, TripAdvisor, Quicket) share the same Apify account and compute budget.

**Options to reduce Apify cost at scale:** Cache results aggressively (don't re-run actors within 24h), reduce run frequency for low-change destinations, use longer actor run intervals for stable sources (TripAdvisor, Eventbrite).

## Key Pricing Sources (verified Nov 2026)

- Claude Haiku 5.5: $0.10/M input, $0.50/M output — [Anthropic pricing](https://www.anthropic.com/pricing)
- Apify: $5 free credit/month, then $49/month (Starter) — [Apify pricing](https://apify.com/pricing)
- Neon: 1 GB free, 100 CU-hours/month — [Neon pricing](https://neon.tech/pricing)
- Vercel Hobby: $0, cron limited to 1x/day — [Vercel pricing](https://vercel.com/pricing)
