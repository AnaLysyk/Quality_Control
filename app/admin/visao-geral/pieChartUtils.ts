export type PieSlice = {
  label: string;
  value: number;
  color: string;
};

export function buildPieGradient(slices: PieSlice[]) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (!total) return "conic-gradient(#cbd5e1 0deg 360deg)";

  let cursor = 0;
  const stops = slices
    .filter((slice) => slice.value > 0)
    .map((slice) => {
      const start = cursor;
      const end = cursor + (slice.value / total) * 360;
      cursor = end;
      return `${slice.color} ${start}deg ${end}deg`;
    });

  return `conic-gradient(${stops.join(", ")})`;
}
