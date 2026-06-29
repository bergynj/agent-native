import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { upsertDocument } from "../server/lib/documents.js";

export default defineAction({
  description:
    "Save a drafted cover letter for a job. Draft it from get-job-context (scrubbed) — your drafted content may contain ⟦TOKEN⟧ entries. This action re-injects your real PII locally before storing, so the saved document has your real name/details. Produces one of the two final documents.",
  schema: z.object({
    jobId: z.string(),
    content: z
      .string()
      .describe(
        "Drafted cover letter markdown: a short summary line plus one key highlight per paragraph. Tokens preserved verbatim.",
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
      "cover_letter",
      args.content,
    );
    return { document };
  },
});
