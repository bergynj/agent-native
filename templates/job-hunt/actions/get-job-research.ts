import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { getResearch } from "../server/lib/research.js";

export default defineAction({
  description: "Get the ATS keywords + company/role research stored for a job.",
  schema: z.object({ jobId: z.string() }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    const research = await getResearch(ownerEmail, args.jobId);
    return { research };
  },
});
