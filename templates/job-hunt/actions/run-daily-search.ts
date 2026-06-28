import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import {
  parseAlertEmails,
  type EmailInput,
  type JobCandidate,
} from "../server/lib/email-parser.js";
import {
  insertDedupJob,
  updateJob,
  type JobPatch,
} from "../server/lib/jobs.js";
import { getJob } from "../server/lib/jobs.js";
import { fetchFullJd } from "../server/lib/jd-fetch.js";
import { scoreMatch } from "../server/lib/match-score.js";
import { refreshShortlistMirror } from "../server/lib/shortlist-mirror.js";
import { runAtsAnalysis } from "../server/lib/module2.js";
import { MATCH_AUTO_THRESHOLD, type Job } from "@shared/types.js";

const EmailSchema = z.object({
  messageId: z.string().optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
  snippet: z.string().optional(),
  body: z.string().optional(),
  date: z.string().optional(),
});

const CandidateSchema = z.object({
  source: z.enum(["linkedin", "seek"]),
  applyType: z
    .enum(["easy_apply", "quick_apply", "standard"])
    .optional()
    .default("standard"),
  title: z.string(),
  company: z.string(),
  jobUrl: z.string().optional(),
  externalId: z.string().optional(),
  snippet: z.string().optional(),
  alertEmailId: z.string().optional(),
});

export default defineAction({
  description:
    "Run the daily Module 1 search end-to-end: parse alert emails (+ optional pre-parsed roles), dedup-insert new jobs, hydrate full JDs (snippet fallback), score each against the master resume, refresh the shortlist mirror, and auto-run ATS analysis for roles above the match threshold. Returns the new jobs and the auto-eligible (>80%) list — the agent then drafts cover letters + resume diffs for those. Fetch the emails first via call-agent to mail, then pass them here.",
  schema: z.object({
    emails: z.array(EmailSchema).optional(),
    roles: z.array(CandidateSchema).optional(),
    fetchJd: z.boolean().optional().default(true),
    score: z.boolean().optional().default(true),
    autoAts: z.boolean().optional().default(true),
  }),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");

    const candidates: JobCandidate[] = [];
    if (args.emails?.length) candidates.push(...parseAlertEmails(args.emails));
    if (args.roles?.length) {
      for (const r of args.roles) {
        candidates.push({
          source: r.source,
          applyType: r.applyType ?? "standard",
          title: r.title,
          company: r.company,
          jobUrl: r.jobUrl,
          externalId: r.externalId,
          snippet: r.snippet ?? "",
          alertEmailId: r.alertEmailId,
        });
      }
    }

    const newJobs: Job[] = [];
    const errors: Array<{ jobId: string; step: string; error: string }> = [];

    // 1. Dedup insert.
    const insertedIds: string[] = [];
    let skipped = 0;
    for (const c of candidates) {
      const res = await insertDedupJob(ownerEmail, c);
      if (res.inserted) {
        newJobs.push(res.job);
        insertedIds.push(res.job.id);
      } else {
        skipped++;
      }
    }

    // 2. Hydrate full JD + 3. score, per new job.
    for (const job of newJobs) {
      let jd = job.jdFull ?? job.jdSnippet ?? "";
      if (args.fetchJd && job.jobUrl) {
        try {
          const fetched = await fetchFullJd(job.jobUrl, job.jdSnippet);
          const patch: JobPatch = { fetchStatus: fetched.status };
          if (fetched.text) {
            patch.jdFull = fetched.text;
            jd = fetched.text;
          }
          await updateJob(ownerEmail, job.id, patch);
        } catch (err) {
          errors.push({
            jobId: job.id,
            step: "fetch-jd",
            error: err instanceof Error ? err.message : "fetch failed",
          });
        }
      }
      if (args.score && jd) {
        try {
          const { score, rationale } = await scoreMatch(ownerEmail, jd);
          await updateJob(ownerEmail, job.id, { matchScore: score });
          job.matchScore = score;
          // Stash rationale on the in-memory job for the summary.
          (job as Job & { matchRationale?: string }).matchRationale = rationale;
        } catch (err) {
          errors.push({
            jobId: job.id,
            step: "score",
            error: err instanceof Error ? err.message : "scoring failed",
          });
        }
      }
    }

    // 4. Refresh the shortlist mirror.
    let mirror: { path: string; count: number } | null = null;
    try {
      mirror = await refreshShortlistMirror(ownerEmail);
    } catch (err) {
      errors.push({
        jobId: "-",
        step: "mirror",
        error: err instanceof Error ? err.message : "mirror failed",
      });
    }

    // 5. Auto-run ATS analysis for > threshold.
    const autoEligible: Job[] = [];
    if (args.autoAts) {
      for (const job of newJobs) {
        if ((job.matchScore ?? 0) > MATCH_AUTO_THRESHOLD) {
          autoEligible.push(job);
          try {
            await runAtsAnalysis(ownerEmail, job.id);
          } catch (err) {
            errors.push({
              jobId: job.id,
              step: "ats",
              error: err instanceof Error ? err.message : "ats failed",
            });
          }
        }
      }
    }

    return {
      ingested: candidates.length,
      newCount: newJobs.length,
      skipped,
      autoEligible: autoEligible.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        matchScore: j.matchScore,
        applyType: j.applyType,
        source: j.source,
      })),
      autoThreshold: MATCH_AUTO_THRESHOLD,
      mirror,
      errors,
    };
  },
});
