import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { getJob, updateJob } from "../server/lib/jobs.js";
import { scoreMatch } from "../server/lib/match-score.js";

export default defineAction({
  description:
    "Score a shortlisted role against the master resume (0-100). Uses a scrubbed JD + the Tier-1-tokenized resume so no PII reaches the model. Stores matchScore on the job. The shortlist is ordered by matchScore descending.",
  schema: z.object({
    jobId: z.string().describe("Job id to score"),
  }),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    const job = await getJob(ownerEmail, args.jobId);
    if (!job) throw new Error("job not found");
    const jd = job.jdFull ?? job.jdSnippet ?? "";
    if (!jd) {
      return { jobId: args.jobId, score: 0, rationale: "No JD to score." };
    }
    const { score, rationale } = await scoreMatch(ownerEmail, jd);
    await updateJob(ownerEmail, args.jobId, { matchScore: score });
    return { jobId: args.jobId, score, rationale };
  },
});
