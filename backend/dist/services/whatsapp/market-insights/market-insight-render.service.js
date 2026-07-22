import sharp from 'sharp';
import { renderMarketInsightSvg } from './market-insight-template.js';
export const marketInsightRenderService = {
    async renderPng(payload) {
        const svg = renderMarketInsightSvg(payload);
        return sharp(Buffer.from(svg)).png({ quality: 92 }).toBuffer();
    },
};
//# sourceMappingURL=market-insight-render.service.js.map