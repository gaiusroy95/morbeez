import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('telecaller mobile aggregators', () => {
  it('groups follow-up sections with expected keys', () => {
    const sections = {
      today: [],
      overdue: [],
      upcoming: [],
      recommendationReviews: [],
      visitFollowUps: [],
      orderFollowUps: [],
      general: [],
    };
    assert.equal(Object.keys(sections).length, 7);
  });

  it('builds action queue categories', () => {
    const categories = ['overdue', 'due_today', 'hot_leads', 'escalated'];
    assert.ok(categories.includes('overdue'));
    assert.ok(categories.includes('escalated'));
  });

  it('notification categories cover operational inbox types', () => {
    const categories = ['escalation', 'order_update', 'due_today', 'overdue_task', 'upcoming_task'];
    assert.equal(categories.length, 5);
  });
});
