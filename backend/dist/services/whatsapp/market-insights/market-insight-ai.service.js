import { z } from 'zod';
import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import { supabase } from '../../../lib/supabase.js';
import { openaiTokenLimitBody } from '../../ai/providers/openai-chat-params.js';
import { fetchWeatherForecast } from '../pipeline/weather-fetch.service.js';
const OPENAI_BASE = 'https://api.openai.com/v1/chat/completions';
const aiCropSchema = z.object({
    cropType: z.string(),
    label: z.string().optional(),
    pricePerKg: z.number(),
    lastYearPricePerKg: z.number().nullable().optional(),
    yoyPct: z.number().nullable().optional(),
});
const aiChartPointSchema = z.object({
    month: z.number().min(1).max(12),
    monthLabel: z.string(),
    currentYear: z.number().nullable(),
    previousYear: z.number().nullable(),
});
const aiResponseSchema = z.object({
    marketDisplayLabel: z.string(),
    weather: z.object({
        conditionLabel: z.string(),
        tempC: z.number(),
        humidityPct: z.number(),
    }),
    cropCards: z.array(aiCropSchema).min(1),
    chartCrop: z.string().optional(),
    chartPoints: z.array(aiChartPointSchema).optional(),
    chartSummary: z.string().optional(),
    insights: z.object({
        weatherImpact: z.string(),
        marketForecast: z.string(),
        advice: z.string(),
    }),
});
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
function conditionFromRain(rainMm, heavyRainLikely) {
    if (heavyRainLikely || rainMm >= 15)
        return 'Heavy Rain';
    if (rainMm >= 5)
        return 'Moderate Rain';
    if (rainMm >= 1)
        return 'Light Rain';
    return 'Partly Cloudy';
}
function toCropCards(raw) {
    return raw.map((c) => {
        const cropType = String(c.cropType).toLowerCase();
        const lastYear = c.lastYearPricePerKg != null ? Number(c.lastYearPricePerKg) : null;
        const price = Number(c.pricePerKg);
        const pct = c.yoyPct != null ? Math.round(Number(c.yoyPct)) : yoyPct(price, lastYear);
        const status = trendStatus(pct);
        return {
            cropType,
            label: c.label?.trim() || cropLabel(cropType),
            pricePerKg: price,
            lastYearPricePerKg: lastYear,
            yoyPct: pct,
            yoyLabel: yoyLabel(pct),
            trendStatus: status,
            statusText: statusText(status),
        };
    });
}
function defaultChartPoints() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((monthLabel, idx) => ({
        month: idx + 1,
        monthLabel,
        currentYear: null,
        previousYear: null,
    }));
}
export const marketInsightAiService = {
    async fetchVerifiedWeather(region) {
        const lat = region.lat;
        const lon = region.lon;
        if (lat == null || lon == null)
            return null;
        const forecast = await fetchWeatherForecast({
            lat,
            lon,
            label: region.marketDisplayLabel,
        });
        return {
            conditionLabel: conditionFromRain(forecast.rainMmToday, forecast.heavyRainLikely),
            tempC: Math.round(forecast.maxTempCToday),
            humidityPct: Math.round(forecast.avgHumidityPct),
            rainMmToday: forecast.rainMmToday,
            locationLabel: `PIN ${region.pincode} — ${region.district}`,
        };
    },
    async getCached(pincode, insightDate) {
        const { data } = await supabase
            .from('market_insight_pincode_cache')
            .select('payload')
            .eq('pincode', pincode)
            .eq('insight_date', insightDate)
            .maybeSingle();
        if (!data?.payload || typeof data.payload !== 'object')
            return null;
        return data.payload;
    },
    async saveCache(pincode, insightDate, district, payload, model) {
        await supabase.from('market_insight_pincode_cache').upsert({
            pincode,
            insight_date: insightDate,
            district,
            payload,
            model,
            fetched_at: new Date().toISOString(),
        }, { onConflict: 'pincode,insight_date' });
    },
    async fetchForPincode(region, insightDate) {
        if (!env.OPENAI_API_KEY?.trim() || !env.ENABLE_MARKET_INSIGHT_OPENAI) {
            logger.warn('Market insight OpenAI fetch disabled or no API key');
            return null;
        }
        const cached = await this.getCached(region.pincode, insightDate);
        if (cached)
            return cached;
        const verifiedWeather = await this.fetchVerifiedWeather(region);
        const system = `You are Morbeez Agriculture Intelligence for Indian farmers.
Return ONLY a single JSON object (no markdown) for a daily "Market Insights" WhatsApp card.

Rules:
- Use the farmer's PIN code area: local wholesale/mandi context for that district and taluk in India.
- cropCards: exactly 4 crops — ginger, pepper, coffee, cardamom — with realistic ₹/kg wholesale prices for ${insightDate} (IST).
- Include lastYearPricePerKg and yoyPct for each crop where reasonable.
- chartCrop: "ginger". chartPoints: 12 months (Jan–Dec) with currentYear and previousYear ₹/kg for ginger at the nearest local mandi.
- insights: short practical lines (weatherImpact, marketForecast, advice) tied to weather and prices.
- If verified_weather is provided, weather.conditionLabel, tempC, humidityPct MUST match those values exactly.
- marketDisplayLabel: name of the nearest well-known local mandi/market for this pincode area.`;
        const userPayload = {
            insightDate,
            pincode: region.pincode,
            village: region.village,
            taluk: region.taluk,
            district: region.district,
            state: region.state,
            suggestedMarketLabel: region.marketDisplayLabel,
            verified_weather: verifiedWeather
                ? {
                    conditionLabel: verifiedWeather.conditionLabel,
                    tempC: verifiedWeather.tempC,
                    humidityPct: verifiedWeather.humidityPct,
                    rainMmToday: verifiedWeather.rainMmToday,
                }
                : null,
            requiredJsonShape: {
                marketDisplayLabel: 'string',
                weather: { conditionLabel: 'string', tempC: 'number', humidityPct: 'number' },
                cropCards: [
                    {
                        cropType: 'ginger|pepper|coffee|cardamom',
                        pricePerKg: 'number',
                        lastYearPricePerKg: 'number|null',
                        yoyPct: 'number|null',
                    },
                ],
                chartCrop: 'ginger',
                chartPoints: [{ month: 1, monthLabel: 'Jan', currentYear: 0, previousYear: 0 }],
                chartSummary: 'string',
                insights: { weatherImpact: 'string', marketForecast: 'string', advice: 'string' },
            },
        };
        try {
            const res = await fetch(OPENAI_BASE, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: env.OPENAI_TEXT_MODEL,
                    ...openaiTokenLimitBody(env.OPENAI_TEXT_MODEL, 2200),
                    temperature: 0.35,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: JSON.stringify(userPayload) },
                    ],
                }),
            });
            if (!res.ok) {
                logger.warn({ status: res.status }, 'Market insight OpenAI request failed');
                return null;
            }
            const data = (await res.json());
            const rawText = data.choices?.[0]?.message?.content?.trim();
            if (!rawText)
                return null;
            const parsed = aiResponseSchema.safeParse(JSON.parse(rawText));
            if (!parsed.success) {
                logger.warn({ err: parsed.error.flatten() }, 'Market insight AI JSON invalid');
                return null;
            }
            const ai = parsed.data;
            const cropCards = toCropCards(ai.cropCards);
            const chartCrop = String(ai.chartCrop ?? 'ginger').toLowerCase();
            const chartPoints = ai.chartPoints?.length === 12
                ? ai.chartPoints.map((p) => ({
                    month: p.month,
                    monthLabel: p.monthLabel,
                    currentYear: p.currentYear,
                    previousYear: p.previousYear,
                }))
                : defaultChartPoints();
            const weather = verifiedWeather
                ? {
                    conditionLabel: verifiedWeather.conditionLabel,
                    tempC: verifiedWeather.tempC,
                    humidityPct: verifiedWeather.humidityPct,
                    rainMmToday: verifiedWeather.rainMmToday,
                    locationLabel: verifiedWeather.locationLabel,
                }
                : {
                    conditionLabel: ai.weather.conditionLabel,
                    tempC: Math.round(ai.weather.tempC),
                    humidityPct: Math.round(ai.weather.humidityPct),
                    rainMmToday: 0,
                    locationLabel: `PIN ${region.pincode}`,
                };
            const payload = {
                insightDate,
                dateHeader: formatDateHeader(insightDate),
                marketLabel: ai.marketDisplayLabel.trim() || region.marketDisplayLabel,
                districtLabel: region.district,
                weather,
                cropCards,
                chart: {
                    cropType: chartCrop,
                    cropLabel: cropLabel(chartCrop),
                    unit: '₹/kg',
                    points: chartPoints,
                    summary: ai.chartSummary?.trim() ||
                        `${cropLabel(chartCrop)} price trend for ${region.district} mandis.`,
                },
                insights: ai.insights,
                joinCta: "Want daily updates? Save this number and message 'JOIN MORBEEZ' on WhatsApp.",
            };
            await this.saveCache(region.pincode, insightDate, region.district, payload, env.OPENAI_TEXT_MODEL);
            return payload;
        }
        catch (err) {
            logger.error({ err, pincode: region.pincode }, 'Market insight OpenAI fetch error');
            return null;
        }
    },
};
//# sourceMappingURL=market-insight-ai.service.js.map