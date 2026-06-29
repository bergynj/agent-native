import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import {
  parseAlertEmails,
  type EmailInput,
  type JobCandidate,
} from "../server/lib/email-parser.js";
import { insertDedupJob } from "../server/lib/jobs.js";

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
    "Ingest LinkedIn/Seek job-alert emails into the shortlist. Parses raw emails (subject/from/snippet/body) into candidate metadata, dedups by jobIdHash, and inserts new roles with status=new. Accepts an optional pre-parsed `roles` array (merged with parsed emails) for cases where the agent has already extracted roles via call-agent. Returns the inserted and skipped lists.",
  schema: z.object({
    emails: z
      .array(EmailSchema)
      .optional()
      .describe("Raw alert emails to parse"),
    roles: z
      .array(CandidateSchema)
      .optional()
      .describe("Pre-parsed job candidates to merge"),
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

    const inserted: Array<{ id: string; title: string; company: string }> = [];
    const skipped: Array<{ title: string; company: string }> = [];
    for (const c of candidates) {
      const res = await insertDedupJob(ownerEmail, c);
      if (res.inserted) {
        inserted.push({
          id: res.job.id,
          title: res.job.title,
          company: res.job.company,
        });
      } else {
        skipped.push({ title: res.job.title, company: res.job.company });
      }
    }

    return {
      ingested: candidates.length,
      inserted,
      skipped,
      deduped: skipped.length,
    };
  },
});
