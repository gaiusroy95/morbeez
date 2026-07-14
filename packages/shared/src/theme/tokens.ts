/**
 * Morbeez design system v2 — single source for mobile (@morbeez/ui-native) and web sync.
 * Web: mirror values in frontend/src/index.css @theme and admin.css :root.
 */
export const tokens = {
  /* ── Brand greens (refined agri-tech palette) ── */
  green950: '#0d2818',
  green900: '#143d28',
  green800: '#1a5236',
  green700: '#246b45',
  green600: '#2d8554',
  green500: '#3aad62',
  green400: '#52c97a',
  green200: '#c8e8d4',
  green100: '#e6f4ec',
  green50: '#f2faf5',
  /** @deprecated use green800 */
  green: '#1a5236',

  /* ── Surfaces ── */
  bg: '#f3f6f4',
  bgSubtle: '#eaefeb',
  card: '#ffffff',
  cardMuted: '#f8faf9',

  /* ── Typography colors ── */
  text: '#122118',
  textSecondary: '#3d4f45',
  textMuted: '#667a70',
  textOnPrimary: '#ffffff',

  /* ── Borders ── */
  border: '#dde5e0',
  borderStrong: '#c5d0c8',
  borderFocus: '#3aad62',

  /* ── Semantic ── */
  primary: '#246b45',
  primaryHover: '#1a5236',
  primaryMuted: '#e6f4ec',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  warning: '#d97706',
  warningBg: '#fffbeb',
  success: '#059669',
  successBg: '#ecfdf5',
  info: '#2563eb',
  infoBg: '#eff6ff',

  /* ── Radius (px) ── */
  radiusXs: 6,
  radiusSm: 10,
  radius: 14,
  radiusLg: 18,
  radiusFull: 9999,

  /* ── Type scale (mobile; web uses Tailwind text-* ) ── */
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 22,
    '2xl': 28,
  },

  fontWeight: {
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  /* ── Spacing ── */
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
  },
} as const;

/** React Native elevation / iOS shadow presets */
export const shadow = {
  sm: {
    shadowColor: '#122118',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#122118',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#122118',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export type MorbeezTokens = typeof tokens;
