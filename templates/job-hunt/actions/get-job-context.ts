import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { getJobContext } from "../server/lib/module2.js";

export default defineAction({
  description:
    "Get the scrubbed context needed to draft a cover letter and resume diff for a job: the job metadata, the JD (PII-scrubbed, fail-closed), the Tier-1-tokenized master resume, and any stored research. Nothing returned here contains real PII. Draft using this context, preserving any ⟦TOKEN⟧ entries verbatim, then save via draft-cover-letter and draft-resume-diff (those re-inject your real PII locally before storing).",
  schema: z.object({ jobId: z.string() }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    return await getJobContext(ownerEmail, args.jobId);
  },
});
