# Backend Rules

## API Design

- Use consistent naming: plural nouns for collections (`/events`, `/sources`), singular with ID for items (`/events/:id`).
- Use query parameters for filtering, sorting, and pagination (`?from=...&to=...&categories=...&sort=relevance&page=2`).
- Return appropriate HTTP status codes consistently.
- Include pagination metadata in list responses (`total_count`, `page`, `per_page`, `has_more`).
- Every response follows `{ data, meta, errors }` structure. No exceptions.

## Database

- **Indexes**: Add indexes for any field used in `WHERE`, `ORDER BY`, or `JOIN` clauses. Missing indexes cause slow queries that only manifest at scale.
- **Migrations**: Always reversible via Drizzle Kit. Test rollbacks before deploying.
- **Transactions**: Use transactions for multi-table writes (event + version creation, ingest batch + run log).
- **Connection pooling**: Use `@neondatabase/serverless` driver — it handles pooling for serverless environments.
- **Query performance**: Avoid `SELECT *` — select only needed columns. Use Drizzle's typed query builder.

## Security

- **Input validation**: Validate at the API boundary using Zod schemas. Same schemas used for agent extraction.
- **SQL injection**: Use Drizzle ORM query builder exclusively. NEVER concatenate user input into SQL strings.
- **Rate limiting**: Apply to all public endpoints. Stricter on ingest trigger endpoints.
- **Secrets**: Environment variables only. Never in source code or version control.

## Error Handling

- Log errors with context (request ID, source, input parameters) for debugging.
- Never expose internal errors to the client (stack traces, SQL errors, file paths).
- Use the consistent error response shape: `{ code, message, suggestion, retryable }`.
- Distinguish between client errors (4xx) and server errors (5xx).

## Infrastructure

- **Health checks**: `/api/health` checks database connectivity, last ingest per source, total active events.
- **OpenAPI**: `/api/schema` serves the full OpenAPI 3.1 spec. Keep it up to date with every endpoint change.
- **Logging**: Structured logging for agent runs. Include token usage and cost per run.
