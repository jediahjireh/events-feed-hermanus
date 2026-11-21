# Cost Tracking

All numbers verified as of 21 November 2026.

## Build Phase

| Item | Model/Service | Usage | Cost |
|---|---|---|---|
| Design iteration | Claude Opus 4.6 (via Claude Max) | ~50K tokens | $0 (subscription) |
| Code generation | Claude Opus 4.6 (via Claude Max) | ~100K tokens | $0 (subscription) |
| SerpAPI testing | Google Events API | ~10 test queries | $0 (free tier: 250/month) |
| Quicket data testing | Apify SA Events Scraper | ~5 test runs | $0 (free tier) |
| Database | Neon PostgreSQL | <10 MB | $0 (free tier: 1 GB) |
| Hosting (dev) | Vercel | Dev server | $0 (Hobby tier) |
| **Total build cost** | | | **$0** |

## Production Run Cost (Weekly — v1, Hermanus only)

| Item | Model/Service | Volume | Unit cost | Weekly cost |
|---|---|---|---|---|
| SerpAPI queries | Google Events API | ~20/week (~80/month, within 250/month free) | $0.025/query (Starter), free tier covers v1 | $0 |
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

| Destinations | SerpAPI plan | SerpAPI/month | Haiku 5.5/month | Total/month |
|---|---|---|---|---|
| 1 (Hermanus) | Free (250/month) | $0 | $0.15 | **$0.15** |
| 10 | Starter ($25/month, 1K searches) | $25 | $1.50 | **~$27** |
| 50 | Developer ($75/month, 5K searches) | $75 | $7.50 | **~$83** |
| 100 | Production ($150/month, 15K searches) | $150 | $15 | **~$165** |

SerpAPI is overwhelmingly the dominant cost at scale. Claude Haiku 5.5 at $0.10/M input tokens is essentially free for structured extraction workloads.

**Options to reduce SerpAPI cost at scale:** Cache more aggressively (don't re-query within 24h), reduce query frequency for low-change destinations, or use Google Custom Search API ($5/1000 queries) as a cheaper alternative.

## Key Pricing Sources (verified Nov 2026)

- Claude Haiku 5.5: $0.10/M input, $0.50/M output — [Anthropic pricing](https://www.anthropic.com/pricing)
- SerpAPI: 250 free/month, then $25/1K (Starter) to $0.01/query (Production) — [SerpAPI pricing](https://serpapi.com/pricing)
- Neon: 1 GB free, 100 CU-hours/month — [Neon pricing](https://neon.tech/pricing)
- Vercel Hobby: $0, cron limited to 1x/day — [Vercel pricing](https://vercel.com/pricing)
