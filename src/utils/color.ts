// Blends a hex color toward white (positive percent) or black (negative percent) - used to
// derive the highlight/shadow stops for the exploded pie chart's glossy per-slice gradient from
// just its one base color, rather than hand-picking three colors per status.
export function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const target = percent > 0 ? 255 : 0;
  const amount = Math.abs(percent);
  const r = Math.round(((num >> 16) & 0xff) + (target - ((num >> 16) & 0xff)) * amount);
  const g = Math.round(((num >> 8) & 0xff) + (target - ((num >> 8) & 0xff)) * amount);
  const b = Math.round((num & 0xff) + (target - (num & 0xff)) * amount);
  const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
