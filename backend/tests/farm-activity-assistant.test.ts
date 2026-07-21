import assert from 'node:assert/strict';
import test from 'node:test';
import { farmActivityAssistantService } from '../src/services/farm-activity/farm-activity-assistant.service.ts';
import { looksLikeFarmActivityMessage } from '../src/services/farm-activity/farm-activity-message-intent.service.ts';

test('farm activity intent detection accepts multilingual activity language', () => {
  assert.equal(farmActivityAssistantService.looksLikeIntent('sprayed fungicide yesterday'), true);
  assert.equal(farmActivityAssistantService.looksLikeIntent('labour cost 1500 for weeding'), true);
  assert.equal(farmActivityAssistantService.looksLikeIntent('വളം ഇട്ടു'), true);
  assert.equal(
    looksLikeFarmActivityMessage(
      'I applied 19:19:19 fertilizer 70 kg, magnesium sulphate 15 kg. Took 7 labour paid ₹700 per labour.'
    ),
    true
  );
  assert.equal(farmActivityAssistantService.looksLikeIntent('hello'), false);
  assert.equal(farmActivityAssistantService.looksLikeIntent('my leaves are yellow'), false);
});

test('farm activity confirm/edit/cancel button ids are recognized', () => {
  assert.equal(farmActivityAssistantService.isActionButton('fa.confirm'), true);
  assert.equal(farmActivityAssistantService.isActionButton('fa.edit'), true);
  assert.equal(farmActivityAssistantService.isActionButton('fa.cancel'), true);
  assert.equal(farmActivityAssistantService.isActionButton('Confirm'), true);
  assert.equal(farmActivityAssistantService.isActionButton('menu.roi_tracker'), false);
});

test('farm activity session states are recognized', () => {
  assert.equal(farmActivityAssistantService.isFarmActivityState('farm_activity_confirm'), true);
  assert.equal(farmActivityAssistantService.isFarmActivityState('main_menu'), false);
});
