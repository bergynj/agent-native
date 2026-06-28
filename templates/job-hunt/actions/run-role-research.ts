import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { getResearch, upsertResearch } from "../server/lib/research.js";

export default defineAction({
  description:
    "Store company + role research for a job. Gather the research yourself first (use provider-api-request or fetch the company's public site via call-agent), then pass the findings here as companyBackground and roleNotes. Research text is about the company, not the user, so no PII re-injection is needed.",
  schema: z.object({
    jobId: z.string(),
    companyBackground: z
      .string()
      .optional()
      .describe("Short company background summary"),
    roleNotes: z
      .string()
      .optional()
      .describe("Role-specific notes: team, seniority, stack, highlights"),
  }),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    const existing = await getResearch(ownerEmail, args.jobId);
    const research = await upsertResearch(ownerEmail, args.jobId, {
      atsKeywords: existing?.atsKeywords ?? [],
      companyBackground:
        args.companyBackground ?? existing?.companyBackground ?? null,
      roleNotes: args.roleNotes ?? existing?.roleNotes ?? null,
    });
    return { research };
  },
});
