import { table, text, integer } from "@agent-native/core/db/schema";

/**
 * job-hunt data model.
 *
 * DB is the system of record. `context/job-shortlist.md` is a rendered mirror
 * only (regenerated after each daily run). Brain is not used — it is cited
 * company-internal knowledge, not personal operational state.
 *
 * All tables are owner-scoped via `ownerEmail` (mail-template pattern) so the
 * framework's per-user SQL scoping and the action request context keep reads
 * and writes private to the authenticated user.
 */

export const jobs = table("job_hunt_jobs", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  source: text("source", { enum: ["linkedin", "seek"] }).notNull(),
  applyType: text("apply_type", {
    enum: ["easy_apply", "quick_apply", "standard"],
  })
    .notNull()
    .default("standard"),
  title: text("title").notNull(),
  company: text("company").notNull(),
  jobUrl: text("job_url"),
  jobIdHash: text("job_id_hash").notNull(),
  externalId: text("external_id"),
  jdSnippet: text("jd_snippet"),
  jdFull: text("jd_full"),
  fetchStatus: text("fetch_status", { enum: ["ok", "snippet", "failed"] })
    .notNull()
    .default("snippet"),
  matchScore: integer("match_score"),
  status: text("status", {
    enum: ["new", "researched", "drafted", "ready", "submitted", "archived"],
  })
    .notNull()
    .default("new"),
  alertEmailId: text("alert_email_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const research = table("job_hunt_research", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  atsKeywords: text("ats_keywords"), // JSON array of strings
  companyBackground: text("company_background"),
  roleNotes: text("role_notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const documents = table("job_hunt_documents", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  type: text("type", { enum: ["cover_letter", "resume_diff"] }).notNull(),
  content: text("content").notNull(), // re-injected with real PII
  approved: integer("approved").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const piiTokenMap = table("job_hunt_pii_token_map", {
  id: text("id").primaryKey(), // token itself, e.g. "⟦NAME⟧"
  ownerEmail: text("owner_email").notNull(),
  token: text("token").notNull(),
  realValue: text("real_value").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const masterResume = table("job_hunt_master_resume", {
  id: text("id").primaryKey(), // ownerEmail
  ownerEmail: text("owner_email").notNull(),
  header: text("header"), // Tier-1: pre-tokenized by the user
  pvp: text("pvp"),
  coreCompetencies: text("core_competencies"),
  skills: text("skills"),
  experience: text("experience"),
  updatedAt: integer("updated_at").notNull(),
});
