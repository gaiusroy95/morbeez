import Constants from 'expo-constants';

export const SHOP_URL =
  (Constants.expoConfig?.extra?.shopUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_SHOP_URL ||
  'https://morbeez-india.myshopify.com';

export const WHATSAPP_PHONE =
  process.env.EXPO_PUBLIC_WHATSAPP_PHONE || '917676026318';

export function whatsAppUrl(message?: string): string {
  const phone = WHATSAPP_PHONE.replace(/\D/g, '');
  const text = encodeURIComponent(message || 'Hi Morbeez, I need help with my farm.');
  return `https://wa.me/${phone}?text=${text}`;
}
