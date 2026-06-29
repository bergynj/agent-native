/**
 * Local PII layer (Tier 2 safety net) — DB-backed wrappers.
 *
 * Goal: no personally identifiable information reaches the external LLM
 * provider. Because the framework routes all AI work through the agent loop
 * (there is no raw provider-call interception point), this layer operates at
 * the data boundary — it tokenizes content BEFORE it enters agent context /
 * action payloads, and re-injects real values AFTER the agent returns, when we
 * persist documents.
 *
 * Tier 1 (manual) handles the master resume Header: the user uploads it
 * already tokenized. This module is the deterministic, per-user safety net that
 * also scrubs emails/phones/urls (e.g. recruiter contact info) found in fetched
 * job descriptions and research text, and fail-closes if any known header PII
 * is about to leak.
 *
 * Pure logic lives in pii-pure.ts (zero imports, unit-tested). This file loads
 * the per-user token map from SQL, persists newly discovered tokens, and
 * re-exports the pure helpers.
 */

export {
  TOKEN_OPEN,
  TOKEN_CLOSE,
  isToken,
  wrap,
  scrubWithMap,
  reinjectWithMap,
  assertNoRawPiiWithMap,
  type TokenEntry,
  type ScrubResult,
} from "./pii-pure.js";

import { eq, and } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { scrubWithMap } from "./pii-pure.js";

function tokenId(ownerEmail: string, token: string): string {
  return `${ownerEmail}::${token}`;
}

/** Load the per-user token map (token -> realValue). */
export async function loadTokenMap(
  ownerEmail: string,
): Promise<Map<string, string>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.piiTokenMap)
    .where(eq(schema.piiTokenMap.ownerEmail, ownerEmail));
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.token, r.realValue);
  return map;
}

/** Upsert a token -> realValue mapping for the user. */
export async function saveToken(
  ownerEmail: string,
  token: string,
  realValue: string,
): Promise<void> {
  if (!token || !realValue) return;
  const db = getDb();
  const id = tokenId(ownerEmail, token);
  const now = Date.now();
  const existing = await db
    .select({ id: schema.piiTokenMap.id })
    .from(schema.piiTokenMap)
    .where(
      and(
        eq(schema.piiTokenMap.ownerEmail, ownerEmail),
        eq(schema.piiTokenMap.token, token),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(schema.piiTokenMap)
      .set({ realValue })
      .where(eq(schema.piiTokenMap.id, id));
    return;
  }
  await db.insert(schema.piiTokenMap).values({
    id,
    ownerEmail,
    token,
    realValue,
    createdAt: now,
  });
}

/** Remove a token mapping. */
export async function removeToken(
  ownerEmail: string,
  token: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(schema.piiTokenMap)
    .where(
      and(
        eq(schema.piiTokenMap.ownerEmail, ownerEmail),
        eq(schema.piiTokenMap.token, token),
      ),
    );
}

/**
 * Scrub PII from `text` for the given user. Persists newly discovered
 * auto-tokens (emails/urls/phones) so re-injection works on later turns.
 */
export async function scrub(text: string, ownerEmail: string): Promise<string> {
  if (!text) return text;
  const map = await loadTokenMap(ownerEmail);
  const { scrubbed, newTokens } = scrubWithMap(text, map);
  await Promise.all(
    newTokens.map(({ token, real }) => saveToken(ownerEmail, token, real)),
  );
  return scrubbed;
}

/** Re-inject real values into `text` for the given user. */
export async function reinject(
  text: string,
  ownerEmail: string,
): Promise<string> {
  if (!text) return text;
  const map = await loadTokenMap(ownerEmail);
  const { reinjectWithMap } = await import("./pii-pure.js");
  return reinjectWithMap(text, map);
}

/** Fail-closed: throws if any known realValue still appears in `text`. */
export async function assertNoRawPii(
  text: string,
  ownerEmail: string,
): Promise<void> {
  const map = await loadTokenMap(ownerEmail);
  const { assertNoRawPiiWithMap } = await import("./pii-pure.js");
  assertNoRawPiiWithMap(text, map);
}

/** Convenience: scrub then fail-closed guard. */
export async function scrubAndGuard(
  text: string,
  ownerEmail: string,
): Promise<string> {
  const scrubbed = await scrub(text, ownerEmail);
  await assertNoRawPii(scrubbed, ownerEmail);
  return scrubbed;
}
