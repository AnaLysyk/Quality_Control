"use client";

import { useMemo, useState } from "react";

interface ExpandableDescriptionProps {
  html: string;
  limit?: number;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

export default function ExpandableDescription({ html, limit = 150 }: ExpandableDescriptionProps) {
  const [expanded, setExpanded] = useState(false);

  const { truncated, shouldTruncate } = useMemo(() => {
    const plainText = stripHtml(html || "");
    if (plainText.length <= limit) {
      return { truncated: plainText, shouldTruncate: false };
    }
    return {
      truncated: `${plainText.slice(0, limit)}…`,
      shouldTruncate: true,
    };
  }, [html, limit]);

  return (
    <div className="space-y-2">
      {expanded ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="whitespace-pre-wrap break-words">{truncated}</div>
      )}

      {shouldTruncate && (
        <button
          type="button"
          className="text-[#7CD343] text-sm font-medium hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Ver menos ↑" : "Ver mais ↓"}
        </button>
      )}
    </div>
  );
}
