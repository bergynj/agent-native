import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { finalizeDocuments } from "../server/lib/module2.js";

export default defineAction({
  description:
    "Finalize a job's application package: verifies both documents (cover_letter + resume_diff) exist, marks them unapproved, and sets the job status to drafted. The job then waits for human approval (drafted -> ready -> submitted). Never auto-applies.",
  schema: z.object({ jobId: z.string() }),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    return await finalizeDocuments(ownerEmail, args.jobId);
  },
});
