const avatarColors = [
  "var(--ink)",
  "var(--info)",
  "var(--success)",
  "var(--violet)",
  "var(--warning)"
];

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function avatarColorFor(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return avatarColors[hash % avatarColors.length]!;
}
