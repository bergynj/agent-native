import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { listJobs } from "../server/lib/jobs.js";

export default defineAction({
  description:
    "List shortlisted jobs, ordered by matchScore descending then newest first. Filter by status, applyType, or source. Use status=auto_eligible to get new roles above the 80% match threshold (candidates for Module 2).",
  schema: z.object({
    status: z
      .enum([
        "new",
        "researched",
        "drafted",
        "ready",
        "submitted",
        "archived",
        "auto_eligible",
      ])
      .optional()
      .describe("Filter by status (auto_eligible = new AND matchScore>80)"),
    applyType: z.enum(["easy_apply", "quick_apply", "standard"]).optional(),
    source: z.enum(["linkedin", "seek"]).optional(),
    limit: z.coerce.number().optional().describe("Max rows (default 200)"),
  }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    const jobs = await listJobs(ownerEmail, {
      status: args.status,
      applyType: args.applyType,
      source: args.source,
      limit: args.limit,
    });
    return { jobs };
  },
});
