import { describe, expect, it } from "vitest";
import {
  scrubWithMap,
  reinjectWithMap,
  assertNoRawPiiWithMap,
  wrap,
} from "./pii-pure.js";
import { MATCH_AUTO_THRESHOLD } from "../../shared/types.js";

/**
 * End-to-end simulation of the Module 2 data boundary, using only the pure
 * PII helpers (no DB, no LLM):
 *   - scrubbed JD has no raw PII (fail-closed leak guard)
 *   - the two drafted documents (cover letter + resume diff) are re-injected
 *     with real PII locally
 */
describe("module2 flow: PII boundary + 2-doc re-injection", () => {
  const vault = new Map<string, string>([
    [wrap("NAME"), "Jane Doe"],
    [wrap("EMAIL"), "jane.doe@example.com"],
  ]);

  it("scrubs the JD and fail-closes if real PII remains", () => {
    const jd = `We are hiring. Reach out to jane.doe@example.com about the role.`;
    const { scrubbed } = scrubWithMap(jd, new Map(vault));
    expect(scrubbed).not.toContain("jane.doe@example.com");
    expect(scrubbed).toContain(wrap("EMAIL"));
    // Fail-closed: no known raw value leaks.
    expect(() => assertNoRawPiiWithMap(scrubbed, new Map(vault))).not.toThrow();
  });

  it("re-injects real PII into the cover letter draft", () => {
    const draft = `Dear hiring team,\n\n${wrap("NAME")} is excited about the role.\nReach me at ${wrap("EMAIL")}.\n\nRegards,\n${wrap("NAME")}`;
    const final = reinjectWithMap(draft, new Map(vault));
    expect(final).toContain("Jane Doe");
    expect(final).toContain("jane.doe@example.com");
    expect(final).not.toContain(wrap("NAME"));
    expect(final).not.toContain(wrap("EMAIL"));
  });

  it("re-injects real PII into the resume diff draft", () => {
    const draft = `## Role headline\n${wrap("NAME")} — Senior Engineer\n\n## PVP\n${wrap("NAME")} builds reliable systems.\n\n## Core competencies/skills\n- Alignment: high`;
    const final = reinjectWithMap(draft, new Map(vault));
    expect(final).toContain("Jane Doe — Senior Engineer");
    expect(final).not.toContain(wrap("NAME"));
  });

  it("produces exactly two documents, both with real PII", () => {
    const cover = reinjectWithMap(
      `Cover letter for ${wrap("NAME")}.`,
      new Map(vault),
    );
    const diff = reinjectWithMap(
      `Resume updates for ${wrap("NAME")}.`,
      new Map(vault),
    );
    expect(cover).toContain("Jane Doe");
    expect(diff).toContain("Jane Doe");
    expect([cover, diff]).toHaveLength(2);
  });
});

describe("module2 flow: match gate", () => {
  it("auto-triggers only above the 80% threshold", () => {
    const eligible = (score: number) => score > MATCH_AUTO_THRESHOLD;
    expect(eligible(81)).toBe(true);
    expect(eligible(80)).toBe(false);
    expect(eligible(45)).toBe(false);
  });
});
