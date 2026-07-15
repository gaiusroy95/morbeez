import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  composeRecommendationGroupsFromIssues,
  defaultIssueRecommendationLine,
} from '../../packages/shared/src/visit-wizard/recommendation-material.js';

describe('composeRecommendationGroupsFromIssues', () => {
  it('groups materials from different issues by day and application type', () => {
    const iron = { ...defaultIssueRecommendationLine('m1'), technicalName: 'EDTA Fe', applicationDay: 0 };
    const zinc = {
      ...defaultIssueRecommendationLine('m2'),
      technicalName: 'EDTA Zn',
      applicationDay: 0,
      applicationType: 'foliar_spray',
    };
    const soil = {
      ...defaultIssueRecommendationLine('m3'),
      technicalName: 'Ammonium sulphate',
      applicationDay: 7,
      applicationType: 'soil_drench',
    };

    const groups = composeRecommendationGroupsFromIssues([
      { localId: 'issue-iron', recommendationLines: [iron] },
      { localId: 'issue-zinc', recommendationLines: [zinc, soil] },
    ]);

    assert.equal(groups.length, 2);
    const day0 = groups.find((g) => g.applicationDay === 0 && g.applicationType === 'foliar_spray');
    const day7 = groups.find((g) => g.applicationDay === 7);
    assert.ok(day0);
    assert.equal(day0!.materials.length, 2);
    assert.equal(day0!.materials[0]!.issueLocalId, 'issue-iron');
    assert.equal(day0!.materials[1]!.issueLocalId, 'issue-zinc');
    assert.ok(day7);
    assert.equal(day7!.materials.length, 1);
    assert.equal(day7!.materials[0]!.technicalName, 'Ammonium sulphate');
  });
});
