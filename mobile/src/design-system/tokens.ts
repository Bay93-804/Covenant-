/**
 * Coach Conde design tokens — the single source of truth for color, type,
 * spacing, radius, and accessibility constants across the app.
 *
 * Brand direction (see docs/phase1/PRD.md §5): Midnight Navy background,
 * Burnished Gold action/emphasis, Bone text on dark surfaces, Silver
 * secondary text. Strong, premium, disciplined, athletic, minimal — no
 * gradients, gamified badges, or generic SaaS chrome.
 *
 * `tailwind.config.js` mirrors these color values under matching names
 * (navy/gold/bone/silver) so NativeWind className usage and direct token
 * usage never drift apart.
 */

export const color = {
  navy: {
    950: '#060A12',
    900: '#0B1220',
    800: '#0F1729',
    700: '#182238',
    600: '#26344D',
    500: '#3A4C6B',
    400: '#5C7096',
    300: '#8C9DBC',
    200: '#B9C4D9',
    100: '#DEE3ED',
    50: '#F2F4F8',
  },
  gold: {
    900: '#332809',
    800: '#544210',
    700: '#7D6318',
    600: '#A6821F',
    500: '#C9A227',
    400: '#D3AC3C',
    300: '#DFBE55',
    200: '#EBD489',
    100: '#F5E9C2',
    50: '#FBF6E7',
  },
  bone: {
    400: '#D6C7AC',
    300: '#E8DFD0',
    200: '#F4EFE6',
    100: '#FBF9F5',
    50: '#FFFFFF',
  },
  silver: {
    500: '#5B6570',
    400: '#78838F',
    300: '#9AA5B1',
    200: '#C3CBD3',
    100: '#DFE3E8',
    50: '#F1F3F5',
  },
  danger: '#C4553F',
  success: '#6E8F5C',
  transparent: 'transparent',
} as const;

/** Semantic aliases — prefer these in components over raw palette steps. */
export const semanticColor = {
  backgroundPrimary: color.navy[900],
  backgroundElevated: color.navy[800],
  backgroundSunken: color.navy[950],
  surfaceCard: color.navy[700],
  surfaceCardBorder: color.navy[600],
  borderSubtle: color.navy[600],
  borderStrong: color.gold[500],
  textPrimary: color.bone[200],
  textOnLight: color.navy[900],
  textSecondary: color.silver[300],
  textMuted: color.silver[400],
  accentPrimary: color.gold[500],
  accentPrimaryPressed: color.gold[600],
  accentOnAccent: color.navy[950],
  danger: color.danger,
  success: color.success,
  focusRing: color.gold[400],
} as const;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 56,
  '5xl': 72,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const borderWidth = {
  hairline: 1,
  thin: 1.5,
  thick: 2,
} as const;

/** Type scale. `lineHeight` is expressed as an absolute px value, matched to
 * fontSize to keep vertical rhythm consistent and legible at Dynamic Type
 * scale-up. */
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700', tracking: -0.3 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '700', tracking: -0.2 },
  h2: { fontSize: 21, lineHeight: 27, fontWeight: '700', tracking: -0.1 },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600', tracking: 0 },
  bodyLg: { fontSize: 17, lineHeight: 24, fontWeight: '400', tracking: 0 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400', tracking: 0 },
  bodySm: { fontSize: 13, lineHeight: 18, fontWeight: '400', tracking: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', tracking: 0.2 },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    tracking: 1.2,
  },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '700', tracking: 0.1 },
} as const;

export type TypographyToken = keyof typeof typography;

/** Accessibility constants. */
export const a11y = {
  /** Apple HIG / Android minimum recommended touch target. */
  minTouchTarget: 44,
  /** Minimum contrast-safe body text size before Dynamic Type scaling. */
  minBodyFontSize: 13,
};

export const motion = {
  fast: 120,
  normal: 200,
  slow: 320,
};
