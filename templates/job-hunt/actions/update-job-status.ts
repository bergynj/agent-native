import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { setJobStatus } from "../server/lib/jobs.js";

export default defineAction({
  description:
    "Update a job's status manually (e.g. archive a stale or closed role). Valid statuses: new, researched, drafted, ready, submitted, archived. Prefer the dedicated approve-documents and mark-submitted actions for those transitions.",
  schema: z.object({
    jobId: z.string(),
    status: z.enum([
      "new",
      "researched",
      "drafted",
      "ready",
      "submitted",
      "archived",
    ]),
  }),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    await setJobStatus(ownerEmail, args.jobId, args.status);
    return { jobId: args.jobId, status: args.status };
  },
});
