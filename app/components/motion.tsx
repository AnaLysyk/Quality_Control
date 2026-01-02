"use client";

import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1 },
};

const slideInX: Variants = {
  hidden: { opacity: 0, x: 8 },
  visible: { opacity: 1, x: 0 },
};

type MotionProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

export function MotionFade({ children, delay = 0, className }: MotionProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      transition={{ duration: 0.22, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

export function MotionScale({ children, delay = 0, className }: MotionProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={scaleIn}
      transition={{ duration: 0.25, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

export function MotionSlideX({ children, delay = 0, className }: MotionProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={slideInX}
      transition={{ duration: 0.2, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
