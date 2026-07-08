import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maxQuestionsForConfidence } from '../src/domain/visit-ai/question-count.js';

describe('maxQuestionsForConfidence', () => {
  it('returns 0 at ≥95% confidence', () => {
    assert.equal(maxQuestionsForConfidence(0.95), 0);
    assert.equal(maxQuestionsForConfidence(0.99), 0);
  });

  it('returns 1 at 90–94%', () => {
    assert.equal(maxQuestionsForConfidence(0.9), 1);
    assert.equal(maxQuestionsForConfidence(0.94), 1);
  });

  it('returns 2 at 85–89%', () => {
    assert.equal(maxQuestionsForConfidence(0.85), 2);
    assert.equal(maxQuestionsForConfidence(0.89), 2);
  });

  it('returns 3 at 75–84%', () => {
    assert.equal(maxQuestionsForConfidence(0.75), 3);
    assert.equal(maxQuestionsForConfidence(0.83), 3);
  });

  it('returns up to 5 below 75%', () => {
    assert.equal(maxQuestionsForConfidence(0.74), 5);
    assert.equal(maxQuestionsForConfidence(0.5), 5);
  });
});
