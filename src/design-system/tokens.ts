export const colorTokens = {
  brand: {
    primary: "var(--tc-primary)",
    primaryDark: "var(--tc-primary-dark)",
    accent: "var(--tc-accent)",
    accentHover: "var(--tc-accent-hover)",
    accentActive: "var(--tc-accent-active)",
    gradient: "var(--tc-brand-gradient)",
    gradientStrong: "var(--tc-brand-gradient-strong)",
  },
  surface: {
    page: "var(--page-bg)",
    base: "var(--tc-surface)",
    elevated: "var(--tc-surface-alt)",
    muted: "var(--tc-surface-2)",
    hover: "var(--tc-surface-hover)",
    border: "var(--tc-border)",
  },
  text: {
    primary: "var(--tc-text-primary)",
    secondary: "var(--tc-text-secondary)",
    muted: "var(--tc-text-muted)",
    inverse: "var(--tc-text-inverse)",
  },
  feedback: {
    success: "var(--stat-pass)",
    warning: "var(--stat-blocked)",
    danger: "var(--stat-fail)",
    neutral: "var(--stat-notrun)",
  },
  focus: "var(--tc-focus)",
} as const;

export const spacingTokens = {
  none: "0",
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
  "3xl": "3rem",
} as const;

export const radiusTokens = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  full: "9999px",
} as const;

export const shadowTokens = {
  card: "var(--shell-glass-shadow)",
  cover: "var(--shell-cover-shadow)",
  menu: "var(--shell-menu-shadow)",
  menuHover: "var(--shell-menu-shadow-hover)",
} as const;

export const zIndexTokens = {
  base: 0,
  dropdown: 20,
  sticky: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
} as const;

export const motionTokens = {
  fast: "150ms ease",
  normal: "220ms ease",
  slow: "320ms ease",
} as const;

export const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus) focus-visible:ring-offset-2 focus-visible:ring-offset-(--tc-surface)";

export type ColorTokens = typeof colorTokens;
export type SpacingTokens = typeof spacingTokens;
export type RadiusTokens = typeof radiusTokens;
export type ShadowTokens = typeof shadowTokens;
export type ZIndexTokens = typeof zIndexTokens;
export type MotionTokens = typeof motionTokens;

