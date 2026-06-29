import { describe, expect, it } from "vitest";
import { parseAlertEmail } from "./email-parser.js";

describe("email-parser", () => {
  it("parses a LinkedIn Easy Apply alert", () => {
    const c = parseAlertEmail({
      messageId: "msg-1",
      from: "notifications@linkedin.com",
      subject: "Job alert: Senior Engineer",
      snippet:
        "Senior Engineer at Acme — Easy Apply https://www.linkedin.com/jobs/view/1234567890/",
    });
    expect(c?.source).toBe("linkedin");
    expect(c?.applyType).toBe("easy_apply");
    expect(c?.jobUrl).toContain("linkedin.com/jobs/view/1234567890");
    expect(c?.externalId).toBe("1234567890");
    expect(c?.title).toBe("Senior Engineer");
    expect(c?.company).toBe("Acme");
    expect(c?.alertEmailId).toBe("msg-1");
  });

  it("parses a Seek Quick Apply alert", () => {
    const c = parseAlertEmail({
      from: "alerts@seek.com.au",
      subject: "New jobs matching your search",
      snippet:
        "Data Analyst at Co — Quick apply https://www.seek.com.au/job/9876543?ref=alpha",
    });
    expect(c?.source).toBe("seek");
    expect(c?.applyType).toBe("quick_apply");
    expect(c?.externalId).toBe("9876543");
  });

  it("returns null for non-alert emails", () => {
    const c = parseAlertEmail({
      from: "alice@example.com",
      subject: "Lunch tomorrow?",
      snippet: "Hey, free for lunch?",
    });
    expect(c).toBeNull();
  });

  it("defaults to standard apply type when no signal", () => {
    const c = parseAlertEmail({
      from: "jobs-noreply@linkedin.com",
      subject: "Job alert",
      snippet: "Engineer at Globex https://linkedin.com/jobs/view/555",
    });
    expect(c?.applyType).toBe("standard");
  });
});
