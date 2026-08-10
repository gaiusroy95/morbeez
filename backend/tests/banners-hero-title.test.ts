import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseHeroTitle, relativeStorefrontPath } from '../src/services/admin/banners-hero-title.util.js';

describe('parseHeroTitle', () => {
  it('splits three-part hero titles', () => {
    assert.deepEqual(parseHeroTitle('Science-backed CROP CARE for every Indian farmer'), {
      heading_line_1: 'Science-backed',
      heading_highlight: 'CROP CARE',
      heading_line_2: 'for every Indian farmer',
    });
  });

  it('splits two-part hero titles', () => {
    assert.deepEqual(parseHeroTitle('MORBEEZ Trusted agri inputs'), {
      heading_highlight: 'MORBEEZ',
      heading_line_2: 'Trusted agri inputs',
    });
  });

  it('falls back to heading_line_2 for plain titles', () => {
    assert.deepEqual(parseHeroTitle('Monsoon crop protection essentials'), {
      heading_line_2: 'Monsoon crop protection essentials',
    });
  });
});

describe('relativeStorefrontPath', () => {
  it('keeps relative paths', () => {
    assert.equal(relativeStorefrontPath('/collections/all'), '/collections/all');
  });

  it('extracts pathname from absolute URLs', () => {
    assert.equal(relativeStorefrontPath('https://morbeez.com/pages/contact'), '/pages/contact');
  });
});
