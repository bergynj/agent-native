import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, schema } from "../db/index.js";
import type {
  ApplyType,
  JobSource,
  JobStatus,
  Job,
} from "../../shared/types.js";
import type { JobCandidate } from "./email-parser.js";
import { computeJobIdHash } from "./job-hash.js";

export { computeJobIdHash };

export interface JobInsert extends JobCandidate {
  jdSnippet?: string;
  orgId?: string | null;
}

function rowToJob(r: typeof schema.jobs.$inferSelect): Job {
  return {
    id: r.id,
    ownerEmail: r.ownerEmail,
    orgId: r.orgId,
    source: r.source as JobSource,
    applyType: r.applyType as ApplyType,
    title: r.title,
    company: r.company,
    jobUrl: r.jobUrl,
    jobIdHash: r.jobIdHash,
    externalId: r.externalId,
    jdSnippet: r.jdSnippet,
    jdFull: r.jdFull,
    fetchStatus: r.fetchStatus as Job["fetchStatus"],
    matchScore: r.matchScore,
    status: r.status as JobStatus,
    alertEmailId: r.alertEmailId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Insert a candidate as a new job, deduped by (ownerEmail, jobIdHash). */
export async function insertDedupJob(
  ownerEmail: string,
  candidate: JobInsert,
): Promise<{ inserted: boolean; job: Job }> {
  const db = getDb();
  const jobIdHash = computeJobIdHash(
    candidate.source,
    candidate.externalId,
    candidate.title,
    candidate.company,
    candidate.jobUrl,
  );
  const existing = await db
    .select()
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.ownerEmail, ownerEmail),
        eq(schema.jobs.jobIdHash, jobIdHash),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return { inserted: false, job: rowToJob(existing[0]) };
  }
  const id = nanoid(12);
  const now = Date.now();
  const row = {
    id,
    ownerEmail,
    orgId: candidate.orgId ?? null,
    source: candidate.source,
    applyType: candidate.applyType,
    title: candidate.title,
    company: candidate.company,
    jobUrl: candidate.jobUrl ?? null,
    jobIdHash,
    externalId: candidate.externalId ?? null,
    jdSnippet: candidate.snippet ?? null,
    jdFull: null,
    fetchStatus: "snippet" as const,
    matchScore: null,
    status: "new" as const,
    alertEmailId: candidate.alertEmailId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.jobs).values(row);
  return { inserted: true, job: rowToJob(row) };
}

export interface ListJobsFilter {
  status?: JobStatus | "auto_eligible";
  applyType?: ApplyType;
  source?: JobSource;
  limit?: number;
}

export async function listJobs(
  ownerEmail: string,
  filter?: ListJobsFilter,
): Promise<Job[]> {
  const db = getDb();
  const status = filter?.status;
  const applyType = filter?.applyType;
  const source = filter?.source;
  const isAutoEligible = status === "auto_eligible";
  const statusCond =
    status && status !== "auto_eligible"
      ? eq(schema.jobs.status, status)
      : undefined;
  const conds: SQL[] = [
    eq(schema.jobs.ownerEmail, ownerEmail),
    statusCond,
    applyType ? eq(schema.jobs.applyType, applyType) : undefined,
    source ? eq(schema.jobs.source, source) : undefined,
    isAutoEligible ? sql`${schema.jobs.matchScore} > 80` : undefined,
    isAutoEligible ? eq(schema.jobs.status, "new") : undefined,
  ].filter((c): c is SQL => c !== undefined);

  let q = db.select().from(schema.jobs).$dynamic();
  q = q.where(and(...conds));
  // matchScore desc with nulls last, then newest first.
  q = q.orderBy(
    sql`${schema.jobs.matchScore} IS NULL`,
    desc(schema.jobs.matchScore),
    desc(schema.jobs.createdAt),
  );
  const limit = filter?.limit ?? 200;
  q = q.limit(limit);
  const rows = await q;
  return rows.map(rowToJob);
}

export async function getJob(
  ownerEmail: string,
  jobId: string,
): Promise<Job | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.jobs)
    .where(
      and(eq(schema.jobs.id, jobId), eq(schema.jobs.ownerEmail, ownerEmail)),
    )
    .limit(1);
  return rows[0] ? rowToJob(rows[0]) : null;
}

export interface JobPatch {
  jdFull?: string | null;
  fetchStatus?: "ok" | "snippet" | "failed";
  matchScore?: number | null;
  status?: JobStatus;
}

export async function updateJob(
  ownerEmail: string,
  jobId: string,
  patch: JobPatch,
): Promise<void> {
  const db = getDb();
  const set: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.jdFull !== undefined) set.jdFull = patch.jdFull;
  if (patch.fetchStatus !== undefined) set.fetchStatus = patch.fetchStatus;
  if (patch.matchScore !== undefined) set.matchScore = patch.matchScore;
  if (patch.status !== undefined) set.status = patch.status;
  await db
    .update(schema.jobs)
    .set(set)
    .where(
      and(eq(schema.jobs.id, jobId), eq(schema.jobs.ownerEmail, ownerEmail)),
    );
}

export async function setJobStatus(
  ownerEmail: string,
  jobId: string,
  status: JobStatus,
): Promise<void> {
  await updateJob(ownerEmail, jobId, { status });
}
