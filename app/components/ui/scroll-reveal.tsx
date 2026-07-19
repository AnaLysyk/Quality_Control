"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  /** Distance (px) the content travels as it fades in. */
  y?: number;
  duration?: number;
  delay?: number;
  /** ScrollTrigger "start" position, e.g. "top 85%". */
  start?: string;
  /** Animate each direct child on a staggered delay (e.g. cards in a grid) instead of the container as one block. */
  stagger?: number;
  /** Replay the animation every time it re-enters the viewport instead of only once. */
  repeat?: boolean;
  /**
   * Re-run the reveal when these values change (e.g. `[loading]`) — needed whenever the
   * content is populated asynchronously after mount, so the animation targets the real
   * items instead of firing once against an empty/loading container.
   */
  deps?: unknown[];
};

export function ScrollReveal({
  children,
  className,
  y = 24,
  duration = 0.6,
  delay = 0,
  start = "top 85%",
  stagger,
  repeat = false,
  deps = [],
}: Readonly<ScrollRevealProps>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const targets = stagger ? gsap.utils.toArray<HTMLElement>(container.children) : container;

        gsap.set(targets, { opacity: 0, y });
        gsap.to(targets, {
          opacity: 1,
          y: 0,
          duration,
          delay,
          stagger,
          ease: "power2.out",
          scrollTrigger: {
            trigger: container,
            start,
            toggleActions: repeat ? "play none none reverse" : "play none none none",
          },
        });
      });

      return () => mm.revert();
    },
    { scope: containerRef, dependencies: deps, revertOnUpdate: true },
  );

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
