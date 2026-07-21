import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectCaseNavIntent,
  detectCopilotIntent,
} from '../expert-case-copilot-simulation.service.js';
import { formatCaseListMessage } from '../expert-case-navigation.service.js';

describe('Expert case navigation intents', () => {
  it('detects next, previous, and list case chat commands', () => {
    assert.equal(detectCaseNavIntent('next case'), 'next');
    assert.equal(detectCaseNavIntent('previous case'), 'previous');
    assert.equal(detectCaseNavIntent('list cases'), 'list');
    assert.equal(detectCaseNavIntent('list case'), 'list');
    assert.equal(detectCopilotIntent('next case', null), 'nav_next_case');
    assert.equal(detectCopilotIntent('previous case', null), 'nav_previous_case');
    assert.equal(detectCopilotIntent('list cases', null), 'nav_list_cases');
  });

  it('formats a case list message for chat', () => {
    const text = formatCaseListMessage(
      {
        currentIndex: 2,
        total: 3,
        previousCaseId: 'a',
        nextCaseId: 'c',
        items: [
          {
            id: 'a',
            caseCode: 'AAA',
            farmerName: 'Ramesh',
            cropType: 'Ginger',
            priority: 'high',
            primaryIssue: 'Anthracnose',
            assignmentStatus: 'working',
            bucket: 'my_work',
          },
          {
            id: 'b',
            caseCode: 'BBB',
            farmerName: 'Suresh',
            cropType: 'Tomato',
            priority: 'normal',
            primaryIssue: 'Blight',
            assignmentStatus: 'working',
            bucket: 'my_work',
          },
        ],
      },
      'en'
    );
    assert.match(text, /Case list \(2\/3\)/);
    assert.match(text, /AAA · Ramesh/);
    assert.match(text, /next case/i);
  });
});
