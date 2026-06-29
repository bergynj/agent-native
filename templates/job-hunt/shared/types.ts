/**
 * Shared types for job-hunt (imported from both server and app via
 * `@shared/types`). Keep provider-agnostic and framework-agnostic.
 */

export type JobSource = "linkedin" | "seek";

export type ApplyType = "easy_apply" | "quick_apply" | "standard";

export type JdFetchStatus = "ok" | "snippet" | "failed";

export type JobStatus =
  | "new"
  | "researched"
  | "drafted"
  | "ready"
  | "submitted"
  | "archived";

export type DocumentType = "cover_letter" | "resume_diff";

export interface Job {
  id: string;
  ownerEmail: string;
  orgId?: string | null;
  source: JobSource;
  applyType: ApplyType;
  title: string;
  company: string;
  jobUrl?: string | null;
  jobIdHash: string;
  externalId?: string | null;
  jdSnippet?: string | null;
  jdFull?: string | null;
  fetchStatus: JdFetchStatus;
  matchScore?: number | null;
  status: JobStatus;
  alertEmailId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface JobResearch {
  id: string;
  jobId: string;
  ownerEmail: string;
  atsKeywords: string[];
  companyBackground?: string | null;
  roleNotes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface JobDocument {
  id: string;
  jobId: string;
  ownerEmail: string;
  type: DocumentType;
  content: string;
  approved: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MasterResume {
  id: string;
  ownerEmail: string;
  header?: string | null;
  pvp?: string | null;
  coreCompetencies?: string | null;
  skills?: string | null;
  experience?: string | null;
  updatedAt: number;
}

export interface PiiToken {
  id: string;
  ownerEmail: string;
  token: string;
  realValue: string;
  createdAt: number;
}

/** Match gate: Module 2 auto-runs only above this threshold. */
export const MATCH_AUTO_THRESHOLD = 80;

export const APPLY_TYPE_LABELS: Record<ApplyType, string> = {
  easy_apply: "Easy Apply",
  quick_apply: "Quick Apply",
  standard: "Standard",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  new: "New",
  researched: "Researched",
  drafted: "Drafted",
  ready: "Ready",
  submitted: "Submitted",
  archived: "Archived",
};
