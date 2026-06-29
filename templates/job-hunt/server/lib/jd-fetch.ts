import { ssrfSafeFetch } from "@agent-native/core/extensions/url-safety";

export type JdFetchStatus = "ok" | "snippet" | "failed";

export interface JdFetchResult {
  text: string;
  status: JdFetchStatus;
  reason?: string;
}

const MAX_JD_CHARS = 20_000;

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_JD_CHARS);
}

/**
 * Pure fallback decision: with no URL, or when the caller decides not to fetch,
 * the snippet (if any) becomes the JD with status=snippet; otherwise failed.
 */
export function jdFallback(
  jobUrl: string | null | undefined,
  snippet?: string | null,
): JdFetchResult {
  if (!jobUrl) {
    return {
      text: snippet ?? "",
      status: snippet ? "snippet" : "failed",
      reason: "no job url",
    };
  }
  return {
    text: snippet ?? "",
    status: snippet ? "snippet" : "failed",
    reason: undefined,
  };
}

/**
 * Fetch the full job description from a public job URL and extract readable
 * text. Falls back to the email snippet when the URL is missing, fetch fails,
 * or the page is auth-gated (LinkedIn Easy Apply). SSRF-guarded.
 */
export async function fetchFullJd(
  jobUrl: string | null | undefined,
  snippet?: string | null,
): Promise<JdFetchResult> {
  if (!jobUrl) {
    return {
      text: snippet ?? "",
      status: snippet ? "snippet" : "failed",
      reason: "no job url",
    };
  }
  try {
    const res = await ssrfSafeFetch(jobUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; JobHuntBot/1.0; +https://agent-native.com)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      return {
        text: snippet ?? "",
        status: snippet ? "snippet" : "failed",
        reason: `fetch returned ${res.status}`,
      };
    }
    const html = await res.text();
    const text = htmlToText(html);
    // Auth-gated or near-empty pages fall back to the snippet.
    if (text.length < 200) {
      return {
        text: snippet ?? text,
        status: snippet ? "snippet" : "failed",
        reason: "page too short — likely auth-gated",
      };
    }
    return { text, status: "ok" };
  } catch (err) {
    return {
      text: snippet ?? "",
      status: snippet ? "snippet" : "failed",
      reason: err instanceof Error ? err.message : "fetch failed",
    };
  }
}
