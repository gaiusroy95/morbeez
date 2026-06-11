import { supabase } from '../../lib/supabase.js';
import { blockService } from '../core/block.service.js';
import { farmerAuthService } from '../auth/farmer-auth.service.js';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type PriceRow = {
  market_name: string;
  price_per_kg: number;
  last_year_price_per_kg?: number | null;
  price_change_inr?: number | null;
  price_date?: string;
};

export type CropMarketItem = {
  id: string;
  cropName: string;
  icon: string | null;
  displayOrder: number;
};

export type MarketItem = {
  id: string;
  marketName: string;
  district: string | null;
  isPreferred: boolean;
};

function cropLabel(crop: string): string {
  const c = crop.trim().toLowerCase();
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function trendFromYoY(price: number, last: number | null): 'up' | 'down' | 'flat' | null {
  if (last == null) return null;
  if (price > last * 1.02) return 'up';
  if (price < last * 0.98) return 'down';
  return 'flat';
}

function weeklyTrendPct(current: number, previous: number | null): number | null {
  if (previous == null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

async function listActiveCrops(): Promise<CropMarketItem[]> {
  const { data } = await supabase
    .from('crop_markets')
    .select('id, crop_name, icon, display_order')
    .eq('active_status', true)
    .order('display_order')
    .order('crop_name');

  if (data?.length) {
    return data.map((r) => ({
      id: String(r.id),
      cropName: String(r.crop_name),
      icon: r.icon != null ? String(r.icon) : null,
      displayOrder: Number(r.display_order ?? 100),
    }));
  }

  return [
    { id: 'ginger', cropName: 'ginger', icon: '🫚', displayOrder: 10 },
    { id: 'pepper', cropName: 'pepper', icon: '🌶️', displayOrder: 20 },
    { id: 'banana', cropName: 'banana', icon: '🍌', displayOrder: 30 },
    { id: 'turmeric', cropName: 'turmeric', icon: '🟡', displayOrder: 40 },
    { id: 'cardamom', cropName: 'cardamom', icon: '🟢', displayOrder: 50 },
  ];
}

async function fetchPriceRows(crop: string, today: string, marketName?: string) {
  let query = supabase
    .from('crop_daily_prices')
    .select('market_name, price_per_kg, last_year_price_per_kg, price_change_inr, price_date')
    .eq('crop_type', crop.toLowerCase())
    .eq('price_date', today)
    .eq('active', true)
    .order('market_name')
    .limit(20);

  if (marketName) query = query.eq('market_name', marketName);

  const { data: rows } = await query;

  if (rows?.length) return { date: today, rows };

  let fallbackQuery = supabase
    .from('crop_daily_prices')
    .select('market_name, price_per_kg, last_year_price_per_kg, price_change_inr, price_date')
    .eq('crop_type', crop.toLowerCase())
    .eq('active', true)
    .order('price_date', { ascending: false })
    .limit(marketName ? 1 : 10);

  if (marketName) fallbackQuery = fallbackQuery.eq('market_name', marketName);

  const { data: fallback } = await fallbackQuery;

  if (!fallback?.length) return { date: today, rows: [] as PriceRow[] };
  return { date: String(fallback[0].price_date), rows: fallback as PriceRow[] };
}

async function computeDailyChange(crop: string, marketName: string, date: string, price: number) {
  const d = new Date(`${date}T12:00:00+05:30`);
  d.setDate(d.getDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);

  const { data: prev } = await supabase
    .from('crop_daily_prices')
    .select('price_per_kg')
    .eq('crop_type', crop.toLowerCase())
    .eq('market_name', marketName)
    .eq('price_date', yesterday)
    .eq('active', true)
    .maybeSingle();

  if (prev?.price_per_kg != null) {
    return Math.round((price - Number(prev.price_per_kg)) * 100) / 100;
  }
  return null;
}

async function computeWeeklyTrendPct(crop: string, marketName: string, date: string, todayPrice: number) {
  const end = new Date(`${date}T12:00:00+05:30`);
  const weekAgo = new Date(end);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: row } = await supabase
    .from('crop_daily_prices')
    .select('price_per_kg')
    .eq('crop_type', crop.toLowerCase())
    .eq('market_name', marketName)
    .eq('price_date', weekAgo.toISOString().slice(0, 10))
    .eq('active', true)
    .maybeSingle();

  if (row?.price_per_kg != null) {
    return weeklyTrendPct(todayPrice, Number(row.price_per_kg));
  }
  return null;
}

async function fetchMonthlySeries(crop: string, marketName: string, insightDate: string) {
  const end = new Date(`${insightDate}T12:00:00+05:30`);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  start.setMonth(0);
  start.setDate(1);

  const { data: histRows } = await supabase
    .from('market_historical_prices')
    .select('year, month, average_price')
    .eq('crop', crop.toLowerCase())
    .eq('market_name', marketName)
    .gte('year', start.getFullYear() - 1)
    .lte('year', end.getFullYear());

  const histByKey: Record<string, number> = {};
  for (const h of histRows ?? []) {
    histByKey[`${h.year}-${h.month}`] = Number(h.average_price);
  }

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
  const byMonth: Record<string, { cy?: number; py?: number }> = {};

  for (const row of rows ?? []) {
    const d = String(row.price_date);
    const y = Number(d.slice(0, 4));
    const m = Number(d.slice(5, 7));
    const key = String(m);
    if (!byMonth[key]) byMonth[key] = {};
    const price = Number(row.price_per_kg);
    if (y === currentYear) byMonth[key].cy = price;
    if (y === currentYear - 1) byMonth[key].py = price;
  }

  for (let m = 1; m <= 12; m += 1) {
    const key = String(m);
    if (!byMonth[key]) byMonth[key] = {};
    const cyHist = histByKey[`${currentYear}-${m}`];
    const pyHist = histByKey[`${currentYear - 1}-${m}`];
    if (byMonth[key].cy == null && cyHist != null) byMonth[key].cy = cyHist;
    if (byMonth[key].py == null && pyHist != null) byMonth[key].py = pyHist;
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

function filterPointsByRange(
  points: Array<{ month: number; monthLabel: string; currentYear: number | null; previousYear: number | null }>,
  range?: string
) {
  const r = (range ?? '1Y').toUpperCase();
  const nowMonth = new Date().getMonth() + 1;
  if (r === '1M') {
    const start = Math.max(1, nowMonth - 1);
    return points.filter((p) => p.month >= start && p.month <= nowMonth);
  }
  if (r === '3M') {
    const start = Math.max(1, nowMonth - 2);
    return points.filter((p) => p.month >= start && p.month <= nowMonth);
  }
  if (r === '5Y') return points;
  return points.filter((p) => p.month <= nowMonth);
}

function buildTrendInsights(
  crop: string,
  points: Array<{ month: number; monthLabel: string; currentYear: number | null; previousYear: number | null }>
): string[] {
  const insights: string[] = [];
  const withBoth = points.filter((p) => p.currentYear != null && p.previousYear != null);
  if (withBoth.length) {
    const avgCy = withBoth.reduce((s, p) => s + (p.currentYear ?? 0), 0) / withBoth.length;
    const avgPy = withBoth.reduce((s, p) => s + (p.previousYear ?? 0), 0) / withBoth.length;
    if (avgCy > avgPy * 1.03) insights.push('Prices stronger than last year.');
    else if (avgCy < avgPy * 0.97) insights.push('Prices weaker than last year.');
    else insights.push('Prices tracking close to last year.');
  }

  const rising = points.filter(
    (p) => p.currentYear != null && p.previousYear != null && p.currentYear > p.previousYear * 1.05
  );
  if (rising.length >= 2) {
    const months = rising.map((p) => p.monthLabel).slice(0, 3).join('–');
    insights.push(`Historically prices rise during ${months}.`);
  }

  const latest = [...points].reverse().find((p) => p.currentYear != null && p.previousYear != null);
  if (latest) {
    const dir = latest.currentYear! > latest.previousYear! ? 'Price Up' : latest.currentYear! < latest.previousYear! ? 'Price Down' : 'Stable';
    insights.push(`${dir} vs same month last year.`);
  }

  if (!insights.length) insights.push(`Check ${cropLabel(crop)} prices regularly for seasonal movement.`);
  return insights.slice(0, 3);
}

function opportunitySignal(yoyPct: number | null, weeklyPct: number | null): 'strong' | 'weak' | 'neutral' {
  const score = (yoyPct ?? 0) + (weeklyPct ?? 0) * 0.5;
  if (score >= 5) return 'strong';
  if (score <= -5) return 'weak';
  return 'neutral';
}

function mapPriceRow(r: PriceRow) {
  const price = Number(r.price_per_kg);
  const last = r.last_year_price_per_kg != null ? Number(r.last_year_price_per_kg) : null;
  const yoyPct = last != null ? Math.round(((price - last) / last) * 100) : null;
  return {
    marketName: String(r.market_name),
    pricePerKg: price,
    lastYearPricePerKg: last,
    trend: trendFromYoY(price, last),
    yoyPct,
  };
}

export const farmerMarketPortalService = {
  async listCrops(): Promise<CropMarketItem[]> {
    return listActiveCrops();
  },

  async listMarkets(_farmerId: string, crop: string): Promise<MarketItem[]> {
    const { data } = await supabase
      .from('markets')
      .select('id, market_name, district, is_preferred')
      .eq('active_status', true)
      .order('display_order')
      .order('market_name');

    if (data?.length) {
      return data.map((m) => ({
        id: String(m.id),
        marketName: String(m.market_name),
        district: m.district != null ? String(m.district) : null,
        isPreferred: Boolean(m.is_preferred),
      }));
    }

    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await fetchPriceRows(crop, today);
    return (rows ?? []).map((r, idx) => ({
      id: String(r.market_name),
      marketName: String(r.market_name),
      district: null,
      isPreferred: idx === 0,
    }));
  },

  async getDashboard(farmerId: string, crop?: string, market?: string) {
    const profile = await farmerAuthService.me(farmerId);
    const block = await blockService.getPrimaryBlock(farmerId);
    const crops = await listActiveCrops();
    const cropType = (crop ?? block?.crop_type ?? crops[0]?.cropName ?? 'ginger').toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const { date, rows } = await fetchPriceRows(cropType, today, market);

    const mapped = (rows ?? []).map(mapPriceRow);
    const preferredMarket = market ?? mapped[0]?.marketName ?? 'Kochi';
    const top = mapped.find((m) => m.marketName === preferredMarket) ?? mapped[0];

    let dailyChangeInr = top && rows?.[0]?.price_change_inr != null ? Number(rows[0].price_change_inr) : null;
    if (top && dailyChangeInr == null) {
      dailyChangeInr = await computeDailyChange(cropType, top.marketName, date, top.pricePerKg);
    }

    const weeklyTrendPctVal =
      top != null ? await computeWeeklyTrendPct(cropType, top.marketName, date, top.pricePerKg) : null;

    const lastYearSameDayPricePerKg = top?.lastYearPricePerKg ?? null;
    const differenceInr =
      top && lastYearSameDayPricePerKg != null
        ? Math.round(top.pricePerKg - lastYearSameDayPricePerKg)
        : null;
    const yesterdayPrice =
      top && dailyChangeInr != null ? top.pricePerKg - dailyChangeInr : null;
    const dailyChangePct =
      dailyChangeInr != null && yesterdayPrice != null && yesterdayPrice > 0
        ? Math.round((dailyChangeInr / yesterdayPrice) * 1000) / 10
        : null;

    const districtLabel = profile.district ?? profile.state ?? 'Your district';
    const favoriteCrop = block?.crop_type?.toLowerCase() ?? cropType;

    return {
      crop: cropType,
      favoriteCrop,
      crops,
      date,
      districtLabel,
      selectedMarket: top?.marketName ?? null,
      primaryMarket: top?.marketName ?? null,
      todayPrice: top?.pricePerKg ?? null,
      dailyChangeInr,
      dailyTrend: dailyChangeInr != null ? (dailyChangeInr > 0 ? 'up' : dailyChangeInr < 0 ? 'down' : 'flat') : null,
      weeklyTrendPct: weeklyTrendPctVal,
      yoyPct: top?.yoyPct ?? null,
      lastYearSameDayPricePerKg,
      differenceInr,
      dailyChangePct,
      trend: top?.trend ?? null,
      priceDirection:
        top?.yoyPct != null
          ? top.yoyPct > 3
            ? 'strong'
            : top.yoyPct < -3
              ? 'weak'
              : 'neutral'
          : 'neutral',
      rows: mapped,
    };
  },

  async getTrends(farmerId: string, crop?: string, range?: string, market?: string) {
    const block = await blockService.getPrimaryBlock(farmerId);
    const crops = await listActiveCrops();
    const cropType = (crop ?? block?.crop_type ?? crops[0]?.cropName ?? 'ginger').toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const { date, rows } = await fetchPriceRows(cropType, today, market);
    const marketName = market ?? (rows?.[0]?.market_name ? String(rows[0].market_name) : 'Kochi');
    const allPoints = await fetchMonthlySeries(cropType, marketName, date);
    const points = filterPointsByRange(allPoints, range);
    const insights = buildTrendInsights(cropType, allPoints);

    const seasonal = points.map((p) => ({
      month: p.monthLabel,
      currentYear: p.currentYear,
      previousYear: p.previousYear,
    }));

    const overlayCurrent = points
      .filter((p) => p.currentYear != null)
      .map((p) => ({ label: p.monthLabel.slice(0, 3), value: p.currentYear! }));
    const overlayPrevious = points
      .filter((p) => p.previousYear != null)
      .map((p) => ({ label: p.monthLabel.slice(0, 3), value: p.previousYear! }));

    return {
      crop: cropType,
      marketName,
      date,
      range: (range ?? '1Y').toUpperCase(),
      points,
      seasonal,
      overlayCurrent,
      overlayPrevious,
      insights,
      priceDirection: insights.some((i) => i.includes('Price Up') || i.includes('stronger'))
        ? 'up'
        : insights.some((i) => i.includes('Price Down') || i.includes('weaker'))
          ? 'down'
          : 'flat',
    };
  },

  async getMandiComparison(farmerId: string, crop?: string, market?: string) {
    const block = await blockService.getPrimaryBlock(farmerId);
    const cropType = (crop ?? block?.crop_type ?? 'ginger').toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const { date, rows } = await fetchPriceRows(cropType, today);

    const mapped = (rows ?? []).map(mapPriceRow);
    let highest = mapped[0];
    for (const m of mapped) {
      if (m.pricePerKg > (highest?.pricePerKg ?? 0)) highest = m;
    }

    const preferredMarket = market ?? highest?.marketName ?? null;

    return {
      crop: cropType,
      date,
      preferredMarket,
      highestMarket: highest?.marketName ?? null,
      rows: mapped.map((r) => ({
        ...r,
        isHighest: r.marketName === highest?.marketName,
        isPreferred: preferredMarket != null && r.marketName === preferredMarket,
      })),
    };
  },

  async getMultiCropComparison(farmerId: string, market?: string) {
    const block = await blockService.getPrimaryBlock(farmerId);
    const defaultMarket = market ?? 'Kochi';
    const crops = await listActiveCrops();
    const today = new Date().toISOString().slice(0, 10);
    const favoriteCrop = block?.crop_type?.toLowerCase() ?? null;

    const items = await Promise.all(
      crops.map(async (c) => {
        const { date, rows } = await fetchPriceRows(c.cropName, today, market);
        const row = rows?.find((r) => String(r.market_name) === defaultMarket) ?? rows?.[0];
        if (!row) {
          return {
            crop: c.cropName,
            icon: c.icon,
            marketName: defaultMarket,
            pricePerKg: null as number | null,
            yoyPct: null as number | null,
            weeklyTrendPct: null as number | null,
            trend: null as 'up' | 'down' | 'flat' | null,
            signal: 'neutral' as const,
            date: today,
          };
        }
        const mapped = mapPriceRow(row);
        const weekly = await computeWeeklyTrendPct(c.cropName, mapped.marketName, date, mapped.pricePerKg);
        return {
          crop: c.cropName,
          icon: c.icon,
          marketName: mapped.marketName,
          pricePerKg: mapped.pricePerKg,
          yoyPct: mapped.yoyPct,
          weeklyTrendPct: weekly,
          trend: mapped.trend,
          signal: opportunitySignal(mapped.yoyPct, weekly),
          date,
        };
      })
    );

    const ranked = [...items].filter((i) => i.pricePerKg != null).sort((a, b) => (b.pricePerKg ?? 0) - (a.pricePerKg ?? 0));
    const bestCrop = ranked[0]?.crop ?? null;

    return {
      marketName: defaultMarket,
      date: items[0]?.date ?? today,
      favoriteCrop,
      bestCrop,
      crops: items,
    };
  },

  async adminListCropMarkets() {
    const { data, error } = await supabase
      .from('crop_markets')
      .select('*')
      .order('display_order')
      .order('crop_name');
    if (error) throw error;
    return data ?? [];
  },

  async adminUpsertCropMarket(body: {
    id?: string;
    cropName: string;
    icon?: string | null;
    activeStatus?: boolean;
    displayOrder?: number;
  }) {
    const payload = {
      crop_name: body.cropName.toLowerCase().trim(),
      icon: body.icon ?? null,
      active_status: body.activeStatus ?? true,
      display_order: body.displayOrder ?? 100,
      updated_at: new Date().toISOString(),
    };

    if (body.id) {
      const { data, error } = await supabase
        .from('crop_markets')
        .update(payload)
        .eq('id', body.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase.from('crop_markets').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },

  async adminArchiveCropMarket(id: string) {
    const { error } = await supabase
      .from('crop_markets')
      .update({ active_status: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
