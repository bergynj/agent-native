import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { upsertDocument } from "../server/lib/documents.js";

export default defineAction({
  description:
    "Save drafted resume updates for a job, in three areas: Role headline, PVP (Professional Value Proposition), and Core competencies/skills — each alignment-scored against the JD. Draft from get-job-context (scrubbed); tokens are re-injected locally before storing. Produces the second of the two final documents.",
  schema: z.object({
    jobId: z.string(),
    content: z
      .string()
      .describe(
        "Drafted resume diff markdown with three sections (Role headline, PVP, Core competencies/skills), each with an alignment note vs the JD.",
      ),
  }),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    const document = await upsertDocument(
      ownerEmail,
      args.jobId,
      "resume_diff",
      args.content,
    );
    return { document };
  },
});
