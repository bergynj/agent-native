import { completeText } from "@agent-native/core/server";
import { getJob, setJobStatus } from "./jobs.js";
import { getResearch, upsertResearch } from "./research.js";
import { listDocuments, setDocumentsApproved } from "./documents.js";
import { scrub, scrubAndGuard } from "./pii.js";
import { getResumeForLlm } from "./master-resume.js";
import type { Job, JobResearch, JobDocument } from "../../shared/types.js";

function jdText(job: Job): string | null {
  return job.jdFull ?? job.jdSnippet ?? null;
}

/** Extract ATS keywords from the JD vs the master resume (scrubbed). */
export async function runAtsAnalysis(
  ownerEmail: string,
  jobId: string,
): Promise<{ keywords: string[]; rationale: string }> {
  const job = await getJob(ownerEmail, jobId);
  if (!job) throw new Error("job not found");
  const jd = jdText(job);
  if (!jd) throw new Error("no job description available");

  const resume = await getResumeForLlm(ownerEmail);
  if (!resume) throw new Error("no master resume uploaded");

  const scrubbedJd = await scrub(jd, ownerEmail);
  const scrubbedResume = await scrub(resume, ownerEmail);

  const result = await completeText({
    appId: "job-hunt",
    systemPrompt:
      'You are an ATS keyword analyst. Given a job description and a resume, extract the most important ATS keywords present in the JD, and flag which are missing from the resume. Respond with STRICT JSON only: {"keywords": string[], "missing": string[], "rationale": string}.',
    input: `JOB DESCRIPTION:\n${scrubbedJd}\n\nRESUME:\n${scrubbedResume}\n\nReturn JSON: {\"keywords\": [...], \"missing\": [...], \"rationale\": \"...\"}`,
    temperature: 0.2,
    maxOutputTokens: 800,
  });

  const text = result.text.trim();
  const match = text.match(/\{[\s\S]*\}/);
  let keywords: string[] = [];
  let rationale = "ATS analysis complete.";
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as {
        keywords?: string[];
        missing?: string[];
        rationale?: string;
      };
      keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
      rationale = parsed.rationale ?? rationale;
    } catch {
      // keep defaults
    }
  }

  const existing = await getResearch(ownerEmail, jobId);
  await upsertResearch(ownerEmail, jobId, {
    atsKeywords: keywords,
    companyBackground: existing?.companyBackground ?? null,
    roleNotes: existing?.roleNotes
      ? `${existing.roleNotes}\n\nATS rationale: ${rationale}`
      : `ATS rationale: ${rationale}`,
  });

  await setJobStatus(ownerEmail, jobId, "researched");
  return { keywords, rationale };
}

export interface JobContext {
  job: Job;
  jd: string;
  resume: string | null;
  research: JobResearch | null;
}

/**
 * Return scrubbed job context for the agent to draft from. The JD is scrubbed
 * (fail-closed) and the resume header is already Tier-1 tokenized, so nothing
 * returned here contains real PII. The agent drafts using this context; the
 * draft actions re-inject real PII when persisting.
 */
export async function getJobContext(
  ownerEmail: string,
  jobId: string,
): Promise<JobContext> {
  const job = await getJob(ownerEmail, jobId);
  if (!job) throw new Error("job not found");
  const jd = jdText(job) ?? "";
  const jdScrubbed = await scrubAndGuard(jd, ownerEmail);
  const resume = await getResumeForLlm(ownerEmail);
  const research = await getResearch(ownerEmail, jobId);
  return { job, jd: jdScrubbed, resume, research };
}

/** Mark a job drafted once both documents exist. */
export async function finalizeDocuments(
  ownerEmail: string,
  jobId: string,
): Promise<{ documents: JobDocument[] }> {
  const docs = await listDocuments(ownerEmail, jobId);
  const hasCover = docs.some((d) => d.type === "cover_letter");
  const hasDiff = docs.some((d) => d.type === "resume_diff");
  if (!hasCover || !hasDiff) {
    throw new Error(
      `Cannot finalize: missing ${!hasCover ? "cover_letter" : ""}${
        !hasCover && !hasDiff ? " and " : ""
      }${!hasDiff ? "resume_diff" : ""}`,
    );
  }
  await setJobStatus(ownerEmail, jobId, "drafted");
  await setDocumentsApproved(ownerEmail, jobId, false);
  return { documents: docs };
}
