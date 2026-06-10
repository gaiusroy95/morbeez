export const MANUAL_COURIER_OPTIONS = [
  'GRL',
  'ST Courier',
  'VRL',
  'Bus transport',
  'Local courier',
  'Customer preferred transport',
] as const;

export type ManualCourierOption = (typeof MANUAL_COURIER_OPTIONS)[number];

export type ShippingMethod = 'shiprocket' | 'manual';

export function normalizeShippingMethod(value: unknown): ShippingMethod {
  return value === 'manual' ? 'manual' : 'shiprocket';
}
