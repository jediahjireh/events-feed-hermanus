# Skill Quick Reference

## Core Engineering

Skills every project uses regardless of scope.

| Skill              | Command                   | When to Use                                                             |
| ------------------ | ------------------------- | ----------------------------------------------------------------------- |
| **Implement**      | `/project:implement`      | Build a feature, fix, or enhancement from a brief or description        |
| **Verify**         | `/project:verify`         | Audit implementation for correctness, completeness, and rule compliance |
| **Commit Plan**    | `/project:commit-plan`    | Group changes into logical commits with suggested messages              |
| **Log Fix**        | `/project:log-fix`        | Record a fix to the knowledge base, or search past fixes                |
| **Security Check** | `/project:security-check` | OWASP Top 10 security audit                                            |

## Domain-Specific

Skills for the event feed's unique workflows.

| Skill           | Command                  | When to Use                                                              |
| --------------- | ------------------------ | ------------------------------------------------------------------------ |
| **Ingest**      | `/project:ingest`        | Run or build an event ingestion pipeline for a source                    |
| **Review**      | `/project:review`        | Re-verify existing events against their sources (weekly or on-demand)    |
| **Source Eval**  | `/project:source-eval`   | Evaluate a potential new data source for integration                     |

## Deployment

| Skill      | Command             | When to Use                                                              |
| ---------- | ------------------- | ------------------------------------------------------------------------ |
| **Deploy** | `/project:deploy`   | Staging → production deployment workflow                                 |

---

## Common Workflows

### Building a Feature

1. Fill in `tasks/feature-brief.md` with the request
2. Run `/project:implement`
3. Run `/project:verify` after implementation
4. Run `/project:commit-plan` to prepare commits

### Running an Ingestion

1. Run `/project:ingest serpapi` (or `quicket`, `all`, `dry-run`)
2. Check the run report for anomalies
3. Run `/project:review upcoming` to verify new events

### Adding a New Source

1. Run `/project:source-eval <url>` to assess the source
2. If recommended: create the adapter in `src/lib/sources/`
3. Run `/project:ingest <source-name> --dry-run` to test
4. Run `/project:ingest <source-name>` for real

### After Debugging

1. Run `/project:log-fix` to capture the fix
2. Check if `tasks/lessons.md` needs updating

### Before Deploy

1. Run `/project:security-check --quick` for a fast security scan
2. Run `/project:deploy staging` for staging verification
3. Run `/project:deploy production` when ready

## Brief Templates

| Template                  | Used by              | What to fill in                                |
| ------------------------- | -------------------- | ---------------------------------------------- |
| `tasks/feature-brief.md`  | `/project:implement` | What, why, affected area, acceptance criteria  |
