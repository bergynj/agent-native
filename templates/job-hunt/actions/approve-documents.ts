import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { setJobStatus } from "../server/lib/jobs.js";
import {
  setDocumentsApproved,
  listDocuments,
} from "../server/lib/documents.js";

export default defineAction({
  description:
    "Approve a job's drafted package: marks both documents approved and sets job status to ready. This is the human approval gate (drafted -> ready). It does NOT submit or send anything — the user self-submits, then marks the job submitted.",
  schema: z.object({ jobId: z.string() }),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  needsApproval: false,
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    await setDocumentsApproved(ownerEmail, args.jobId, true);
    await setJobStatus(ownerEmail, args.jobId, "ready");
    const documents = await listDocuments(ownerEmail, args.jobId);
    return { jobId: args.jobId, status: "ready", documents };
  },
});
