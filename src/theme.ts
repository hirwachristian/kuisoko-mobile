// Light palette mirrors the website's actual Tailwind utility colors 1:1 (see
// frontend/components/ProductCard.tsx, frontend/pages/SignIn.tsx). Dark palette mirrors the same
// components' `dark:` variants (e.g. ProductCard's `dark:bg-slate-900 dark:border-slate-800`,
// AdminLayout's `dark:bg-slate-950`) so toggling dark mode here matches the website's own dark
// theme rather than an invented one.
const lightColors = {
  emerald50: '#ecfdf5',
  emerald100: '#d1fae5',
  emerald600: '#059669',
  emerald700: '#047857',
  emerald800: '#065f46',
  emerald900: '#064e3b',
  orange50: '#fff7ed',
  orange400: '#fb923c',
  orange500: '#f97316',
  orange600: '#ea580c',
  orange800: '#9a3412',
  lime50: '#f7fee7',
  lime700: '#4d7c0e',
  rose50: '#fef2f2',
  rose500: '#f43f5e',
  rose600: '#e11d48',
  amber50: '#fffbeb',
  amber200: '#fde68a',
  amber800: '#92400e',
  // The 700/800-weight emerald accent (emerald700/800 below) is dual-purpose: it's both a solid
  // button/pill BACKGROUND (which must stay fixed dark-green in both themes, matching the
  // website's un-dark-varianted buttons) and a foreground TEXT/icon color on tinted badges and
  // plain cards (which needs to lighten in dark mode or it reads as near-invisible dark-green
  // text on a dark-navy card). `accentText` is the second role, split out so both can be correct
  // at once instead of one breaking the other.
  accentText: '#047857',
  slate950: '#020617',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate400: '#94a3b8',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  slate50: '#f8fafc',
  white: '#ffffff',
  // Semantic roles - the ones that actually flip between themes (surfaces/text/borders).
  // Brand accents (emerald/orange/rose/amber above) stay the same in both themes, same as the
  // website's dark: variants mostly keep the accent hue and only invert backgrounds/text.
  background: '#f8fafc', // slate-50
  surface: '#ffffff', // card/input background
  surfaceAlt: '#f8fafc', // slightly recessed surface (e.g. screen bg vs card bg)
  border: '#f1f5f9', // slate-100
  borderStrong: '#e2e8f0', // slate-200
  textPrimary: '#0f172a', // slate-900
  textSecondary: '#475569', // slate-600
  textMuted: '#94a3b8', // slate-400
  overlay: 'rgba(15,23,42,0.5)',
};

// Every existing StyleSheet in the app was audited before writing this: `slate900`/`slate700`/
// `slate600` are used exclusively as text colors (never a background) so they safely become light
// values here; `white`/`slate50`/`slate100`/`slate200` are used exclusively as
// surface/background/border colors so they safely become dark values. That audit is what makes
// simply swapping the `colors` import for this object (no per-usage rewrite) correct rather than
// coincidentally working.
const darkColors: typeof lightColors = {
  ...lightColors,
  slate900: '#f1f5f9', // was bg-safe dark text -> now the light text color on dark surfaces
  slate800: '#1e293b', // unchanged - only ever used for the "OUT OF STOCK" badge, dark in both themes
  slate700: '#e2e8f0', // secondary text (field labels, captions)
  slate600: '#cbd5e1', // muted secondary text
  slate400: '#94a3b8', // unchanged - already a mid-gray that reads on both light and dark
  slate200: '#334155', // borders/input outlines
  slate100: '#1e293b', // recessed surfaces (chips, thumbnails, badge tracks) + hairline borders
  slate50: '#020617', // screen background
  white: '#0f172a', // card/input surface
  // These four are audited as background-only (never text) - safe to invert directly, same as
  // the website's `bg-emerald-50 dark:bg-emerald-950` / `bg-orange-50 dark:bg-orange-950` pattern.
  emerald50: '#022c22',
  emerald100: '#064e3b',
  orange50: '#431407',
  amber50: '#451a03',
  rose50: '#3f0d0d',
  lime50: '#1a2e05',
  // Audited as text-only (never background) - the darkest ("800") tint of each accent lightens
  // for contrast, matching the website's `text-amber-800 dark:text-amber-300` convention.
  amber800: '#fcd34d',
  orange800: '#fdba74',
  lime700: '#bef264',
  accentText: '#34d399', // emerald-400 - the lightened counterpart of accentText's light-mode emerald-700
  background: '#020617',
  surface: '#0f172a',
  surfaceAlt: '#020617',
  border: '#1e293b',
  borderStrong: '#334155',
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  overlay: 'rgba(0,0,0,0.65)',
};

export type AppColors = typeof lightColors;
export { lightColors, darkColors };

// Kept as a static export too - most of the app now sources colors from useAppTheme(), but a
// handful of context-free helpers (e.g. the invoice PDF, generated for print/email rather than
// on-screen) intentionally always render with the light/print palette regardless of the viewer's
// in-app theme, so they still need a fixed value to import directly.
export const colors = lightColors;

// The brand mark's own palette (frontend/components/KuISOKOLogoSVG.tsx) is a distinct, slightly
// different green/orange than the UI's emerald/orange utilities - kept separate, and NOT flipped
// for dark mode (the website doesn't reskin its logo for dark mode either).
export const logoColors = {
  bag: '#0B5D3B',
  handle: '#F7931E',
  check: '#F5B335',
  textGreen: '#0B5D3B',
  textOrange1: '#F7931E',
  textOrange2: '#F5B335',
};
