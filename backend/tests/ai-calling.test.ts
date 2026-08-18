import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCallingWindow, isWithinCallingHours, nextCallingWindowStart } from '../src/domain/ai-calling/calling-window.js';
import { daysAfterPlanting, matchProtocolForDap } from '../src/domain/ai-calling/crop-protocol.js';
import { parseFarmerIntent } from '../src/domain/ai-calling/intent.js';
import { detectCallLanguage } from '../src/domain/ai-calling/language-detect.js';
import { findPrescriptionLeak } from '../src/domain/ai-calling/no-prescribe.js';
import { scoreQualification } from '../src/domain/ai-calling/qualification-score.js';
import { escalationLadderStep, nextHealthFollowUpDays, resolveCallAction } from '../src/domain/ai-calling/rule-engine.js';
import { buildCallScript } from '../src/domain/ai-calling/scripts.js';
import { CALL_LANGUAGES, CALL_TYPES } from '../src/domain/ai-calling/types.js';

const GINGER = [
  {
    cropType: 'ginger',
    stageKey: 'sprouting',
    stageLabel: 'Sprouting',
    dapFrom: 0,
    dapTo: 30,
    promptKind: 'application' as const,
    questionEn: 'Has the recommended application for this sprouting stage been completed?',
    followUpHoursIfNo: 24,
    healthFollowUpDays: [1, 3, 7],
  },
  {
    cropType: 'ginger',
    stageKey: 'vegetative',
    stageLabel: 'Vegetative',
    dapFrom: 31,
    dapTo: 90,
    promptKind: 'application' as const,
    questionEn: 'Has the recommended application for this vegetative stage been completed?',
    followUpHoursIfNo: 24,
    healthFollowUpDays: [1, 3, 7],
  },
  {
    cropType: 'ginger',
    stageKey: 'bulking',
    stageLabel: 'Bulking',
    dapFrom: 151,
    dapTo: 210,
    promptKind: 'application' as const,
    questionEn: 'Has the recommended application for this bulking stage been completed?',
    followUpHoursIfNo: 24,
    healthFollowUpDays: [1, 3, 7],
  },
];

describe('AI farmer calling — qualification score', () => {
  it('scores a complete lead as HOT', () => {
    const result = scoreQualification({
      hasName: true,
      hasPhone: true,
      hasLocation: true,
      crop: 'ginger',
      acres: 2,
      cropAgeDays: 45,
      problemStated: true,
      requirementStated: true,
      marketingSource: 'whatsapp',
      availabilityStated: true,
    });
    assert.equal(result.band, 'HOT');
    assert.ok(result.score >= 80);
  });

  it('scores a thin lead as COLD', () => {
    const result = scoreQualification({ hasPhone: true });
    assert.equal(result.band, 'COLD');
    assert.ok(result.score < 50);
  });

  it('scores a partial profile as WARM', () => {
    const result = scoreQualification({
      hasName: true,
      hasPhone: true,
      crop: 'ginger',
      acres: 1,
      problemStated: true,
    });
    assert.equal(result.band, 'WARM');
  });
});

describe('AI farmer calling — language detect', () => {
  it('locks Malayalam from first speech even if stored preference is English', () => {
    const result = detectCallLanguage('വിളയിൽ പാടുകൾ ഉണ്ട്', 'en');
    assert.equal(result.language, 'ml');
    assert.equal(result.shouldLock, true);
    assert.equal(result.source, 'first_speech');
  });

  it('keeps stored language when speech is empty', () => {
    const result = detectCallLanguage('   ', 'ta');
    assert.equal(result.language, 'ta');
    assert.equal(result.shouldLock, false);
  });
});

describe('AI farmer calling — intent', () => {
  it('parses yes / no / worsening / opt-out', () => {
    assert.equal(parseFarmerIntent('yes applied'), 'yes_completed');
    assert.equal(parseFarmerIntent('not yet, rain'), 'no_pending');
    assert.equal(parseFarmerIntent('getting worse, yellowing'), 'worsening');
    assert.equal(parseFarmerIntent('please stop calling'), 'opt_out');
    assert.equal(parseFarmerIntent('talk to agronomist'), 'human_requested');
    assert.equal(parseFarmerIntent('leaf spots on stem'), 'symptoms');
  });
});

