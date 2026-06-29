/**
 * Pure job-id hashing — extracted so dedup can be unit-tested without a DB.
 */
import { createHash } from "node:crypto";
import type { JobSource } from "../../shared/types.js";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function computeJobIdHash(
  source: JobSource,
  externalId?: string | null,
  title?: string,
  company?: string,
  jobUrl?: string | null,
): string {
  const base =
    externalId ||
    `${normalize(title || "")}|${normalize(company || "")}|${jobUrl || ""}` ||
    `${normalize(title || "")}|${normalize(company || "")}`;
  return createHash("sha1")
    .update(`${source}:${base}`)
    .digest("hex")
    .slice(0, 24);
}
