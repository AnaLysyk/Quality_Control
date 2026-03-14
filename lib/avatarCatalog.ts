export type AvatarKey = "rocket" | "ninja" | "robot" | "lab" | "hacker";

export const AVATAR_OPTIONS: { key: AvatarKey; label: string; emoji: string }[] = [
  { key: "rocket", label: "Rocket", emoji: "\u{1F680}" },
  { key: "ninja", label: "Ninja", emoji: "\u{1F977}" },
  { key: "robot", label: "Bot", emoji: "\u{1F916}" },
  { key: "lab", label: "Lab", emoji: "\u{1F9EA}" },
  { key: "hacker", label: "Hacker", emoji: "\u{1F576}" },
];

export function isAvatarKey(value: unknown): value is AvatarKey {
  return typeof value === "string" && AVATAR_OPTIONS.some((item) => item.key === value);
}

export function resolveAvatarEmoji(value?: string | null) {
  if (!isAvatarKey(value)) return null;
  return AVATAR_OPTIONS.find((item) => item.key === value)?.emoji ?? null;
}
