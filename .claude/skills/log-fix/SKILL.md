---
name: log-fix
description: Capture a fix to the knowledge base after solving a problem, or search past fixes. Use after debugging sessions to record what went wrong, why, and how it was fixed.
user-invocable: true
argument-hint: "[search <query>] or no args to log current fix"
allowed-tools: [Read, Write, Glob, Grep, Edit]
---

# Log Fix — Fixes Knowledge Base

Record solutions to problems so future conversations can reference them instead of re-solving from scratch.

The knowledge base lives at `tasks/fixes/`. Each fix is a separate Markdown file with an entry in `tasks/fixes/INDEX.md`.

This complements `tasks/lessons.md` — lessons capture recurring **patterns** to watch for; fixes capture specific **bugs** and their solutions.

---

## Mode: Search

**Trigger:** Argument starts with "search" (e.g., `/project:log-fix search temporal overlap`).

1. Extract the search query (everything after "search").
2. Search in two passes:
   a. **Grep `tasks/fixes/INDEX.md`** for matching tags or titles.
   b. **Grep all `tasks/fixes/*.md` files** for the query (catches error messages in fix bodies).
3. Also search `tasks/lessons.md` for related patterns.
4. For each match, read the file and present a concise summary:
   - Title, date, tags
   - The Problem section (abbreviated)
   - The Solution section (abbreviated)
5. If no matches found, say so and suggest broadening search terms.

---

## Mode: Log Fix

**Trigger:** No argument, or argument that doesn't start with "search".

### Step 1: Gather Context

Look at the current conversation to identify:
- What error or problem was encountered
- What the root cause turned out to be
- What files were changed to fix it
- Why those changes work

If the conversation doesn't have enough context, ask the user to describe the problem and fix.

### Step 2: Determine the Filename

1. Glob for `tasks/fixes/YYYY-MM-DD-*.md` using today's date.
2. If none exist, use `001`. Otherwise increment the highest existing sequence number.
3. Filename: `YYYY-MM-DD-NNN.md` (e.g., `2026-07-24-001.md`).

### Step 3: Create the Fix File

Write the file at `tasks/fixes/YYYY-MM-DD-NNN.md` using this template:

```markdown
---
title: "<concise title, under 80 chars>"
date: YYYY-MM-DD
tags: [<lowercase, hyphenated, comma-separated>]
severity: <low|medium|high|critical>
area: <relevant project area — e.g., temporal, api, ingest, dedup, review>
---

# <same title>

## Problem

**Error/Symptom:**
```
<exact error message or description of what went wrong>
```

<1-3 sentences describing the observable problem>

## Root Cause

<What actually caused it. Be specific — mention the exact code path, wrong assumption, or misconfiguration.>

## Solution

**What changed:**
<List the specific changes made, with file paths>

**Why this works:**
<Brief explanation of why this fix addresses the root cause>

## Affected Files

- <bulleted list of files that were modified>

## Related

<Links to docs, related fixes, or lessons.md entries. Optional — omit section if nothing relevant.>
```

### Step 4: Update the Index

1. Check if `tasks/fixes/INDEX.md` exists. If not, create it.
2. Add a new row to the end of the table.
3. Update the `last_updated` date in the frontmatter.

### Step 5: Check for Lesson

If this fix reveals a **recurring pattern** (not just a one-off bug), also add it to `tasks/lessons.md`.

### Step 6: Confirm

Tell the user the fix was saved, show the file path, title, and tags. Note if a lesson was also added.

---

## Rules

- Keep titles under 80 characters.
- Tags must be lowercase and hyphenated for multi-word (e.g., `temporal-overlap`, `apify-ingest`).
- Always include at least one technology tag and one symptom/category tag.
- Error messages in the Problem section should be exact — copy from the conversation.
- The Solution section must explain **why** the fix works, not just what changed.
- If `tasks/fixes/` or `INDEX.md` don't exist, create them before adding the entry.
