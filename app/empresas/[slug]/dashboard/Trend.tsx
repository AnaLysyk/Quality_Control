import React from "react";

export function Trend({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-gray-400">➖</span>;
  if (delta < 0) return <span className="text-green-600">🔽</span>;
  if (delta > 0) return <span className="text-red-600">🔼</span>;
  return <span className="text-gray-400">➖</span>;
}
