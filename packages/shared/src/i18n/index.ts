export type AppLocale = 'en' | 'hi';

const strings: Record<AppLocale, Record<string, string>> = {
  en: {
    appTagline: 'AI-driven crop operations for Indian farmers',
    login: 'Sign in',
    mobile: 'Mobile number',
    otpSend: 'Send OTP',
    useEmail: 'Use email instead',
    home: 'Home',
    fields: 'Fields',
    scan: 'AI Scan',
    shop: 'Shop',
    profile: 'Profile',
    orders: 'Orders',
    notifications: 'Notifications',
    weatherMarket: 'Weather & market',
    roi: 'ROI',
    logout: 'Sign out',
    language: 'Language',
  },
  hi: {
    appTagline: 'भारतीय किसानों के लिए AI आधारित फसल प्रबंधन',
    login: 'साइन इन',
    mobile: 'मोबाइल नंबर',
    otpSend: 'OTP भेजें',
    useEmail: 'ईमेल से साइन इन',
    home: 'होम',
    fields: 'खेत',
    scan: 'AI स्कैन',
    shop: 'दुकान',
    profile: 'प्रोफ़ाइल',
    orders: 'ऑर्डर',
    notifications: 'सूचनाएं',
    weatherMarket: 'मौसम और बाजार',
    roi: 'ROI',
    logout: 'साइन आउट',
    language: 'भाषा',
  },
};

export function t(key: string, locale: AppLocale = 'en'): string {
  return strings[locale][key] ?? strings.en[key] ?? key;
}
