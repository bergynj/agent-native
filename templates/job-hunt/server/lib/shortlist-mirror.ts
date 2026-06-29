import { resourcePut } from "@agent-native/core/resources";
import { listJobs } from "./jobs.js";
import {
  APPLY_TYPE_LABELS,
  JOB_STATUS_LABELS,
  type ApplyType,
  type Job,
} from "../../shared/types.js";

const MIRROR_PATH = "context/job-shortlist.md";

function renderMirror(jobs: Job[]): string {
  // Group by applyType, order easy_apply → quick_apply → standard.
  const order: ApplyType[] = ["easy_apply", "quick_apply", "standard"];
  const byType = new Map<ApplyType, typeof jobs>();
  for (const j of jobs) {
    const arr = byType.get(j.applyType) ?? [];
    arr.push(j);
    byType.set(j.applyType, arr);
  }
  const lines: string[] = [
    "# Job shortlist",
    "",
    "_Auto-generated mirror of the job-hunt DB. The database is the source of truth; this file is a readable view. Do not edit._",
    "",
  ];
  for (const t of order) {
    const arr = byType.get(t);
    if (!arr || arr.length === 0) continue;
    lines.push(`## ${APPLY_TYPE_LABELS[t]} (${arr.length})`);
    lines.push("");
    for (const j of arr) {
      const score = j.matchScore == null ? "—" : `${j.matchScore}%`;
      lines.push(
        `- **${j.title}** — ${j.company} · ${score} · ${JOB_STATUS_LABELS[j.status]} · ${j.source}`,
      );
      if (j.jobUrl) lines.push(`  - ${j.jobUrl}`);
    }
    lines.push("");
  }
  if (lines.length <= 5) {
    lines.push("_No roles shortlisted yet._");
  }
  return lines.join("\n");
}

/** Regenerate the human-readable shortlist mirror at context/job-shortlist.md. */
export async function refreshShortlistMirror(
  ownerEmail: string,
): Promise<{ path: string; count: number }> {
  const jobs = await listJobs(ownerEmail, { limit: 500 });
  const active = jobs.filter((j) => j.status !== "archived");
  const content = renderMirror(active);
  await resourcePut(ownerEmail, MIRROR_PATH, content, "text/markdown");
  return { path: MIRROR_PATH, count: active.length };
}
