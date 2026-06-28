import { completeText } from "@agent-native/core/server";
import { scrub, scrubAndGuard } from "./pii.js";
import { getResumeForLlm } from "./master-resume.js";

/**
 * Score a job description against the master resume (0-100).
 *
 * Uses completeText (a narrow server-side model call) on scrubbed inputs only.
 * Employer names, titles, and dates are preserved (not masked) so the model can
 * reason about relevance. The resume header is already Tier-1 tokenized.
 */
export async function scoreMatch(
  ownerEmail: string,
  jdText: string,
): Promise<{ score: number; rationale: string }> {
  const resume = await getResumeForLlm(ownerEmail);
  if (!resume) {
    return { score: 0, rationale: "No master resume uploaded." };
  }
  // Scrub both inputs (resume header is already tokenized; scrub is a no-op
  // for tokens and a safety net for any residual PII in the JD).
  const scrubbedJd = await scrub(jdText, ownerEmail);
  const scrubbedResume = await scrub(resume, ownerEmail);

  const result = await completeText({
    appId: "job-hunt",
    systemPrompt:
      'You are an ATS match scorer. Compare a job description to a candidate\'s resume and return a match score from 0 to 100 reflecting how well the resume aligns with the role\'s required skills, seniority, and domain. Respond with STRICT JSON only: {"score": number, "rationale": string}. The rationale is one sentence.',
    input: `JOB DESCRIPTION:\n${scrubbedJd}\n\nRESUME:\n${scrubbedResume}\n\nReturn JSON: {\"score\": <0-100>, \"rationale\": \"...\"}`,
    temperature: 0.2,
    maxOutputTokens: 400,
  });

  const text = result.text.trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { score: 0, rationale: "Scorer returned no JSON." };
  try {
    const parsed = JSON.parse(match[0]) as {
      score?: number;
      rationale?: string;
    };
    const score = Math.max(
      0,
      Math.min(100, Math.round(Number(parsed.score) || 0)),
    );
    return {
      score,
      rationale: parsed.rationale ?? "No rationale provided.",
    };
  } catch {
    return { score: 0, rationale: "Scorer returned invalid JSON." };
  }
}

// Re-export for actions that want the guarded variant.
export { scrubAndGuard };
