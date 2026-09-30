/**
 * Colours users can pick for categories and wallets. Mid-saturation so they read on
 * both the light and dark surfaces; icons render in the colour on a 15% tint.
 */
export const PICKER_COLORS = [
  '#dc2626', // red
  '#ea580c', // orange
  '#d97706', // amber
  '#65a30d', // lime
  '#059669', // emerald
  '#0d9488', // teal
  '#0891b2', // cyan
  '#2563eb', // blue
  '#4f46e5', // indigo
  '#7c3aed', // violet
  '#c026d3', // fuchsia
  '#db2777', // pink
  '#78716c', // stone
  '#475569', // slate
] as const

/** Hex colour → rgba with alpha, for icon tints. */
export function tint(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
