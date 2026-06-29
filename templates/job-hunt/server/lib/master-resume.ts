import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";

export interface ResumeSections {
  header?: string | null;
  pvp?: string | null;
  coreCompetencies?: string | null;
  skills?: string | null;
  experience?: string | null;
}

/** Load the owner's master resume row (tokenized header — safe to read). */
export async function getMasterResume(
  ownerEmail: string,
): Promise<ResumeSections | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.masterResume)
    .where(eq(schema.masterResume.ownerEmail, ownerEmail))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    header: r.header,
    pvp: r.pvp,
    coreCompetencies: r.coreCompetencies,
    skills: r.skills,
    experience: r.experience,
  };
}

/** Upsert the owner's master resume sections. */
export async function upsertMasterResume(
  ownerEmail: string,
  sections: ResumeSections,
): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const existing = await db
    .select({ id: schema.masterResume.id })
    .from(schema.masterResume)
    .where(eq(schema.masterResume.ownerEmail, ownerEmail))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(schema.masterResume)
      .set({
        header: sections.header ?? null,
        pvp: sections.pvp ?? null,
        coreCompetencies: sections.coreCompetencies ?? null,
        skills: sections.skills ?? null,
        experience: sections.experience ?? null,
        updatedAt: now,
      })
      .where(eq(schema.masterResume.id, existing[0].id));
    return;
  }
  await db.insert(schema.masterResume).values({
    id: ownerEmail,
    ownerEmail,
    header: sections.header ?? null,
    pvp: sections.pvp ?? null,
    coreCompetencies: sections.coreCompetencies ?? null,
    skills: sections.skills ?? null,
    experience: sections.experience ?? null,
    updatedAt: now,
  });
}

/**
 * Return the resume as a single tokenized markdown string for LLM context.
 * The header is already tokenized (Tier 1) so this is safe to send to the
 * provider. Employer names, titles, and dates are deliberately kept real.
 */
export async function getResumeForLlm(
  ownerEmail: string,
): Promise<string | null> {
  const r = await getMasterResume(ownerEmail);
  if (!r) return null;
  const parts: string[] = [];
  if (r.header) parts.push(`## Header\n${r.header}`);
  if (r.pvp) parts.push(`## PVP\n${r.pvp}`);
  if (r.coreCompetencies)
    parts.push(`## Core Competencies\n${r.coreCompetencies}`);
  if (r.skills) parts.push(`## Skills\n${r.skills}`);
  if (r.experience) parts.push(`## Experience\n${r.experience}`);
  return parts.join("\n\n") || null;
}