describe('AI farmer calling — calling window', () => {
  it('blocks DND and opt-out', () => {
    assert.equal(
      evaluateCallingWindow(new Date('2026-08-17T04:00:00.000Z'), {
        dnd: true,
        optedOut: false,
        consentOutboundCall: true,
        staffInitiated: false,
      }).reason,
      'dnd'
    );
    assert.equal(
      evaluateCallingWindow(new Date('2026-08-17T04:00:00.000Z'), {
        dnd: false,
        optedOut: true,
        consentOutboundCall: true,
        staffInitiated: false,
      }).reason,
      'opted_out'
    );
  });

  it('blocks outbound without consent unless staff-initiated', () => {
    const at = new Date('2026-08-17T04:30:00.000Z');
    assert.equal(
      evaluateCallingWindow(at, {
        dnd: false,
        optedOut: false,
        consentOutboundCall: false,
        staffInitiated: false,
      }).reason,
      'no_consent'
    );
    const staff = evaluateCallingWindow(at, {
      dnd: false,
      optedOut: false,
      consentOutboundCall: false,
      staffInitiated: true,
    });
    assert.equal(staff.reason === 'ok' || staff.reason === 'quiet_hours', true);
  });

  it('reschedules quiet hours to next 08:00 IST', () => {
    const late = new Date('2026-08-17T16:00:00.000Z');
    assert.equal(isWithinCallingHours(late), false);
    const next = nextCallingWindowStart(late);
    assert.ok(next.getTime() > late.getTime());
  });
});

describe('AI farmer calling — crop DAP protocols', () => {
  it('matches ginger vegetative at DAP 45', () => {
    const hit = matchProtocolForDap(GINGER, 'ginger', 45);
    assert.equal(hit?.stageKey, 'vegetative');
  });

  it('matches ginger sprouting at DAP 0 and bulking at 180', () => {
    assert.equal(matchProtocolForDap(GINGER, 'ginger', 0)?.stageKey, 'sprouting');
    assert.equal(matchProtocolForDap(GINGER, 'ginger', 180)?.stageKey, 'bulking');
  });

  it('computes days after planting without inventing a future crop', () => {
    const dap = daysAfterPlanting('2026-08-01T00:00:00.000Z', new Date('2026-08-17T00:00:00.000Z'));
    assert.equal(dap, 16);
  });
});

describe('AI farmer calling — rule engine', () => {
  it('YES on crop application marks completed', () => {
    const action = resolveCallAction({ callType: 'crop_application', intent: 'yes_completed' });
    assert.equal(action.kind, 'mark_completed');
  });

  it('NO schedules a reminder', () => {
    const action = resolveCallAction({
      callType: 'crop_application',
      intent: 'no_pending',
      followUpHoursIfNo: 24,
    });
    assert.equal(action.kind, 'schedule_reminder');
    if (action.kind === 'schedule_reminder') assert.equal(action.hours, 24);
  });

  it('symptoms open a ticket and worsening escalates — never a prescription', () => {
    const symptoms = resolveCallAction({ callType: 'crop_application', intent: 'symptoms' });
    assert.equal(symptoms.kind, 'open_ticket');
    const worse = resolveCallAction({ callType: 'health_follow_up', intent: 'worsening' });
    assert.equal(worse.kind, 'escalate');
  });

  it('opt-out stops calling', () => {
    assert.equal(resolveCallAction({ callType: 'reminder', intent: 'opt_out' }).kind, 'opt_out');
  });

  it('escalation ladder is assigned → backup → queue', () => {
    assert.equal(escalationLadderStep('assigned'), 'backup');
    assert.equal(escalationLadderStep('backup'), 'queue');
  });

  it('health SOP continues D+1 / D+3 / D+7', () => {
    assert.deepEqual(nextHealthFollowUpDays(0), [1, 3, 7]);
    assert.deepEqual(nextHealthFollowUpDays(1), [3, 7]);
    assert.deepEqual(nextHealthFollowUpDays(7), []);
  });
});

describe('AI farmer calling — no chemical prescription', () => {
  it('flags a leaked chemical name', () => {
    assert.equal(findPrescriptionLeak('Please spray mancozeb 2g/L'), 'mancozeb');
  });

  it('every call type and language script is clean', () => {
    for (const type of CALL_TYPES) {
      for (const language of CALL_LANGUAGES) {
        const script = buildCallScript({ type, language });
        assert.equal(findPrescriptionLeak(script.fullText), null, `${type}/${language}`);
        assert.match(script.opening, /Morbeez|automated|ഓട്ടോമേറ്റഡ്|தானியங்கி|ಸ್ವಯಂಚಾಲಿತ|स्वचालित/i);
      }
    }
  });
});
