import { priceToPaise, formatPaise, phoneForCheckout } from '@morbeez/shared';

describe('shop helpers', () => {
  it('converts price to paise', () => {
    expect(priceToPaise('250')).toBe(25000);
  });

  it('formats paise as INR', () => {
    expect(formatPaise(49900)).toContain('499');
  });

  it('normalizes Indian phone for checkout', () => {
    expect(phoneForCheckout('+91 9876543210')).toBe('9876543210');
    expect(phoneForCheckout('919876543210')).toBe('9876543210');
  });
});

describe('cart math', () => {
  it('computes line totals', () => {
    const lines = [
      { pricePaise: 10000, quantity: 2 },
      { pricePaise: 5000, quantity: 1 },
    ];
    const total = lines.reduce((s, l) => s + l.pricePaise * l.quantity, 0);
    expect(total).toBe(25000);
  });
});
