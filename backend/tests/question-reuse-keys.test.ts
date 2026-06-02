import { describe, expect, it } from 'vitest';
import {
  buildLooseSymptomKey,
  buildSymptomKey,
} from '../src/services/ai/question-reuse-keys.util.js';

describe('question-reuse-keys', () => {
  it('loose key matches different word order', () => {
    const a = buildLooseSymptomKey('ginger yellow spots on leaves');
    const b = buildLooseSymptomKey('leaves yellow spots ginger');
    expect(a).toBe(b);
  });

  it('loose key maps romanized hindi crop tokens', () => {
    const a = buildLooseSymptomKey('adrak peele patte');
    const b = buildLooseSymptomKey('ginger yellow leaf');
    expect(a).toBe(b);
  });

  it('exact key differs when word order changes', () => {
    const a = buildSymptomKey('ginger yellow spots');
    const b = buildSymptomKey('yellow spots ginger');
    expect(a).not.toBe(b);
  });

  it('loose key matches Kana romanized and Malayalam script sprout', () => {
    const a = buildLooseSymptomKey('Kana sprout ginger');
    const b = buildLooseSymptomKey('കണാ ginger');
    expect(a).toBe(b);
  });
});
