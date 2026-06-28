import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, schema } from "../db/index.js";
import type { JobResearch } from "../../shared/types.js";

function rowToResearch(r: typeof schema.research.$inferSelect): JobResearch {
  return {
    id: r.id,
    jobId: r.jobId,
    ownerEmail: r.ownerEmail,
    atsKeywords: r.atsKeywords ? JSON.parse(r.atsKeywords) : [],
    companyBackground: r.companyBackground,
    roleNotes: r.roleNotes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function getResearch(
  ownerEmail: string,
  jobId: string,
): Promise<JobResearch | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.research)
    .where(
      and(
        eq(schema.research.jobId, jobId),
        eq(schema.research.ownerEmail, ownerEmail),
      ),
    )
    .limit(1);
  return rows[0] ? rowToResearch(rows[0]) : null;
}

export interface ResearchPatch {
  atsKeywords?: string[];
  companyBackground?: string | null;
  roleNotes?: string | null;
}

export async function upsertResearch(
  ownerEmail: string,
  jobId: string,
  patch: ResearchPatch,
): Promise<JobResearch> {
  const db = getDb();
  const now = Date.now();
  const existing = await getResearch(ownerEmail, jobId);
  if (existing) {
    const set: Record<string, unknown> = { updatedAt: now };
    if (patch.atsKeywords !== undefined)
      set.atsKeywords = JSON.stringify(patch.atsKeywords);
    if (patch.companyBackground !== undefined)
      set.companyBackground = patch.companyBackground;
    if (patch.roleNotes !== undefined) set.roleNotes = patch.roleNotes;
    await db
      .update(schema.research)
      .set(set)
      .where(eq(schema.research.id, existing.id));
    return { ...existing, ...patch, updatedAt: now };
  }
  const id = nanoid(12);
  const row = {
    id,
    jobId,
    ownerEmail,
    atsKeywords: patch.atsKeywords ? JSON.stringify(patch.atsKeywords) : null,
    companyBackground: patch.companyBackground ?? null,
    roleNotes: patch.roleNotes ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.research).values(row);
  return rowToResearch(row);
}
