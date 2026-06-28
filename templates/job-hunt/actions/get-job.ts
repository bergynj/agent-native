import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { getJob } from "../server/lib/jobs.js";
import { getResearch } from "../server/lib/research.js";
import { listDocuments } from "../server/lib/documents.js";

export default defineAction({
  description:
    "Get a single job with its research and documents. Use this on the job detail view.",
  schema: z.object({ jobId: z.string() }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    const job = await getJob(ownerEmail, args.jobId);
    if (!job) throw new Error("job not found");
    const [research, documents] = await Promise.all([
      getResearch(ownerEmail, args.jobId),
      listDocuments(ownerEmail, args.jobId),
    ]);
    return { job, research, documents };
  },
});
