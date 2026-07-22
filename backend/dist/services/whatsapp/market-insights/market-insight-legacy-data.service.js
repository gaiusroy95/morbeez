import { supabase } from '../../../lib/supabase.js';
import { marketInsightAiService } from './market-insight-ai.service.js';
import { marketInsightRegionService } from './market-insight-region.service.js';
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function cropLabel(crop) {
    const c = crop.trim().toLowerCase();
    return c.charAt(0).toUpperCase() + c.slice(1);
}
function yoyPct(current, lastYear) {
    if (lastYear == null || lastYear <= 0)
        return null;
    return Math.round(((current - lastYear) / lastYear) * 100);
}
function trendStatus(pct) {
    if (pct == null)
        return 'stable';
    if (pct >= 12)
        return 'strong_increase';
    if (pct >= 3)
        return 'slight_increase';
    if (pct <= -12)
        return 'strong_decrease';
    if (pct <= -3)
        return 'slight_decrease';
    return 'stable';
}
function statusText(status) {
    const map = {
        strong_increase: 'Strong Increase',
        slight_increase: 'Slight Increase',
        stable: 'Stable',
        slight_decrease: 'Slight Decrease',
        strong_decrease: 'Strong Decrease',
    };
    return map[status];
}
function yoyLabel(pct) {
    if (pct == null)
        return 'No prior-year data';
    const abs = Math.abs(pct);
    const dir = pct > 0 ? 'higher' : pct < 0 ? 'lower' : 'same as';
    if (pct === 0)
        return 'Same as last year';
    return `${abs}% ${dir} than last year`;
}
function formatDateHeader(isoDate) {
    const d = new Date(`${isoDate}T12:00:00+05:30`);
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long',
    }).format(d);
}
function buildInsights(params) {
    const crop = cropLabel(params.chartCrop);
    const place = params.districtLabel;
    let weatherImpact = `Weather in ${place} is within normal range for the season.`;
    if (params.heavyRain || params.rainMm >= 10) {
        weatherImpact = `Heavy rainfall in ${place} is reducing arrivals in the market.`;
    }
    else if (params.rainMm >= 3) {
        weatherImpact = `Rain in ${place} may slow fresh arrivals at local mandis.`;
    }
    let marketForecast = `${crop} prices are tracking close to last year.`;
    if (params.yoyPct != null) {
        if (params.yoyPct >= 8) {
            marketForecast = `${crop} prices likely to remain strong in the short term.`;
        }
        else if (params.yoyPct <= -8) {
            marketForecast = `${crop} prices may stay soft until arrivals pick up.`;
        }
    }
    let advice = 'Check mandi rates before deciding to sell today.';
    if (params.yoyPct != null && params.yoyPct >= 10 && (params.heavyRain || params.rainMm >= 8)) {
        advice = 'Farmers may get better prices if they hold stock for the next 7–10 days.';
    }
    else if (params.yoyPct != null && params.yoyPct <= -8) {
        advice = 'Consider selling soon if quality is good — arrivals may increase after rain.';
    }
    return { weatherImpact, marketForecast, advice };
}
function chartSummary(crop, yoy, rainMm) {
    const name = cropLabel(crop);
    if (yoy == null) {
        return `${name} monthly trend from published mandi prices (prior-year comparison where available).`;
    }
    const abs = Math.abs(yoy);
    const dir = yoy > 0 ? 'above' : yoy < 0 ? 'below' : 'in line with';
    const rainBit = rainMm >= 10 ? ' due to reduced arrivals caused by heavy rainfall' : rainMm >= 3 ? ' with rain affecting arrivals' : '';
    return `${name} prices are currently tracking ${abs}% ${dir} last year's trend${rainBit}.`;
}
async function fetchTodayPrice(crop, marketName, insightDate) {
    const { data } = await supabase
        .from('crop_daily_prices')
        .select('price_per_kg, last_year_price_per_kg')
        .eq('crop_type', crop)
        .eq('market_name', marketName)
        .eq('price_date', insightDate)
        .eq('active', true)
        .maybeSingle();
    if (!data)
        return null;
    return {
        price: Number(data.price_per_kg),
        lastYear: data.last_year_price_per_kg != null ? Number(data.last_year_price_per_kg) : null,
    };
}
async function fetchMonthlySeries(crop, marketName, insightDate) {
    const end = new Date(`${insightDate}T12:00:00+05:30`);
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    start.setMonth(0);
    start.setDate(1);
    const { data: rows } = await supabase
        .from('crop_daily_prices')
        .select('price_per_kg, price_date')
        .eq('crop_type', crop)
        .eq('market_name', marketName)
        .eq('active', true)
        .gte('price_date', start.toISOString().slice(0, 10))
        .lte('price_date', insightDate)
        .order('price_date', { ascending: true });
    const currentYear = end.getFullYear();
    const prevYear = currentYear - 1;
    const byMonth = {};
    for (const row of rows ?? []) {
        const d = String(row.price_date);
        const y = Number(d.slice(0, 4));
        const m = Number(d.slice(5, 7));
        const key = String(m);
        if (!byMonth[key])
            byMonth[key] = {};
        const price = Number(row.price_per_kg);
        if (y === currentYear)
            byMonth[key].cy = price;
        if (y === prevYear)
            byMonth[key].py = price;
    }
    return MONTH_LABELS.map((monthLabel, idx) => {
        const m = idx + 1;
        const slot = byMonth[String(m)] ?? {};
        return {
            month: m,
            monthLabel,
            currentYear: slot.cy ?? null,
            previousYear: slot.py ?? null,
        };
    });
}
export const marketInsightLegacyDataService = {
    async build(params) {
        const chartCrop = String(params.profile.chart_crop ?? 'ginger').toLowerCase();
        const cropCards = [];
        for (const crop of params.crops) {
            const c = String(crop).toLowerCase();
            const row = await fetchTodayPrice(c, params.marketName, params.insightDate);
            if (!row) {
                return {
                    ok: false,
                    error: `Missing admin price for ${c} at ${params.marketName} on ${params.insightDate}`,
                };
            }
            const pct = yoyPct(row.price, row.lastYear);
            const status = trendStatus(pct);
            cropCards.push({
                cropType: c,
                label: cropLabel(c),
                pricePerKg: row.price,
                lastYearPricePerKg: row.lastYear,
                yoyPct: pct,
                yoyLabel: yoyLabel(pct),
                trendStatus: status,
                statusText: statusText(status),
            });
        }
        const region = await marketInsightRegionService.resolveForFarmer(params.farmerId);
        const verified = region != null ? await marketInsightAiService.fetchVerifiedWeather(region) : null;
        const weather = verified ?? {
            conditionLabel: 'Partly Cloudy',
            tempC: 28,
            humidityPct: 70,
            rainMmToday: 0,
            locationLabel: params.districtLabel,
        };
        const chartCard = cropCards.find((c) => c.cropType === chartCrop) ?? cropCards[0];
        const chartPoints = await fetchMonthlySeries(chartCrop, params.marketName, params.insightDate);
        const heavyRain = weather.rainMmToday >= 10 || weather.conditionLabel === 'Heavy Rain';
        const payload = {
            insightDate: params.insightDate,
            dateHeader: formatDateHeader(params.insightDate),
            marketLabel: String(params.profile.market_display_label),
            districtLabel: params.districtLabel,
            weather,
            cropCards,
            chart: {
                cropType: chartCrop,
                cropLabel: cropLabel(chartCrop),
                unit: '₹/kg',
                points: chartPoints,
                summary: chartSummary(chartCrop, chartCard.yoyPct, weather.rainMmToday),
            },
            insights: buildInsights({
                districtLabel: params.districtLabel,
                chartCrop,
                yoyPct: chartCard.yoyPct,
                rainMm: weather.rainMmToday,
                heavyRain,
            }),
            joinCta: "Want daily updates? Save this number and message 'JOIN MORBEEZ' on WhatsApp.",
        };
        return { ok: true, payload };
    },
};
//# sourceMappingURL=market-insight-legacy-data.service.js.map