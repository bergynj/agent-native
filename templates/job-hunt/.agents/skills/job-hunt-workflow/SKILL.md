---
name: job-hunt-workflow
---

# Job Hunt workflow

Two agent flows in one app. Read this before changing Module 1 or Module 2.

## Module 1 — Searching (daily)

`jobs/daily-job-search.md` is the recurring job (cron `0 7 * * *`). Its body is
a prompt the agent runs each morning:

1. `call-agent` → mail for today's LinkedIn/Seek alert emails (bounded list:
   subject, sender, date, snippet, message id).
2. `run-daily-search({ emails })` — parse → dedup-insert → fetch full JD
   (snippet fallback) → score vs master resume → refresh
   `context/job-shortlist.md` → auto-run ATS for `matchScore > 80`.
3. For each returned `autoEligible` job, do Module 2 drafting in the same run.

`run-daily-search` is also callable on demand from the board ("Run today's
search") or chat.

## Module 2 — Assisted apply (auto for >80%, else on demand)

Per job:

1. `run-ats-analysis({ jobId })` — server-side ATS keywords (completeText,
   scrubbed). Sets status `researched`.
2. `run-role-research({ jobId, companyBackground, roleNotes })` — store
   findings you gathered via `provider-api-request` / public fetch.
3. `get-job-context({ jobId })` — returns scrubbed JD + Tier-1-tokenized
   resume + research. **Draft using only this.** Preserve ⟦TOKEN⟧ verbatim.
4. `draft-cover-letter({ jobId, content })` and `draft-resume-diff({ jobId,
   content })` — re-inject real PII locally before storing.
5. `finalize-documents({ jobId })` — assert both docs exist; status `drafted`.

Human gate: `approve-documents` (drafted→ready), `mark-submitted`
(ready→submitted). **No auto-apply action exists.**

## PII boundary

- Tier 1: master resume Header is uploaded pre-tokenized. Real values live in
  the local PII vault (`manage-pii-tokens`), never in the resume, never sent to
  the LLM.
- Tier 2: `scrub()` runs on every payload entering agent context (JD, fetched
  text). `reinject()` runs only when documents are persisted
  (`upsertDocument`). `assertNoRawPii` fail-closes outbound context.
- Employer names, job titles, and dates are NOT masked.

## Data

DB is truth (`jobs`, `research`, `documents`, `pii_token_map`,
`master_resume`). `context/job-shortlist.md` is a rendered mirror only. Brain
is not used.
