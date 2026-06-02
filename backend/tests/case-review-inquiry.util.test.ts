import { describe, expect, it } from 'vitest';
import { textsLikelySame } from '../src/services/admin/case-review-inquiry.util.js';

describe('textsLikelySame', () => {
  it('matches regional spelling variants via loose reuse keys', () => {
    expect(textsLikelySame('Kana sprout', 'കണാ sprout')).toBe(true);
  });

  it('matches identical normalized text', () => {
    expect(
      textsLikelySame('yellow spots on ginger leaves', 'yellow spots on ginger leaves')
    ).toBe(true);
  });
});
