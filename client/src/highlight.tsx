import React from "react";

export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

/**
 * Splits text into highlighted segments matching target quote.
 * Never uses dangerouslySetInnerHTML; produces pure React string nodes.
 */
export function highlightQuote(content: string, quote: string): HighlightSegment[] {
  if (!content || !quote || quote.trim().length === 0) {
    return [{ text: content, isMatch: false }];
  }

  const lowerContent = content.toLowerCase();
  const lowerQuote = quote.toLowerCase().trim();

  const matchIdx = lowerContent.indexOf(lowerQuote);
  if (matchIdx === -1) {
    return [{ text: content, isMatch: false }];
  }

  const before = content.slice(0, matchIdx);
  const match = content.slice(matchIdx, matchIdx + lowerQuote.length);
  const after = content.slice(matchIdx + lowerQuote.length);

  const segments: HighlightSegment[] = [];
  if (before) segments.push({ text: before, isMatch: false });
  segments.push({ text: match, isMatch: true });
  if (after) segments.push({ text: after, isMatch: false });

  return segments;
}

export const SafeEvidenceDisplay: React.FC<{ content: string; quote?: string }> = ({
  content,
  quote,
}) => {
  const segments = quote ? highlightQuote(content, quote) : [{ text: content, isMatch: false }];

  return (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        fontFamily: "monospace",
        padding: "1rem",
        backgroundColor: "#1a1a1a",
        color: "#f0f0f0",
        borderRadius: "6px",
        overflowX: "auto",
      }}
    >
      {segments.map((seg, idx) =>
        seg.isMatch ? (
          <mark
            key={idx}
            style={{
              backgroundColor: "#e07a5f",
              color: "#ffffff",
              fontWeight: "bold",
              borderRadius: "2px",
              padding: "0 2px",
            }}
          >
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        ),
      )}
    </pre>
  );
};
