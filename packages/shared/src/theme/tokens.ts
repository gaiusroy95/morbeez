/** Morbeez design tokens — aligned with frontend admin.css + theme farmer portal */
export const tokens = {
  green900: '#1a4d32',
  green800: '#215c3a',
  green700: '#2a6b44',
  green500: '#34b35e',
  green400: '#4bc96e',
  green100: '#e8f5ec',
  green: '#1b5e20',
  bg: '#f4f7f5',
  card: '#ffffff',
  text: '#1a2e24',
  textMuted: '#6b7c72',
  border: '#e5ebe7',
  danger: '#b91c1c',
  dangerBg: '#fef2f2',
  warning: '#b45309',
  info: '#1d4ed8',
  radius: 12,
  radiusSm: 8,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
} as const;

export type MorbeezTokens = typeof tokens;
