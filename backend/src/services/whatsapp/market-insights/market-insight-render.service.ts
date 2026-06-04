import sharp from 'sharp';
import { renderMarketInsightSvg } from './market-insight-template.js';
import type { MarketInsightPayload } from './market-insight.types.js';

export const marketInsightRenderService = {
  async renderPng(payload: MarketInsightPayload): Promise<Buffer> {
    const svg = renderMarketInsightSvg(payload);
    return sharp(Buffer.from(svg)).png({ quality: 92 }).toBuffer();
  },
};
