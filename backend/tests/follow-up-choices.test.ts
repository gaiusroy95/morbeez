import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFollowUpChoices } from '../src/services/whatsapp/pipeline/follow-up-question.types.js';

describe('resolveFollowUpChoices', () => {
  it('falls back to yes/no when EVSI stores empty choices array', () => {
    const choices = resolveFollowUpChoices({
      question: {
        id: 'ginger_blast_black_dots',
        kind: 'yes_no',
        choices: [],
      },
      storedChoices: [],
    });

    assert.deepEqual(
      choices.map((c) => c.id),
      ['yes', 'no']
    );
  });

  it('accepts typed no against resolved choices', () => {
    const choices = resolveFollowUpChoices({
      question: { id: 'q1', kind: 'yes_no', choices: [] },
      storedChoices: [],
    });
    const choiceIds = new Set(choices.map((c) => c.id));
    assert.equal(choiceIds.has('no'), true);
  });
});
