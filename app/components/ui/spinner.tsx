"use client";

import { Quantum } from "ldrs/react";
import "ldrs/react/Quantum.css";

import { cn } from "./cn";

type SpinnerProps = {
  size?: number;
  color?: string;
  speed?: number;
  label?: string;
  className?: string;
};

export function Spinner({
  size = 24,
  color = "var(--tc-accent, #011848)",
  speed = 1.75,
  label = "Carregando",
  className,
}: SpinnerProps) {
  return (
    <span className={cn("inline-flex", className)} role="status" aria-label={label}>
      <Quantum size={size} color={color} speed={speed} />
    </span>
  );
}
