"use client";

import { useEffect, useMemo, useRef } from 'react';

type Point = { date: string; passRate: number };

export default function TrendLine({ points, width = 400, height = 80 }: { points: Point[]; width?: number; height?: number }) {
  const pathRef = useRef<SVGPathElement | null>(null);

  const d = useMemo(() => {
    if (!points || points.length === 0) return '';
    const vals = points.map((p) => p.passRate);
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals, 100);
    const stepX = width / Math.max(1, points.length - 1);
    const mapY = (v: number) => {
      const norm = (v - min) / Math.max(1, max - min);
      return height - norm * height;
    };

    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${mapY(p.passRate)}`).join(' ');
  }, [points, width, height]);

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const length = el.getTotalLength();
    el.style.strokeDasharray = String(length);
    el.style.strokeDashoffset = String(length);
    // animate
    requestAnimationFrame(() => {
      el.style.transition = 'stroke-dashoffset 900ms ease-out';
      el.style.strokeDashoffset = '0';
    });
  }, [d]);

  if (!points || points.length === 0) return <div className="text-gray-400">Sem dados</div>;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
      <path ref={pathRef as any} d={d} fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
