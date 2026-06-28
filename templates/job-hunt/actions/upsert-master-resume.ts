import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import {
  parseResumeSections,
  validateHeaderTokenization,
} from "../server/lib/resume-parser.js";
import {
  getMasterResume,
  upsertMasterResume,
} from "../server/lib/master-resume.js";

const SectionSchema = z.object({
  header: z.string().optional(),
  pvp: z.string().optional(),
  coreCompetencies: z.string().optional(),
  skills: z.string().optional(),
  experience: z.string().optional(),
});

export default defineAction({
  description:
    "Create or update your master resume, split into five sections (Header, PVP, Core Competencies, Skills, Experience). Accepts either a single `raw` markdown resume (parsed into sections) or explicit per-section strings. The Header MUST be Tier-1 tokenized: real name/email/phone/address/links replaced with ⟦NAME⟧ etc. Real values for those tokens are stored separately via manage-pii-tokens (the local PII vault) and never sent to the LLM.",
  schema: z.object({
    raw: z
      .string()
      .optional()
      .describe(
        "Full markdown/plain-text resume to auto-split into the five sections.",
      ),
    sections: SectionSchema.optional().describe("Explicit per-section content"),
    validateOnly: z
      .boolean()
      .optional()
      .describe("Validate header tokenization without saving (default false)"),
  }),
  http: { method: "POST" },
  publicAgent: { expose: true, readOnly: false, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");

    let sections = args.sections ?? {};
    let unknown: string[] = [];
    if (args.raw) {
      const parsed = parseResumeSections(args.raw);
      sections = {
        header: parsed.header || sections.header,
        pvp: parsed.pvp || sections.pvp,
        coreCompetencies: parsed.coreCompetencies || sections.coreCompetencies,
        skills: parsed.skills || sections.skills,
        experience: parsed.experience || sections.experience,
      };
      unknown = parsed.unknown;
    }

    const header = sections.header ?? "";
    const validation = validateHeaderTokenization(header);
    if (!validation.ok) {
      return {
        ok: false,
        reason: validation.reason,
        tokenCount: validation.tokenCount,
        unknown,
      };
    }
    if (args.validateOnly) {
      return { ok: true, tokenCount: validation.tokenCount, unknown };
    }

    await upsertMasterResume(ownerEmail, sections);
    return {
      ok: true,
      tokenCount: validation.tokenCount,
      unknown,
      saved: true,
    };
  },
});
