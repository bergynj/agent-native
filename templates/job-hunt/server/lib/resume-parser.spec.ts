import { describe, expect, it } from "vitest";
import {
  parseResumeSections,
  validateHeaderTokenization,
} from "./resume-parser.js";

const SAMPLE = `# Header
⟦NAME⟧ · ⟦EMAIL⟧ · ⟦PHONE⟧ · ⟦LINKS⟧
Senior Platform Engineer

# PVP
I build reliable distributed systems.

# Core Competencies
- Reliability
- Distributed design

# Skills
TypeScript, Go, Postgres

# Experience
Senior Engineer, Acme — 2021–now
- Led platform team.`;

describe("resume-parser.parseResumeSections", () => {
  it("splits a markdown resume into the five sections", () => {
    const r = parseResumeSections(SAMPLE);
    expect(r.header).toContain("⟦NAME⟧");
    expect(r.pvp).toContain("reliable distributed systems");
    expect(r.coreCompetencies).toContain("Reliability");
    expect(r.skills).toContain("TypeScript");
    expect(r.experience).toContain("Senior Engineer, Acme");
  });

  it("treats a heading-less paste as the header preamble", () => {
    const r = parseResumeSections("Just some contact info and a name.");
    expect(r.header).toContain("Just some contact info");
  });
});

describe("resume-parser.validateHeaderTokenization", () => {
  it("accepts a tokenized header", () => {
    const v = validateHeaderTokenization("⟦NAME⟧ · ⟦EMAIL⟧ · Sydney, AU");
    expect(v.ok).toBe(true);
    expect(v.tokenCount).toBe(2);
  });

  it("rejects a header with no tokens", () => {
    const v = validateHeaderTokenization("Jane Doe · Sydney");
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/no .*TOKEN/);
  });

  it("rejects a header that still contains a raw email", () => {
    const v = validateHeaderTokenization("⟦NAME⟧ · jane.doe@example.com");
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/raw email/i);
  });

  it("rejects a header that still contains a raw phone", () => {
    const v = validateHeaderTokenization("⟦NAME⟧ · +61 412 345 678");
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/raw phone/i);
  });
});
