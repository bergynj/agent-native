---
schedule: "0 7 * * *"
enabled: true
runAs: creator
---

# Daily job search

Run the daily job-hunt search and prepare drafts for strong matches.

1. Use `call-agent` with agent "mail" to fetch today's LinkedIn and Seek job
   alert emails. Ask for a bounded list: subject, sender, date, snippet, and
   message id for unread emails from LinkedIn/Seek senders since the last run
   (default: last 24h). Do not paste an entire inbox dump back.
2. Call `run-daily-search` with those emails. It will dedup-insert new roles,
   hydrate full JDs (snippet fallback), score each against the master resume,
   refresh the `context/job-shortlist.md` mirror, and auto-run ATS analysis for
   roles above 80% match.
3. For every job in the returned `autoEligible` list, perform Module 2 drafting:
   - Call `get-job-context` to get the scrubbed JD + tokenized resume + research.
   - Draft a tailored **cover letter** (a short summary line plus one key
     highlight per paragraph) using only the scrubbed context — preserve any
     ⟦TOKEN⟧ entries verbatim, never expand them.
   - Call `draft-cover-letter` with the drafted content (it re-injects your real
     PII locally before storing).
   - Draft **resume updates** in three areas — Role headline, PVP, and Core
     competencies/skills — each alignment-scored against the JD. Preserve tokens.
   - Call `draft-resume-diff` with the drafted content.
   - Call `finalize-documents` to mark the job `drafted`.
4. Do NOT auto-apply. Do NOT call send-email or any apply endpoint. Drafts wait
   for human approval (`drafted → ready → submitted`).
5. Post a short summary: how many new roles, how many auto-eligible, and any
   fetch errors. Run `refresh-shortlist-mirror` if anything changed, then
   `navigate` to the board.

If Mail is unavailable, tell the user to connect Mail; do not guess at emails.
