import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { runAtsAnalysis } from "../server/lib/module2.js";

export default defineAction({
  description:
    "Run ATS keyword analysis for a job: extract the most important ATS keywords from the (scrubbed) JD vs the master resume, flag missing ones, and store them on the job's research row. Sets job status to researched.",
  schema: z.object({ jobId: z.string() }),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    const res = await runAtsAnalysis(ownerEmail, args.jobId);
    return res;
  },
});
