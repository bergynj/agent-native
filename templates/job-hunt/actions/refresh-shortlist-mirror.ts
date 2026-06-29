import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import { refreshShortlistMirror } from "../server/lib/shortlist-mirror.js";

export default defineAction({
  description:
    "Regenerate the human-readable shortlist mirror at context/job-shortlist.md from the DB. Grouped by applyType (Easy/Quick/Standard), ordered by matchScore descending. The DB is the source of truth; the mirror is a readable view.",
  schema: z.object({}),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async () => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");
    const res = await refreshShortlistMirror(ownerEmail);
    return res;
  },
});
