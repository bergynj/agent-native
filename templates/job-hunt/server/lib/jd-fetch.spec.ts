import { describe, expect, it } from "vitest";
import { jdFallback, htmlToText } from "./jd-fetch.js";

describe("jd-fetch.jdFallback", () => {
  it("returns snippet status when no URL but a snippet exists", () => {
    const r = jdFallback(null, "Senior Engineer at Acme…");
    expect(r.status).toBe("snippet");
    expect(r.text).toBe("Senior Engineer at Acme…");
  });

  it("returns failed when there is no URL and no snippet", () => {
    const r = jdFallback(null, null);
    expect(r.status).toBe("failed");
    expect(r.text).toBe("");
  });

  it("returns snippet (not ok) when a URL exists but no snippet — fetch path decides", () => {
    const r = jdFallback("https://linkedin.com/jobs/view/1", null);
    expect(r.status).toBe("failed");
  });
});

describe("jd-fetch.htmlToText", () => {
  it("strips tags and scripts, keeps text", () => {
    const html =
      "<html><head><style>.x{}</style></head><body><script>bad()</script><h1>Senior Engineer</h1><p>Acme — 2021</p></body></html>";
    const text = htmlToText(html);
    expect(text).not.toContain("bad()");
    expect(text).not.toContain("<");
    expect(text).toContain("Senior Engineer");
    expect(text).toContain("Acme — 2021");
  });
});
