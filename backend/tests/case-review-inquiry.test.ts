import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickLatestOutput,
  resolveProbableIssue,
  textsLikelySame,
} from '../src/services/admin/case-review-inquiry.util.js';

describe('case review inquiry', () => {
  it('picks newest advisory output', () => {
    const latest = pickLatestOutput([
      { created_at: '2026-01-01T10:00:00Z', farmer_summary_en: 'old' },
      { created_at: '2026-06-01T10:00:00Z', farmer_summary_en: 'new reply' },
    ]);
    assert.equal(latest?.farmer_summary_en, 'new reply');
  });

  it('detects when summary equals farmer question', () => {
    const q = 'Yellow spots on ginger leaves spreading fast';
    assert.equal(textsLikelySame(q, q), true);
    assert.equal(textsLikelySame('Apply Bio NPK drench today', q), false);
  });

  it('does not use farmer question as probable issue', () => {
    const q = 'Yellow spots on ginger leaves spreading fast';
    const issue = resolveProbableIssue(
      { probable_issue: q },
      null,
      q
    );
    assert.equal(issue, null);
  });

  it('keeps AI probable issue when distinct from question', () => {
    const issue = resolveProbableIssue(
      { probable_issue: 'Thrips damage' },
      null,
      'Yellow spots on ginger leaves'
    );
    assert.equal(issue, 'Thrips damage');
  });
});
