import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { getMasterResume } from "../server/lib/master-resume.js";

export default defineAction({
  description:
    "Read your master resume sections (Header is tokenized — safe to display). Returns null if no resume has been uploaded.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async () => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    const resume = await getMasterResume(ownerEmail);
    return { resume };
  },
});
