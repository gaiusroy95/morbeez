/** Shopify Admin price strings are INR rupees; checkout API expects paise. */
export function priceToPaise(price: string | number | null | undefined): number {
  const n = parseFloat(String(price ?? '0'));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function formatPaise(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function phoneForCheckout(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 10) return digits;
  return digits;
}
