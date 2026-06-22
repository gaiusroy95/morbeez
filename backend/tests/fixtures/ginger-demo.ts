/** Ginger advisory demo farmer — see docs/ai-training/GINGER-ADVISORY-SAMPLES.md */
export const GINGER_DEMO_PHONE = '+916282873542';
export const GINGER_DEMO_PHONE_DIGITS = '916282873542';

export const GINGER_DEMO_BLOCKS = {
  s2: 'e0000000-0000-4000-8000-000000000012',
  s3: 'e0000000-0000-4000-8000-000000000013',
} as const;

export function isGingerDemoPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.endsWith('6282873542');
}
