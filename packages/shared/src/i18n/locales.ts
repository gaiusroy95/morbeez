/** UI locales — aligned with backend AdvisoryLanguage where applicable. */
export type AppLocale = 'en' | 'hi' | 'ml' | 'ta' | 'kn';

export const APP_LOCALES: AppLocale[] = ['en', 'hi', 'ml', 'ta', 'kn'];

export function isAppLocale(v: string | null | undefined): v is AppLocale {
  return v != null && (APP_LOCALES as readonly string[]).includes(v);
}

/** Labels shown in language picker (native script). */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  hi: 'हिंदी',
  ml: 'മലയാളം',
  ta: 'தமிழ்',
  kn: 'ಕನ್ನಡ',
};

/** Agriculture / product terms stay in English in every locale. */
export const KEEP_ENGLISH_KEYS = new Set<string>([
  'roi',
  'dapLabel',
  'otpSend',
  'otpCode',
  'otpVerify',
  'useOtp',
  'dashboard',
  'followUp',
  'callbacks',
  'escalations',
  'aiReview',
  'findingReview',
  'reminder',
  'lead',
  'whatsapp',
  'whatsappAlerts',
  'whatsappSupport',
  'cod',
  'scan',
  'aiScan',
]);
