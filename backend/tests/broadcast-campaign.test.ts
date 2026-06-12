import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderBroadcastMessage } from '../src/services/whatsapp/broadcasts/broadcast-variables.js';

describe('broadcast variable renderer', () => {
  it('substitutes all placeholders', () => {
    const out = renderBroadcastMessage(
      'Hi {{FarmerName}}, {{Crop}} at {{DAP}} DAP in {{Village}} ({{FarmArea}} ac), {{District}}.',
      {
        farmerName: 'Ravi',
        crop: 'ginger',
        dap: '45',
        village: 'Kunnamangalam',
        farmArea: '1.2',
        district: 'Kozhikode',
      }
    );
    assert.match(out, /Ravi/);
    assert.match(out, /ginger/);
    assert.match(out, /45 DAP/);
    assert.match(out, /Kunnamangalam/);
    assert.match(out, /Kozhikode/);
  });

  it('leaves unknown placeholders unchanged', () => {
    const out = renderBroadcastMessage('{{Unknown}}', {
      farmerName: 'A',
      crop: 'b',
      dap: '1',
      village: 'v',
      farmArea: '0',
      district: 'd',
    });
    assert.equal(out, '{{Unknown}}');
  });
});
