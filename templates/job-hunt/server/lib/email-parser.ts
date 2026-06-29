/**
 * Parse LinkedIn / Seek job-alert emails into candidate job metadata.
 *
 * Best-effort heuristics over subject + snippet + body. The agent can also
 * pass pre-parsed `roles` to ingest-job-emails if it has already extracted
 * them from the email body via call-agent.
 */

import type { ApplyType, JobSource } from "../../shared/types.js";

export interface EmailInput {
  messageId?: string;
  from?: string;
  subject?: string;
  snippet?: string;
  body?: string;
  date?: string;
}

export interface JobCandidate {
  source: JobSource;
  applyType: ApplyType;
  title: string;
  company: string;
  jobUrl?: string;
  externalId?: string;
  snippet: string;
  alertEmailId?: string;
}

const LINKEDIN_URL_RE =
  /https?:\/\/[^\s"')]*linkedin\.com\/jobs\/view\/[^\s"')]+/i;
const SEEK_URL_RE =
  /https?:\/\/[^\s"')]*seek\.com\.au\/job\/[^\s"')]+|https?:\/\/[^\s"')]*seek\.com\/jobs\/[^\s"')]+/i;

function detectSource(text: string): JobSource | null {
  const t = text.toLowerCase();
  if (/linkedin\.com/.test(t)) return "linkedin";
  if (/seek\.com\.au|seek\.com\/jobs|seekjobs/.test(t)) return "seek";
  return null;
}

function detectApplyType(text: string): ApplyType {
  const t = text.toLowerCase();
  if (/easy\s*apply/.test(t)) return "easy_apply";
  if (/quick\s*apply/.test(t)) return "quick_apply";
  return "standard";
}

function extractUrl(text: string, source: JobSource): string | undefined {
  const re = source === "linkedin" ? LINKEDIN_URL_RE : SEEK_URL_RE;
  const m = text.match(re);
  return m?.[0];
}

function extractExternalId(url: string, source: JobSource): string | undefined {
  if (source === "linkedin") {
    const m = url.match(/\/jobs\/view\/(?:.*?-)?(\d+)/);
    return m?.[1];
  }
  const m = url.match(/\/job\/(\d+)/);
  return m?.[1];
}

/** Best-effort "Title at Company" / "Title - Company" extraction.
 *  Strips trailing metadata (apply-type badges, URLs) after a dash separator. */
function extractTitleCompany(text: string): {
  title: string;
  company: string;
} {
  let firstLine = text.split(/\n/)[0]?.trim() ?? text.trim();
  // Drop " — Easy Apply …" / " - Quick apply …" metadata tails.
  firstLine = firstLine.split(/\s+[–—-]\s+/)[0] ?? firstLine;
  const m = firstLine.match(/^(.+?)\s+(?:at|[-–—]|@)\s+(.+)$/);
  if (m && m[1].length < 120 && m[2].length < 120) {
    return { title: m[1].trim(), company: m[2].trim() };
  }
  return { title: firstLine.slice(0, 160), company: "Unknown" };
}

function cleanSubject(subject: string): string {
  return subject
    .replace(/^re:\s*/i, "")
    .replace(/^fwd:\s*/i, "")
    .replace(/\bjob alert[s]?\b:?\s*/i, "")
    .replace(/\bnew jobs\b.*$/i, "")
    .trim();
}

/**
 * Parse one alert email into a single primary job candidate. Returns null if
 * the email is not recognisable as a LinkedIn/Seek job alert.
 */
export function parseAlertEmail(email: EmailInput): JobCandidate | null {
  const combined = `${email.from ?? ""} ${email.subject ?? ""} ${
    email.snippet ?? ""
  } ${email.body ?? ""}`;
  const source = detectSource(combined);
  if (!source) return null;

  const applyType = detectApplyType(combined);
  const jobUrl = extractUrl(combined, source);
  const externalId = jobUrl ? extractExternalId(jobUrl, source) : undefined;

  const titleCompanyText =
    email.snippet?.trim() || cleanSubject(email.subject ?? "") || combined;
  const { title, company } = extractTitleCompany(titleCompanyText);

  return {
    source,
    applyType,
    title: title || "Untitled role",
    company: company || "Unknown",
    jobUrl,
    externalId,
    snippet: (email.snippet ?? "").slice(0, 1000),
    alertEmailId: email.messageId,
  };
}

export function parseAlertEmails(emails: EmailInput[]): JobCandidate[] {
  const out: JobCandidate[] = [];
  for (const e of emails) {
    const c = parseAlertEmail(e);
    if (c) out.push(c);
  }
  return out;
}
