import { describe, expect, it } from "vitest";
import {
  scrubWithMap,
  reinjectWithMap,
  assertNoRawPiiWithMap,
  wrap,
  TOKEN_OPEN,
  TOKEN_CLOSE,
} from "./pii-pure.js";

function makeMap(entries: Array<[string, string]>): Map<string, string> {
  return new Map(entries);
}

describe("pii.scrubWithMap", () => {
  it("replaces known header PII real values with their tokens (longest first)", () => {
    const map = makeMap([
      [wrap("NAME"), "Jane Doe"],
      [wrap("EMAIL"), "jane.doe@example.com"],
      [wrap("PHONE"), "+61 412 345 678"],
    ]);
    const text = "Contact Jane Doe at jane.doe@example.com or +61 412 345 678.";
    const { scrubbed, newTokens } = scrubWithMap(text, map);
    expect(newTokens).toEqual([]);
    expect(scrubbed).toBe(
      `Contact ${wrap("NAME")} at ${wrap("EMAIL")} or ${wrap("PHONE")}.`,
    );
  });

  it("discovers and tokenizes residual emails, urls, and phones", () => {
    const map = makeMap([[wrap("NAME"), "Jane Doe"]]);
    const text =
      "Apply via recruiter@acme.com or https://acme.com/careers. Call +61 2 9876 5432 today.";
    const { scrubbed, newTokens } = scrubWithMap(text, map);
    expect(newTokens.map((n) => n.token).sort()).toEqual(
      [wrap("EMAIL_1"), wrap("URL_1"), wrap("PHONE_1")].sort(),
    );
    expect(scrubbed).not.toContain("recruiter@acme.com");
    expect(scrubbed).not.toContain("https://acme.com/careers");
    expect(scrubbed).not.toContain("+61 2 9876 5432");
    // Name wasn't in the text, so its token is not introduced.
    expect(scrubbed).not.toContain(wrap("NAME"));
  });

  it("does not double-tokenize already-tokenized text", () => {
    const map = makeMap([[wrap("EMAIL"), "jane.doe@example.com"]]);
    const text = `Reach ${wrap("EMAIL")} or recruiter@acme.com.`;
    const { scrubbed } = scrubWithMap(text, map);
    // existing token preserved verbatim; new email tokenized
    expect(scrubbed).toContain(wrap("EMAIL"));
    expect(scrubbed).toContain(wrap("EMAIL_1"));
    expect(scrubbed).not.toContain("recruiter@acme.com");
  });

  it("ignores short digit runs that are not phone numbers", () => {
    const map = makeMap([]);
    const text = "Reference number 12345 and ticket 67890.";
    const { scrubbed, newTokens } = scrubWithMap(text, map);
    expect(newTokens).toEqual([]);
    expect(scrubbed).toBe(text);
  });
});

describe("pii.reinjectWithMap", () => {
  it("restores real values for tokens (longest token first)", () => {
    const map = makeMap([
      [wrap("NAME"), "Jane Doe"],
      [wrap("EMAIL_1"), "recruiter@acme.com"],
    ]);
    const text = `Dear hiring team — ${wrap("NAME")} is keen. Contact ${wrap("EMAIL_1")}.`;
    expect(reinjectWithMap(text, map)).toBe(
      "Dear hiring team — Jane Doe is keen. Contact recruiter@acme.com.",
    );
  });

  it("round-trips scrub then reinject to the original real text", () => {
    const map = makeMap([[wrap("NAME"), "Jane Doe"]]);
    const original = "Jane Doe applied for the role.";
    const { scrubbed } = scrubWithMap(original, new Map(map));
    const round = reinjectWithMap(scrubbed, new Map(map));
    expect(round).toBe(original);
  });
});

describe("pii.assertNoRawPiiWithMap (fail-closed)", () => {
  it("throws when a known real value leaks into the payload", () => {
    const map = makeMap([[wrap("NAME"), "Jane Doe"]]);
    expect(() => assertNoRawPiiWithMap("Hello Jane Doe!", map)).toThrow(
      /PII leak detected/,
    );
  });

  it("passes when the payload is fully tokenized", () => {
    const map = makeMap([[wrap("NAME"), "Jane Doe"]]);
    expect(() =>
      assertNoRawPiiWithMap(`Hello ${wrap("NAME")}!`, map),
    ).not.toThrow();
  });
});

describe("pii token delimiters", () => {
  it("uses the U+27E6 / U+27E7 brackets", () => {
    expect(TOKEN_OPEN).toBe("\u27E6");
    expect(TOKEN_CLOSE).toBe("\u27E7");
    expect(wrap("NAME")).toBe("\u27E6NAME\u27E7");
  });
});
