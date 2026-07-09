import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHighValueVisitQuestion,
  visitQuestionsNeedRegeneration,
} from '../src/domain/visit-ai/question-quality.js';
import { maxQuestionsForConfidence } from '../src/domain/visit-ai/question-count.js';

describe('visit question quality', () => {
  it('rejects generic symptom survey question from screenshot', () => {
    const bad =
      'What specific symptoms have you observed on the ginger plants that suggest fungal infection?';
    assert.equal(isHighValueVisitQuestion(bad, 'yes_no_unknown'), false);
  });

  it('accepts targeted yes/no diagnostic questions', () => {
    assert.equal(isHighValueVisitQuestion('Are lesions water-soaked or dry?', 'yes_no_unknown'), true);
    assert.equal(
      isHighValueVisitQuestion('Was any fungicide sprayed within the last 14 days?', 'yes_no_unknown'),
      true
    );
  });

  it('accepts severity number questions', () => {
    assert.equal(
      isHighValueVisitQuestion('Approximately what percentage of plants are affected?', 'number'),
      true
    );
  });

  it('flags stale generic batches for regeneration', () => {
    const cap = maxQuestionsForConfidence(0.83);
    assert.equal(cap, 3);
    const needs = visitQuestionsNeedRegeneration(
      [
        {
          questionText:
            'What specific symptoms have you observed on the ginger plants that suggest fungal infection?',
          answerType: 'yes_no_unknown',
        },
      ],
      cap
    );
    assert.equal(needs, true);
  });
});
