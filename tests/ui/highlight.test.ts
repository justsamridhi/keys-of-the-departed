import { describe, it, expect } from "vitest";
import { highlightQuote } from "../../client/src/highlight.js";
import { formatOwnerStatus } from "../../client/src/App.js";

describe("Area 4: Evidence Display & Safe Rendering", () => {
  it("UI-01: Correctly segments matching quote inside record content", () => {
    const content = "Author: Carlos Mendez <cmendez@corp>\nSigned-off-by: Carlos Mendez\nAll done.";
    const quote = "Signed-off-by: Carlos Mendez";

    const segments = highlightQuote(content, quote);
    expect(segments.length).toBe(3);
    expect(segments[0]).toEqual({ text: "Author: Carlos Mendez <cmendez@corp>\n", isMatch: false });
    expect(segments[1]).toEqual({ text: "Signed-off-by: Carlos Mendez", isMatch: true });
    expect(segments[2]).toEqual({ text: "\nAll done.", isMatch: false });
  });

  it("UI-02: Matches case-insensitively without breaking substring boundaries", () => {
    const content = "DEPLOY KEY STAGING PIPELINE";
    const quote = "staging pipeline";

    const segments = highlightQuote(content, quote);
    expect(segments.length).toBe(2);
    expect(segments[1].isMatch).toBe(true);
    expect(segments[1].text).toBe("STAGING PIPELINE");
  });

  it("UI-03: Renders script and HTML injection tags as pure text strings", () => {
    const maliciousContent = "<script>alert('injection')</script><img onerror=alert(1)>";
    const quote = "alert('injection')";

    const segments = highlightQuote(maliciousContent, quote);
    // Verified that output text remains exact literal strings, not transformed to DOM elements
    expect(segments[0].text).toBe("<script>");
    expect(segments[1].text).toBe("alert('injection')");
    expect(segments[2].text).toBe("</script><img onerror=alert(1)>");
  });

  it("UI-04: Status badges provide accessible text and icons without color reliance", () => {
    const verified = formatOwnerStatus("verified");
    expect(verified.label).toBe("Verified");
    expect(verified.icon).toBe("✓");

    const noEvidence = formatOwnerStatus("no_evidence");
    expect(noEvidence.label).toBe("No Evidence");
    expect(noEvidence.icon).toBe("○");
  });
});
