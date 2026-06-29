import { describe, expect, it } from "vitest";
import { computeJobIdHash } from "./job-hash.js";

describe("job-hash dedup", () => {
  it("is deterministic for identical inputs", () => {
    const a = computeJobIdHash("linkedin", "123", "Eng", "Acme", "u");
    const b = computeJobIdHash("linkedin", "123", "Eng", "Acme", "u");
    expect(a).toBe(b);
    expect(a).toHaveLength(24);
  });

  it("differs by external id", () => {
    const a = computeJobIdHash("linkedin", "123", "Eng", "Acme", "u");
    const b = computeJobIdHash("linkedin", "456", "Eng", "Acme", "u");
    expect(a).not.toBe(b);
  });

  it("differs by source for the same external id", () => {
    const a = computeJobIdHash("linkedin", "123", "Eng", "Acme", "u");
    const b = computeJobIdHash("seek", "123", "Eng", "Acme", "u");
    expect(a).not.toBe(b);
  });

  it("falls back to normalized title+company when no external id", () => {
    const a = computeJobIdHash("seek", undefined, "Data Analyst", "Co", "u");
    const b = computeJobIdHash("seek", undefined, "data   analyst", "co", "u");
    expect(a).toBe(b);
  });
});
