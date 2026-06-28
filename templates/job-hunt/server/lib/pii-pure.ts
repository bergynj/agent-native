/**
 * Pure PII scrub / re-inject / leak-guard logic — zero imports so it can be
 * unit-tested in isolation (no database, no framework).
 *
 * Tokens use the unlikely-to-be-generated U+27E6 / U+27E7 brackets: ⟦TOKEN⟧.
 *
 * See pii.ts for the DB-backed wrappers that load the per-user token map from
 * SQL and persist newly discovered tokens.
 */

export const TOKEN_OPEN = "\u27E6"; // ⟦
export const TOKEN_CLOSE = "\u27E7"; // ⟧

export interface TokenEntry {
  token: string;
  realValue: string;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /https?:\/\/[^\s<>"')]+/g;
// International + AU-friendly phone: requires a leading + or a long digit run.
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/g;

const AUTO_TOKEN_RE = /^⟦(EMAIL|URL|PHONE)_(\d+)⟧$/;

export function isToken(s: string): boolean {
  return s.startsWith(TOKEN_OPEN) && s.endsWith(TOKEN_CLOSE);
}

export function wrap(name: string): string {
  return `${TOKEN_OPEN}${name}${TOKEN_CLOSE}`;
}

/** Replace all occurrences of `needle` with `replacement` (literal, not regex). */
function replaceAll(
  input: string,
  needle: string,
  replacement: string,
): string {
  if (!needle) return input;
  return input.split(needle).join(replacement);
}

/** Find spans of existing ⟦...⟧ tokens so regex scrubbing skips them. */
function tokenSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf(TOKEN_OPEN, i);
    if (start === -1) break;
    const end = text.indexOf(TOKEN_CLOSE, start);
    if (end === -1) break;
    spans.push([start, end + TOKEN_CLOSE.length]);
    i = end + TOKEN_CLOSE.length;
  }
  return spans;
}

function insideTokenSpan(
  idx: number,
  len: number,
  spans: Array<[number, number]>,
): boolean {
  for (const [s, e] of spans) {
    if (idx >= s && idx + len <= e) return true;
  }
  return false;
}

function digitCount(s: string): number {
  let n = 0;
  for (const ch of s) if (ch >= "0" && ch <= "9") n++;
  return n;
}

export interface ScrubResult {
  scrubbed: string;
  /** Newly discovered (token, realValue) pairs to persist. */
  newTokens: Array<{ token: string; real: string }>;
}

/**
 * Pure scrub. Given a mutable token map (token -> realValue), returns scrubbed
 * text and the list of newly discovered tokens (already inserted into `map`).
 *
 * 1. Replace every known realValue from the map (longest first) with its token.
 *    This covers header PII (name/email/phone/address/links) and any
 *    previously-seen values.
 * 2. Regex-detect residual emails, urls, and phones; assign deterministic new
 *    tokens (⟦EMAIL_n⟧ / ⟦URL_n⟧ / ⟦PHONE_n⟧) and replace — but skip matches
 *    already inside a token span.
 */
export function scrubWithMap(
  text: string,
  map: Map<string, string>,
): ScrubResult {
  if (!text) return { scrubbed: text, newTokens: [] };

  const entries = [...map.entries()]
    .filter(([, real]) => real && real.length >= 2 && !isToken(real))
    .sort((a, b) => b[1].length - a[1].length);
  let out = text;
  for (const [token, real] of entries) {
    out = replaceAll(out, real, token);
  }

  const spans = tokenSpans(out);

  const counters: Record<string, number> = { EMAIL: 0, URL: 0, PHONE: 0 };
  for (const tok of map.keys()) {
    const m = AUTO_TOKEN_RE.exec(tok);
    if (m) {
      const n = Number(m[2]);
      if (n > counters[m[1]]) counters[m[1]] = n;
    }
  }

  const newTokens: Array<{ token: string; real: string }> = [];

  const collect = (re: RegExp, type: string, minDigits = 0): void => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(out)) !== null) {
      const value = m[0];
      if (minDigits > 0 && digitCount(value) < minDigits) continue;
      if (insideTokenSpan(m.index, value.length, spans)) continue;
      const already = [...map.entries()].find(([, real]) => real === value);
      if (already) continue;
      const n = ++counters[type];
      const token = wrap(`${type}_${n}`);
      map.set(token, value);
      newTokens.push({ token, real: value });
    }
  };

  collect(EMAIL_RE, "EMAIL");
  collect(URL_RE, "URL");
  collect(PHONE_RE, "PHONE", 8);

  for (const { token, real } of newTokens) {
    out = replaceAll(out, real, token);
  }

  return { scrubbed: out, newTokens };
}

/** Pure re-inject. Token -> realValue, longest token first. */
export function reinjectWithMap(
  text: string,
  map: Map<string, string>,
): string {
  if (!text) return text;
  const entries = [...map.entries()].sort((a, b) => b[0].length - a[0].length);
  let out = text;
  for (const [token, real] of entries) {
    out = replaceAll(out, token, real);
  }
  return out;
}

/**
 * Pure fail-closed leak guard. Throws if any known realValue (>= 3 chars, not
 * itself a token) still appears in `text`.
 */
export function assertNoRawPiiWithMap(
  text: string,
  map: Map<string, string>,
): void {
  if (!text) return;
  for (const [, real] of map) {
    if (real && real.length >= 3 && !isToken(real)) {
      if (text.includes(real)) {
        throw new Error(
          "PII leak detected: raw value present in outbound payload",
        );
      }
    }
  }
}
