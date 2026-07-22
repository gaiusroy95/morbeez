function esc(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
const TREND_COLORS = {
    strong_increase: '#1a7f37',
    slight_increase: '#2da44e',
    stable: '#0969da',
    slight_decrease: '#cf222e',
    strong_decrease: '#a40e26',
};
function chartPaths(payload) {
    const pts = payload.chart.points;
    const values = pts.flatMap((p) => [p.currentYear, p.previousYear].filter((v) => v != null));
    const yMax = Math.max(200, ...values, 1);
    const w = 720;
    const h = 200;
    const left = 80;
    const top = 40;
    const toX = (i) => left + (i / 11) * w;
    const toY = (v) => top + h - (v / yMax) * h;
    const cyParts = [];
    const pyParts = [];
    pts.forEach((p, i) => {
        if (p.currentYear != null) {
            const x = toX(i);
            const y = toY(p.currentYear);
            cyParts.push(`${cyParts.length ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`);
        }
        if (p.previousYear != null) {
            const x = toX(i);
            const y = toY(p.previousYear);
            pyParts.push(`${pyParts.length ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`);
        }
    });
    return { cy: cyParts.join(' '), py: pyParts.join(' '), yMax };
}
export function renderMarketInsightSvg(payload) {
    const { cy, py, yMax } = chartPaths(payload);
    const cards = payload.cropCards
        .map((card, i) => {
        const x = 40 + i * 270;
        const color = TREND_COLORS[card.trendStatus] ?? '#0969da';
        const arrow = card.yoyPct == null ? '→' : card.yoyPct > 0 ? '↑' : card.yoyPct < 0 ? '↓' : '→';
        return `
      <g transform="translate(${x}, 200)">
        <rect width="250" height="150" rx="12" fill="#f6f8fa" stroke="#d0d7de"/>
        <text x="16" y="32" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#1f2328">${esc(card.label)}</text>
        <text x="16" y="72" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="800" fill="#1f2328">₹${Math.round(card.pricePerKg)} /kg</text>
        <text x="16" y="98" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#656d76">${esc(arrow)} ${esc(card.yoyLabel)}</text>
        <rect x="16" y="112" width="140" height="26" rx="13" fill="${color}"/>
        <text x="86" y="130" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#fff">${esc(card.statusText)}</text>
      </g>`;
    })
        .join('');
    const chartLabels = payload.chart.points
        .map((p, i) => {
        const x = 120 + (i / 11) * 720;
        return `<text x="${x}" y="395" text-anchor="middle" font-size="11" fill="#656d76">${p.monthLabel}</text>`;
    })
        .join('');
    const pointLabels = payload.chart.points
        .map((p, i) => {
        if (p.currentYear == null)
            return '';
        const x = 120 + (i / 11) * 720;
        const y = 40 + 200 - (p.currentYear / yMax) * 200;
        return `<text x="${x}" y="${y - 6}" text-anchor="middle" font-size="10" font-weight="600" fill="#1a7f37">${Math.round(p.currentYear)}</text>`;
    })
        .join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1680" viewBox="0 0 1200 1680">
  <rect width="1200" height="1680" fill="#ffffff"/>
  <rect width="1200" height="120" fill="#0d4f2c"/>
  <text x="40" y="48" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="800" fill="#ffffff">Morbeez</text>
  <text x="40" y="78" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#b8e6c8">Agriculture Intelligence</text>
  <text x="40" y="155" font-family="Segoe UI, Arial, sans-serif" font-size="36" font-weight="800" fill="#0d4f2c">MARKET INSIGHTS</text>
  <text x="40" y="185" font-family="Segoe UI, Arial, sans-serif" font-size="16" fill="#656d76">Smart Market Update for Smart Farmers</text>

  <rect x="820" y="28" width="340" height="72" rx="8" fill="#f6f8fa" stroke="#d0d7de"/>
  <text x="840" y="58" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#1f2328">${esc(payload.dateHeader)}</text>
  <text x="840" y="82" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#656d76">${esc(payload.weather.conditionLabel)} · ${payload.weather.tempC}°C | ${payload.weather.humidityPct}% Humidity</text>

  <rect x="40" y="210" width="1120" height="36" rx="18" fill="#1a7f37"/>
  <text x="600" y="234" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700" fill="#ffffff">${esc(payload.marketLabel)}</text>

  ${cards}

  <text x="40" y="400" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#1f2328">${esc(payload.chart.cropLabel.toUpperCase())} PRICE TREND COMPARISON (${esc(payload.chart.unit)})</text>
  <rect x="40" y="420" width="800" height="280" rx="12" fill="#fafbfc" stroke="#d0d7de"/>
  <line x1="120" y1="240" x2="120" y2="360" stroke="#d0d7de"/>
  <line x1="120" y1="360" x2="840" y2="360" stroke="#d0d7de"/>
  ${chartLabels}
  ${cy ? `<path d="${cy}" fill="none" stroke="#1a7f37" stroke-width="3"/>` : ''}
  ${py ? `<path d="${py}" fill="none" stroke="#0969da" stroke-width="2" stroke-dasharray="8 6"/>` : ''}
  ${pointLabels}
  <rect x="40" y="720" width="800" height="64" rx="8" fill="#dafbe1" stroke="#4ae168"/>
  <text x="56" y="748" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#1f2328">💡 ${esc(payload.chart.summary)}</text>

  <rect x="860" y="420" width="300" height="360" rx="12" fill="#f6f8fa" stroke="#d0d7de"/>
  <text x="880" y="452" font-size="13" font-weight="700" fill="#1f2328">Weather Impact</text>
  <text x="880" y="478" font-size="12" fill="#424a53">${esc(payload.insights.weatherImpact)}</text>
  <text x="880" y="520" font-size="13" font-weight="700" fill="#1f2328">Market Forecast</text>
  <text x="880" y="546" font-size="12" fill="#424a53">${esc(payload.insights.marketForecast)}</text>
  <text x="880" y="588" font-size="13" font-weight="700" fill="#1f2328">Actionable Advice</text>
  <text x="880" y="614" font-size="12" fill="#424a53">${esc(payload.insights.advice)}</text>

  <rect x="860" y="800" width="300" height="80" rx="8" fill="#e8f5e9" stroke="#1a7f37"/>
  <text x="880" y="830" font-size="11" fill="#1f2328">${esc(payload.joinCta)}</text>

  <rect y="1620" width="1200" height="60" fill="#0d4f2c"/>
  <text x="600" y="1650" text-anchor="middle" font-size="13" font-weight="600" fill="#ffffff">Trusted Data. Local Markets. Smarter Decisions.</text>
  <text x="600" y="1670" text-anchor="middle" font-size="11" fill="#b8e6c8">Powered by Morbeez Agriculture Intelligence</text>
</svg>`;
}
//# sourceMappingURL=market-insight-template.js.map