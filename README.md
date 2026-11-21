# Hermanus Event Feed

A local event feed for Hermanus, South Africa. Collects events from multiple sources (APIs, scrapers, manual submission), normalises them into a unified temporal model, and serves them via an agent-friendly REST API so travel agents and AI trip-planning agents can answer: _"What is on while my traveller is there?"_

Built as a Magic Safari founding engineer homework project.

## Start Here

| File                                       | What it is                                                                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [DESIGN.md](DESIGN.md)                     | **The main deliverable.** Full design write-up: data model, API, agents, principles, hand-worked cases, cost estimate.                                                      |
| [docs/pen-and-paper/](docs/pen-and-paper/) | Pen-and-paper sketches done before writing any code — 6 pages covering the problem, data model, temporal overlap logic, architecture, sources/gaps, and quality/API design. |
| [CLAUDE.md](CLAUDE.md)                     | Project standing orders for Claude Code: tech stack, code style, workflow rules, project structure.                                                                         |

## Key Directories

| Directory              | Purpose                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| [src/](src/)           | Application code — API routes, DB schema, temporal logic, agents, source adapters.         |
| [tests/](tests/)       | Test suite — temporal overlap, deduplication, API endpoints, hand-worked acceptance cases. |
| [docs/](docs/)         | Build prompts, prompt chain, web research references.                                      |
| [tasks/](tasks/)       | Task management — todo tracking, lessons learned, feature briefs, fixes knowledge base.    |
| [tracking/](tracking/) | Time and cost tracking for the build.                                                      |
| [.claude/](/.claude/)  | Claude Code configuration — 9 skills, workflow reference, shared settings.                 |

> **Note on binary files:** The pen-and-paper photos and homework PDF are committed for process visibility. In a production repo these would be gitignored or stored externally.

## Tech Stack

Next.js 16 (App Router) · TypeScript · Drizzle ORM · Neon PostgreSQL · Zod · Claude Haiku 5.5 · Vercel

## Running Locally

```bash
pnpm install
cp .env.example .env.local
# Fill in: DATABASE_URL, ANTHROPIC_API_KEY, APIFY_API_KEY
pnpm drizzle-kit push
pnpm tsx src/db/seed.ts
pnpm dev
pnpm test
```

For a full testing walkthrough (curl commands, hand-worked cases, and a copy-paste prompt for Claude/Codex), see [docs/testing-guide.md](docs/testing-guide.md).
