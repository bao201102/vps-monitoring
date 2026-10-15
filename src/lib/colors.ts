const PALETTE = [
  '#ea580c', // Orange
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#eab308', // Yellow
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#14b8a6', // Teal
];

/** Stable series colour for a name (containers, services). */
export function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
