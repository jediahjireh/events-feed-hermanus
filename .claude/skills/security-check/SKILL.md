---
name: security-check
description: OWASP Top 10 security audit. Scans for hardcoded secrets, insecure storage, network security, dependency vulnerabilities, and web-specific issues.
user-invocable: true
disable-model-invocation: true
argument-hint: "[--quick | --full] [specific area]"
allowed-tools: [Read, Bash, Grep, Glob]
---

# Security Check — OWASP Top 10 Audit

Security analysis based on OWASP Top 10 (Web), adapted for this Next.js + PostgreSQL project.

## When to Run

- Before any production deployment
- After adding new API endpoints or authentication changes
- After integrating new third-party APIs (SerpAPI, Quicket, etc.)
- Periodically as a hygiene check

## Modes

- `--quick` — Run automated scans only (Steps 1-4). Fast, catches common issues.
- `--full` (default) — Run all steps including manual analysis (Steps 1-7).

---

## Step 1: Hardcoded Secrets Scan

Search across all source directories for:

| Pattern | Description | Severity |
|---------|-------------|----------|
| `sk-ant-*` | Anthropic API keys | CRITICAL |
| `serpapi_key` / long alphanumeric assigned to API key vars | SerpAPI keys | CRITICAL |
| `Bearer ` + token literal | Hardcoded auth tokens | CRITICAL |
| Long alphanumeric strings (32+ chars) assigned to `apiKey`, `secret`, `token`, `password` | Generic secrets | HIGH |
| `.env` values pasted inline in source | Environment variables in code | HIGH |

**Exceptions** (not flagged):
- Values loaded via `process.env.*`
- Files: `.env`, `.env.example`
- Pattern names in comments explaining formats

## Step 2: Insecure Storage

Scan for data storage practices:

- Sensitive data stored in plaintext local storage
- Logging of sensitive data (debug statements with tokens, API keys)
- SQL queries with user input concatenated (not parameterised)

## Step 3: Network Security

Check for:

- HTTP URLs (non-HTTPS) in API calls — **CRITICAL**
- API keys sent in URL query parameters instead of headers
- Missing CORS configuration on API endpoints
- Overly permissive CORS (`*` origins)

## Step 4: Dependency Audit

Run `npm audit` and flag:
- Dependencies with known CVEs
- Severely outdated packages (2+ major versions behind)
- Packages with no recent maintenance (last publish > 1 year)

## Step 5: API Security

Manual review of:

- Input validation on all API endpoints (Zod schemas applied?)
- Rate limiting on public endpoints
- Error messages not leaking internal details (stack traces, SQL errors, file paths)
- Pagination enforced — no unbounded query responses

## Step 6: Web-Specific Security

- Content Security Policy (CSP) headers
- Cross-Site Scripting (XSS) prevention
- SQL injection prevention (parameterised queries via Drizzle)
- CSRF protection for state-changing endpoints
- Secure cookie flags (HttpOnly, Secure, SameSite)
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`

## Step 7: Data Privacy

- Check for PII in analytics or logging
- Verify event data doesn't contain personal information from source scraping
- Review data retention — are old ingestion run logs cleaned up?

---

## Report Format

```
========================================
  SECURITY AUDIT — <date>
========================================

## Summary
- CRITICAL: [N] issues
- HIGH: [N] issues
- MEDIUM: [N] issues
- LOW: [N] issues

## Findings

### CRITICAL — Must fix before release

1. [Finding title]
   File: [path:line]
   Issue: [description]
   Fix: [recommendation]

### HIGH — Should fix before release
...

### MEDIUM — Fix in next sprint
...

### LOW — Improvement opportunity
...

========================================
  VERDICT: PASS | FAIL
  [one-line summary]
========================================
```

## Rules

1. Do NOT fix issues — only report them. This is a diagnostic skill.
2. Exception: if `--fix-critical` is passed, auto-fix CRITICAL issues only.
3. Always run Steps 1-4 (automated). Steps 5-7 require `--full` mode.
4. False positives should be noted but not counted toward the verdict.
5. FAIL if any CRITICAL issue exists. PASS with warnings for HIGH/MEDIUM/LOW only.
