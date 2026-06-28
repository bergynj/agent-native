# Job Hunt

AI-assisted job hunting. Two agent flows in one app:

1. **Searching agent** — a daily recurring job (`jobs/daily-job-search.md`)
   shortlists LinkedIn/Seek roles from the Mail app over A2A, dedups by
   `jobIdHash`, hydrates the full JD, scores match vs the master resume, and
   refreshes a `context/job-shortlist.md` mirror. Roles with `matchScore > 80`
   auto-proceed to Module 2.
2. **Assisted-apply agent** — ATS keyword analysis, company/role research, a
   tailored cover letter, and resume-diff proposals (Role headline, PVP, Core
   competencies/skills). Produces exactly two documents per role behind a
   human approval gate. **Never auto-applies.**

## PII

- **Tier 1 (manual, core):** the master resume Header is uploaded pre-tokenized
  (`⟦NAME⟧`, `⟦EMAIL⟧`, `⟦PHONE⟧`, `⟦ADDRESS⟧`, `⟦LINKS⟧`). Employer names,
  job titles, and dates are NOT masked.
- **Tier 2 (safety net):** `server/lib/pii.ts` scrubs email/phone/url + the
  known-name list from the header on every payload entering agent context, and
  re-injects real values when documents are persisted. Fail-closed leak guard.
- The token map is deterministic and per-user (`job_hunt_pii_token_map`).

## Data model

`server/db/schema.ts` — `jobs`, `research`, `documents`, `pii_token_map`,
`master_resume`. DB is the system of record; `context/job-shortlist.md` is a
rendered mirror only. Brain is not used.

Job lifecycle: `new → researched → drafted → ready → submitted → archived`.
Deduped by `(ownerEmail, jobIdHash)`. Auto-archive after 30 days or closed.

## Actions

All ops live in `actions/*.ts` via `defineAction`. The agent and UI share the
same surface (`useActionQuery` / `useActionMutation`). No pass-through API
routes for app data.

## A2A

Email ingest uses `call-agent` with agent `mail` (narrow, bounded prompts).
Public JD/research fetch goes through `ssrfSafeFetch` (fetch-full-jd) or
`provider-api-request` for structured provider APIs.

## Skills

Read the workspace skills in `.agents/skills/` before changing an area:
`adding-a-feature`, `storing-data`, `recurring-jobs`, `delegate-to-agent`,
`composable-mini-apps`, `security`, `shadcn-ui`. The job-hunt-specific workflow
is in `.agents/skills/job-hunt-workflow/SKILL.md`.
