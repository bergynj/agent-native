import { runMigrations, intType } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      sql: `CREATE TABLE IF NOT EXISTS job_hunt_jobs (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    org_id TEXT,
    source TEXT NOT NULL CHECK(source IN ('linkedin', 'seek')),
    apply_type TEXT NOT NULL DEFAULT 'standard' CHECK(apply_type IN ('easy_apply', 'quick_apply', 'standard')),
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    job_url TEXT,
    job_id_hash TEXT NOT NULL,
    external_id TEXT,
    jd_snippet TEXT,
    jd_full TEXT,
    fetch_status TEXT NOT NULL DEFAULT 'snippet' CHECK(fetch_status IN ('ok', 'snippet', 'failed')),
    match_score ${intType()},
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'researched', 'drafted', 'ready', 'submitted', 'archived')),
    alert_email_id TEXT,
    created_at ${intType()} NOT NULL,
    updated_at ${intType()} NOT NULL
  )`,
    },
    {
      version: 2,
      sql: `CREATE INDEX IF NOT EXISTS idx_job_hunt_jobs_owner_status ON job_hunt_jobs(owner_email, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_hunt_jobs_owner_hash ON job_hunt_jobs(owner_email, job_id_hash)`,
    },
    {
      version: 3,
      sql: `CREATE TABLE IF NOT EXISTS job_hunt_research (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    ats_keywords TEXT,
    company_background TEXT,
    role_notes TEXT,
    created_at ${intType()} NOT NULL,
    updated_at ${intType()} NOT NULL
  )`,
    },
    {
      version: 4,
      sql: `CREATE INDEX IF NOT EXISTS idx_job_hunt_research_job ON job_hunt_research(job_id)`,
    },
    {
      version: 5,
      sql: `CREATE TABLE IF NOT EXISTS job_hunt_documents (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('cover_letter', 'resume_diff')),
    content TEXT NOT NULL,
    approved ${intType()} NOT NULL DEFAULT 0,
    created_at ${intType()} NOT NULL,
    updated_at ${intType()} NOT NULL
  )`,
    },
    {
      version: 6,
      sql: `CREATE INDEX IF NOT EXISTS idx_job_hunt_documents_job ON job_hunt_documents(job_id)`,
    },
    {
      version: 7,
      sql: `CREATE TABLE IF NOT EXISTS job_hunt_pii_token_map (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    token TEXT NOT NULL,
    real_value TEXT NOT NULL,
    created_at ${intType()} NOT NULL
  )`,
    },
    {
      version: 8,
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_job_hunt_pii_token_owner ON job_hunt_pii_token_map(owner_email, token)`,
    },
    {
      version: 9,
      sql: `CREATE TABLE IF NOT EXISTS job_hunt_master_resume (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    header TEXT,
    pvp TEXT,
    core_competencies TEXT,
    skills TEXT,
    experience TEXT,
    updated_at ${intType()} NOT NULL
  )`,
    },
  ],
  { table: "job_hunt_migrations" },
);
