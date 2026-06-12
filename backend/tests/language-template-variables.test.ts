import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLanguageCompletion,
  renderLanguageTemplate,
  displayNameFromKey,
} from '../src/services/admin/language-template-variables.js';

describe('language template variables', () => {
  it('renders standard placeholders and legacy name', () => {
    const out = renderLanguageTemplate(
      'Hi {{FarmerName}} / {{name}}, crop {{CropName}}',
      {
        FarmerName: 'Ravi',
        CropName: 'ginger',
        Village: 'v',
        DAP: '1',
        AdvisorName: 'a',
        MobileNumber: '9',
      }
    );
    assert.match(out, /Ravi/);
    assert.match(out, /ginger/);
  });

  it('computes completion rate', () => {
    const r = computeLanguageCompletion({
      en: { bodyText: 'hello', status: 'draft' },
      hi: { bodyText: '', status: 'draft' },
      kn: { bodyText: 'x', status: 'draft' },
      ta: { bodyText: '', status: 'draft' },
      ml: { bodyText: 'y', status: 'draft' },
    });
    assert.equal(r.complete, 3);
    assert.equal(r.rate, 60);
    assert.equal(r.perLanguage.en, true);
    assert.equal(r.perLanguage.hi, false);
  });

  it('derives display name from key', () => {
    assert.equal(displayNameFromKey('welcome_farmer'), 'Welcome Farmer');
  });
});
