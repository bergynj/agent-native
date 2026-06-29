import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { setJobStatus } from "../server/lib/jobs.js";

export default defineAction({
  description:
    "Mark a job as submitted after the user has self-submitted the application outside the app. Sets status to submitted. The app never submits on the user's behalf.",
  schema: z.object({ jobId: z.string() }),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    await setJobStatus(ownerEmail, args.jobId, "submitted");
    return { jobId: args.jobId, status: "submitted" };
  },
});
