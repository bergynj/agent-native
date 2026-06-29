import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { getJob, updateJob } from "../server/lib/jobs.js";
import { fetchFullJd } from "../server/lib/jd-fetch.js";

export default defineAction({
  description:
    "Fetch the full job description for a shortlisted role from its public job URL (SSRF-guarded) and store it. Falls back to the email snippet when the URL is missing, the fetch fails, or the page is auth-gated (LinkedIn Easy Apply). Sets fetchStatus to ok | snippet | failed.",
  schema: z.object({
    jobId: z.string().describe("Job id to hydrate"),
    url: z
      .string()
      .optional()
      .describe("Override URL (defaults to the job's stored jobUrl)"),
  }),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    const job = await getJob(ownerEmail, args.jobId);
    if (!job) throw new Error("job not found");
    const url = args.url ?? job.jobUrl ?? undefined;
    const result = await fetchFullJd(url, job.jdSnippet);
    await updateJob(ownerEmail, args.jobId, {
      jdFull: result.text,
      fetchStatus: result.status,
    });
    return {
      jobId: args.jobId,
      fetchStatus: result.status,
      reason: result.reason,
      length: result.text.length,
    };
  },
});
