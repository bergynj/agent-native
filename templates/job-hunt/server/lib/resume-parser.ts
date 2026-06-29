/**
 * Parse a pasted master resume (markdown or plain text) into the five
 * job-hunt sections: Header, PVP, Core Competencies, Skills, Experience.
 *
 * The Header is expected to be pre-tokenized by the user (Tier 1 PII). This
 * module only splits sections; it does not touch PII.
 */

export interface ParsedResume {
  header: string;
  pvp: string;
  coreCompetencies: string;
  skills: string;
  experience: string;
  /** Sections whose heading did not match a known bucket, folded into the
   * most recent matched bucket at parse time. Returned for diagnostics. */
  unknown: string[];
}

type Bucket = "header" | "pvp" | "coreCompetencies" | "skills" | "experience";

const ALIASES: Record<Bucket, string[]> = {
  header: [
    "header",
    "contact",
    "contact info",
    "contact information",
    "personal",
    "personal details",
    "details",
  ],
  pvp: [
    "pvp",
    "professional value proposition",
    "value proposition",
    "summary",
    "professional summary",
    "profile",
    "about",
    "about me",
    "objective",
  ],
  coreCompetencies: [
    "core competencies",
    "competencies",
    "core strengths",
    "key strengths",
    "areas of expertise",
    "expertise",
  ],
  skills: [
    "skills",
    "technical skills",
    "core skills",
    "tools & technologies",
    "tools and technologies",
    "technologies",
    "tech stack",
  ],
  experience: [
    "experience",
    "work experience",
    "employment",
    "employment history",
    "professional experience",
    "career history",
    "career",
    "work history",
  ],
};

function normalizeHeading(raw: string): string {
  return raw
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/[*_`]/g, "")
    .toLowerCase()
    .trim();
}

function matchBucket(heading: string): Bucket | null {
  const h = normalizeHeading(heading);
  for (const bucket of Object.keys(ALIASES) as Bucket[]) {
    if (ALIASES[bucket].includes(h)) return bucket;
  }
  // Partial contains fallback for verbose headings.
  for (const bucket of Object.keys(ALIASES) as Bucket[]) {
    for (const alias of ALIASES[bucket]) {
      if (h.includes(alias)) return bucket;
    }
  }
  return null;
}

interface Heading {
  bucket: Bucket | null;
  title: string;
  start: number;
}

/** Detect markdown ATX (#), Setext (===/--- under a line), or ALLCAPS headings. */
function findHeadings(text: string): Array<{
  title: string;
  bodyStart: number;
  bodyEnd: number;
  bucket: Bucket | null;
  lineIndex: number;
}> {
  const lines = text.split(/\r?\n/);
  const headings: Array<{
    title: string;
    bodyStart: number;
    bucket: Bucket | null;
    lineIndex: number;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const atx = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (atx) {
      headings.push({
        title: atx[2],
        bodyStart: i + 1,
        bucket: matchBucket(atx[2]),
        lineIndex: i,
      });
      continue;
    }
    // Setext: next line is === or ---
    if (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (/^=+\s*$/.test(next) || /^-{2,}\s*$/.test(next)) {
        const title = line.trim();
        if (title) {
          headings.push({
            title,
            bodyStart: i + 2,
            bucket: matchBucket(title),
            lineIndex: i,
          });
        }
      }
    }
  }

  // Compute body ranges.
  return headings.map((h, idx) => {
    const bodyEnd =
      idx + 1 < headings.length ? headings[idx + 1].lineIndex : lines.length;
    return {
      title: h.title,
      bodyStart: h.bodyStart,
      bodyEnd,
      bucket: h.bucket,
      lineIndex: h.lineIndex,
    };
  });
}

export function parseResumeSections(raw: string): ParsedResume {
  const text = raw?.trim() ?? "";
  const result: ParsedResume = {
    header: "",
    pvp: "",
    coreCompetencies: "",
    skills: "",
    experience: "",
    unknown: [],
  };

  if (!text) return result;

  const lines = text.split(/\r?\n/);
  const headings = findHeadings(text);

  const set = (bucket: Bucket, content: string) => {
    const key = bucket as keyof Pick<
      ParsedResume,
      "header" | "pvp" | "coreCompetencies" | "skills" | "experience"
    >;
    result[key] = (result[key] ? result[key] + "\n\n" : "") + content.trim();
  };

  if (headings.length === 0) {
    // No headings — treat the whole thing as the header (preamble).
    result.header = text.trim();
    return result;
  }

  // Preamble before the first heading is the header.
  const firstStart = headings[0].lineIndex ?? 0;
  if (firstStart > 0) {
    const preamble = lines.slice(0, firstStart).join("\n").trim();
    if (preamble) set("header", preamble);
  }

  let lastBucket: Bucket | null = null;
  for (const h of headings) {
    const body = lines.slice(h.bodyStart, h.bodyEnd).join("\n").trim();
    const bucket = h.bucket ?? lastBucket;
    if (bucket) {
      set(bucket, h.title ? `${h.title}\n${body}` : body);
    } else {
      result.unknown.push(h.title);
      // Fold unknown leading sections into the header.
      set("header", h.title ? `${h.title}\n${body}` : body);
    }
    if (h.bucket) lastBucket = h.bucket;
  }

  return result;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/;
const TOKEN_RE = /\u27E6[^\u27E7]+\u27E7/g;

export interface HeaderValidation {
  ok: boolean;
  /** Human-readable reason when not ok. */
  reason?: string;
  tokenCount: number;
}

/**
 * Validate that the Header section is Tier-1 tokenized: it must contain at
 * least one ⟦TOKEN⟧ and must NOT contain a raw email or phone number.
 */
export function validateHeaderTokenization(header: string): HeaderValidation {
  const tokenCount = (header.match(TOKEN_RE) ?? []).length;
  if (tokenCount === 0) {
    return {
      ok: false,
      reason:
        "Header has no ⟦TOKEN⟧ entries. Replace your real name/email/phone/address/links with tokens like ⟦NAME⟧, ⟦EMAIL⟧, ⟦PHONE⟧, ⟦ADDRESS⟧, ⟦LINKS⟧.",
      tokenCount: 0,
    };
  }
  if (EMAIL_RE.test(header)) {
    return {
      ok: false,
      reason:
        "Header still contains a raw email address. Replace it with ⟦EMAIL⟧ before uploading.",
      tokenCount,
    };
  }
  if (PHONE_RE.test(header)) {
    return {
      ok: false,
      reason:
        "Header still contains a raw phone number. Replace it with ⟦PHONE⟧ before uploading.",
      tokenCount,
    };
  }
  return { ok: true, tokenCount };
}
