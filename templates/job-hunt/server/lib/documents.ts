import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, schema } from "../db/index.js";
import { reinject } from "./pii.js";
import type { JobDocument, DocumentType } from "../../shared/types.js";

function rowToDocument(r: typeof schema.documents.$inferSelect): JobDocument {
  return {
    id: r.id,
    jobId: r.jobId,
    ownerEmail: r.ownerEmail,
    type: r.type as DocumentType,
    content: r.content,
    approved: !!r.approved,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listDocuments(
  ownerEmail: string,
  jobId: string,
): Promise<JobDocument[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.jobId, jobId),
        eq(schema.documents.ownerEmail, ownerEmail),
      ),
    );
  return rows.map(rowToDocument);
}

export async function getDocument(
  ownerEmail: string,
  jobId: string,
  type: DocumentType,
): Promise<JobDocument | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.jobId, jobId),
        eq(schema.documents.ownerEmail, ownerEmail),
        eq(schema.documents.type, type),
      ),
    )
    .limit(1);
  return rows[0] ? rowToDocument(rows[0]) : null;
}

/**
 * Persist a drafted document. The agent produces drafts from scrubbed context,
 * so `content` may contain ⟦TOKEN⟧ entries. We re-inject real PII locally
 * before storing — this is the only place re-injection happens, keeping real
 * values out of the LLM and in the stored document.
 */
export async function upsertDocument(
  ownerEmail: string,
  jobId: string,
  type: DocumentType,
  content: string,
  approved = false,
): Promise<JobDocument> {
  const db = getDb();
  const now = Date.now();
  const reinserted = await reinject(content, ownerEmail);
  const existing = await getDocument(ownerEmail, jobId, type);
  if (existing) {
    await db
      .update(schema.documents)
      .set({ content: reinserted, approved: approved ? 1 : 0, updatedAt: now })
      .where(eq(schema.documents.id, existing.id));
    return { ...existing, content: reinserted, approved, updatedAt: now };
  }
  const id = nanoid(12);
  const row = {
    id,
    jobId,
    ownerEmail,
    type,
    content: reinserted,
    approved: approved ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.documents).values(row);
  return rowToDocument(row);
}

export async function setDocumentsApproved(
  ownerEmail: string,
  jobId: string,
  approved: boolean,
): Promise<void> {
  const db = getDb();
  await db
    .update(schema.documents)
    .set({ approved: approved ? 1 : 0, updatedAt: Date.now() })
    .where(
      and(
        eq(schema.documents.jobId, jobId),
        eq(schema.documents.ownerEmail, ownerEmail),
      ),
    );
}
