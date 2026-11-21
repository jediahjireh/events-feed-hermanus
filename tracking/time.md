# Time Tracking

Target: 1–2 hours personal time (per spec). Claude runs on its own beyond that.

## Log

| Phase     | Activity                                                                                                       | Personal time | Claude time   | Notes                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------- | ------------- | ------------- | ----------------------------------------------------- |
| Research  | Read homework spec, handbook, AI & automation page                                                             | 15 min        | —             | First-principles understanding before touching tools  |
| Research  | Evaluate Hermanus event sources (SerpAPI, Quicket, local sites)                                                | 10 min        | 20 min        | Agent ran parallel web research                       |
| Research  | Study schema.org Event/Schedule types, agent-friendly API patterns                                             | 5 min         | 15 min        | Web searches for temporal modelling patterns          |
| Design    | Pen-and-paper notes (6 pages: problem, data model, overlap logic, architecture, sources + gaps, quality model) | 20 min        | —             | Photos in docs/pen-and-paper/                         |
| Design    | Write DESIGN.md (data model, API, principles, open decisions, hand-worked cases)                               | 25 min        | 40 min        | Most important deliverable                            |
| Setup     | Create CLAUDE.md, skills, project structure                                                                    | 5 min         | 15 min        | Agent setup for build phase                           |
| Build     | DB schema, API routes, temporal logic, ingest agent                                                            | 15 min        | 45 min        | Claude builds from DESIGN.md, I verify critical paths |
| Test      | Run hand-worked cases, verify overlap logic                                                                    | 10 min        | 10 min        | Tracer bullets on temporal.ts                         |
| **Total** |                                                                                                                | **~1h 45min** | **~2h 25min** |                                                       |

## Where the time went

- **Research + design: ~75 min** — Intentional. The spec says the design write-up matters most. Understanding Hermanus's event landscape (small town, sparse digital data, Facebook-dominant, Quicket for ticketing) shaped every decision.
- **Build: ~30 min personal** — Claude built from the plan. My time was verifying temporal overlap logic and spot-checking agent extraction output against actual source pages.
- **The temporal model took the most thought.** Four event shapes in one queryable model is the core design problem. I worked this out on paper before writing any code.
