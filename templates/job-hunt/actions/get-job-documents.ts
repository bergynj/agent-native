import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { listDocuments } from "../server/lib/documents.js";

export default defineAction({
  description:
    "Get the final documents (cover_letter + resume_diff) for a job, with real PII re-injected.",
  schema: z.object({ jobId: z.string() }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    const documents = await listDocuments(ownerEmail, args.jobId);
    return { documents };
  },
});
