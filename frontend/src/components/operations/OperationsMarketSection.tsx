import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { matchesSearch } from '../../lib/search-filter';
import { cropSlugFromName } from '../../lib/master-picker-utils';
import { DynamicMasterPicker } from '../DynamicMasterPicker';
import { Field, Modal, inputClass } from '../Modal';
import { StaticSelect } from '../ui';

const base = '/morbeez-staff/api/v1/os/operations';

type CropPrice = {
  id: string;
  crop_type: string;
  market_name: string;
  district: string | null;
  price_per_kg: number;
  last_year_price_per_kg?: number | null;
  updated_at?: string;
  price_date: string;
};

type DistrictWeather = {
  locationLabel: string;
  maxTempCToday: number;
  avgHumidityPct: number;
  rainMmToday: number;
  weatherRiskScore: number;
  heavyRainLikely: boolean;
  highHeatLikely: boolean;
  highHumidityLikely: boolean;
};

type FieldActivityBlock = {
  id: string;
  farmer_id: string;
  name: string;
  plot_label: string | null;
  crop_type: string;
  latitude?: number | null;
  longitude?: number | null;
};

export function OperationsMarketSection({
  canWrite,
  search,
  onError,
}: {
  canWrite: boolean;
  search: string;
  onError: (msg: string) => void;
}) {
  const mastersApi = `${base}/masters`;
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState<CropPrice[]>([]);
  const [priceViewCrop, setPriceViewCrop] = useState('ginger');
  const [priceMarketsFilter, setPriceMarketsFilter] = useState<string[]>([]);
  const [priceYearView, setPriceYearView] = useState(new Date().getFullYear());
  const [districtWeather, setDistrictWeather] = useState<DistrictWeather | null>(null);
  const [fieldBlocks, setFieldBlocks] = useState<FieldActivityBlock[]>([]);
  const [priceForm, setPriceForm] = useState({
    cropType: 'ginger',
    marketName: '',
    district: '',
    pricePerKg: '',
  });
  const [marketPrefForm, setMarketPrefForm] = useState<{ blockId: string; selectedKeys: string[] }>({
    blockId: '',
    selectedKeys: [],
  });
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [gpsForm, setGpsForm] = useState({ latitude: '', longitude: '' });
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    onError('');
    try {
      const [d, blocks] = await Promise.all([
        api<{ ok: boolean; prices: CropPrice[] }>(
          `${base}/crop-prices?crop=${encodeURIComponent(priceViewCrop)}`
        ),
        api<{ ok: boolean; blocks: FieldActivityBlock[] }>(`${base}/field-activities/blocks?limit=120`),
      ]);
      setPrices(d.prices ?? []);
      setFieldBlocks(blocks.blocks ?? []);
      const blockId = marketPrefForm.blockId || blocks.blocks?.[0]?.id || '';
      if (blockId && blockId !== marketPrefForm.blockId) {
        setMarketPrefForm((f) => ({ ...f, blockId }));
      }
      if (blockId) {
        const block = (blocks.blocks ?? []).find((b) => b.id === blockId);
        if (block?.farmer_id) {
          const pref = await api<{
            ok: boolean;
            preferences: Array<{ market_name: string; district: string | null }>;
          }>(
            `${base}/farmer-market-preferences?farmerId=${encodeURIComponent(block.farmer_id)}&cropType=${encodeURIComponent(priceViewCrop)}`
          );
          const keys = (pref.preferences ?? []).map((p) => `${p.market_name}|${p.district ?? ''}`);
          setMarketPrefForm((f) => ({ ...f, selectedKeys: keys }));
        }
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load prices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [priceViewCrop, marketPrefForm.blockId]);

  useEffect(() => {
    const district = priceForm.district?.trim();
    if (!district) {
      setDistrictWeather(null);
      return;
    }
    let cancelled = false;
    api<{ ok: boolean; weather: DistrictWeather }>(
      `${base}/weather/current?district=${encodeURIComponent(district)}`
    )
      .then((res) => {
        if (!cancelled) setDistrictWeather(res.weather ?? null);
      })
      .catch(() => {
        if (!cancelled) setDistrictWeather(null);
      });
    return () => {
      cancelled = true;
    };
  }, [priceForm.district]);

  const visiblePrices = useMemo(
    () =>
      prices.filter((p) =>
        matchesSearch(search, p.crop_type, p.market_name, p.district, String(p.price_per_kg))
      ),
    [prices, search]
  );
  const visiblePriceRows =
    priceMarketsFilter.length === 0
      ? visiblePrices
      : visiblePrices.filter((p) => priceMarketsFilter.includes(`${p.market_name}|${p.district ?? ''}`));
  const highestPrice = visiblePriceRows.reduce(
    (max, row) => (row.price_per_kg > max ? row.price_per_kg : max),
    0
  );
  const lowestPrice =
    visiblePriceRows.length > 0
      ? visiblePriceRows.reduce(
          (min, row) => (row.price_per_kg < min ? row.price_per_kg : min),
          visiblePriceRows[0].price_per_kg
        )
      : 0;
  const avgYoYPercent =
    visiblePriceRows.length > 0
      ? Math.round(
          (visiblePriceRows.reduce((sum, row) => {
            if (!row.last_year_price_per_kg || row.last_year_price_per_kg <= 0) return sum;
            return sum + ((row.price_per_kg - row.last_year_price_per_kg) / row.last_year_price_per_kg) * 100;
          }, 0) /
            visiblePriceRows.length) *
            10
        ) / 10
      : 0;

  const selectedPriceBlock =
    fieldBlocks.find((b) => b.id === marketPrefForm.blockId) ?? fieldBlocks[0] ?? null;

  async function savePrice(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    try {
      await api(`${base}/crop-prices`, {
        method: 'POST',
        body: JSON.stringify({
          cropType: priceForm.cropType,
          marketName: priceForm.marketName,
          district: priceForm.district || undefined,
          pricePerKg: Number(priceForm.pricePerKg),
        }),
      });
      setPriceForm((f) => ({ ...f, marketName: '', pricePerKg: '' }));
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save price');
    }
  }

  async function saveMarketPreferences(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || !marketPrefForm.blockId) return;
    const block = fieldBlocks.find((b) => b.id === marketPrefForm.blockId);
    if (!block?.farmer_id) return;
    try {
      const markets = marketPrefForm.selectedKeys.map((key) => {
        const [marketName, district = ''] = key.split('|');
        return { marketName, district: district || undefined };
      });
      await api(`${base}/farmer-market-preferences`, {
        method: 'POST',
        body: JSON.stringify({
          farmerId: block.farmer_id,
          cropType: priceViewCrop,
          markets,
        }),
      });
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save market preferences');
    }
  }

  async function saveBlockGps() {
    if (!canWrite || !marketPrefForm.blockId) return;
    const latitude = Number(gpsForm.latitude);
    const longitude = Number(gpsForm.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
    try {
      await api(`${base}/field-activities/blocks/${marketPrefForm.blockId}/location`, {
        method: 'PATCH',
        body: JSON.stringify({ latitude, longitude }),
      });
      setGpsModalOpen(false);
      setGpsForm({ latitude: '', longitude: '' });
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save GPS');
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading market prices…</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-5">
        {canWrite ? (
          <form
            onSubmit={savePrice}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2"
          >
            <h2 className="font-medium text-slate-900">Add Today&apos;s Price</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <DynamicMasterPicker
                masterType="crop"
                label="Crop"
                apiBase={mastersApi}
                cropValueSlug
                required
                value={priceForm.cropType}
                onChange={(_id, item) => {
                  if (!item) return;
                  setPriceForm((f) => ({ ...f, cropType: cropSlugFromName(item.name) }));
                }}
              />
              <DynamicMasterPicker
                masterType="market"
                label="Market"
                apiBase={mastersApi}
                required
                value={
                  priceForm.marketName
                    ? priceForm.district
                      ? `${priceForm.marketName}|${priceForm.district}`
                      : priceForm.marketName
                    : ''
                }
                onChange={(_id, item) => {
                  if (!item) {
                    setPriceForm((f) => ({ ...f, marketName: '', district: '' }));
                    return;
                  }
                  setPriceForm((f) => ({
                    ...f,
                    marketName: item.name,
                    district: item.category?.trim() ?? '',
                  }));
                }}
              />
              <label className="text-sm">
                <span className="text-slate-600">District</span>
                <input
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  value={priceForm.district}
                  onChange={(e) => setPriceForm((f) => ({ ...f, district: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-600">₹ / kg</span>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  value={priceForm.pricePerKg}
                  onChange={(e) => setPriceForm((f) => ({ ...f, pricePerKg: e.target.value }))}
                  required
                />
              </label>
            </div>
            {districtWeather ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Current Weather (Auto)</p>
                <p className="text-lg font-semibold text-slate-900">
                  {districtWeather.heavyRainLikely
                    ? 'Heavy Rain'
                    : districtWeather.highHeatLikely
                      ? 'Hot'
                      : districtWeather.highHumidityLikely
                        ? 'Humid'
                        : 'Stable'}
                </p>
                <p className="text-xs text-slate-500">{districtWeather.locationLabel}</p>
              </div>
            ) : null}
            <button
              type="submit"
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Save Price
            </button>
          </form>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-medium text-slate-900">Today&apos;s Prices</h2>
            <div className="flex gap-2">
              <DynamicMasterPicker
                masterType="crop"
                label="Crop"
                apiBase={mastersApi}
                cropValueSlug
                value={priceViewCrop}
                onChange={(_id, item) => {
                  if (item) setPriceViewCrop(cropSlugFromName(item.name));
                }}
              />
              <button
                type="button"
                className="rounded border border-slate-200 px-2 py-1 text-xs"
                onClick={() => void load()}
              >
                Refresh
              </button>
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Crop</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">District</th>
                <th className="px-3 py-2">₹ / kg</th>
                <th className="px-3 py-2">Updated</th>
                {canWrite ? <th className="px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {visiblePriceRows.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{p.crop_type}</td>
                  <td className="px-3 py-2">{p.market_name}</td>
                  <td className="px-3 py-2">{p.district ?? '—'}</td>
                  <td className="px-3 py-2 font-medium text-emerald-700">{p.price_per_kg}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {p.updated_at ? new Date(p.updated_at).toLocaleString('en-IN') : '—'}
                  </td>
                  {canWrite ? (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => setConfirmArchive(p.id)}
                      >
                        Archive
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {visiblePriceRows.length === 0 ? (
            <p className="pt-4 text-center text-sm text-slate-500">No prices found for selected filters.</p>
          ) : null}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-slate-900">Price Trend — {priceViewCrop}</h3>
            <StaticSelect
              className="rounded border border-slate-200 px-2 py-1 text-xs"
              compact
              value={String(priceYearView)}
              onChange={(value) => setPriceYearView(Number(value))}
              options={[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => ({
                value: String(y),
                label: String(y),
              }))}
            />
            <DynamicMasterPicker
              masterType="market"
              label="Filter markets"
              apiBase={mastersApi}
              multiple
              value={priceMarketsFilter}
              onChange={setPriceMarketsFilter}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-emerald-100 bg-emerald-50 p-3 text-sm">
              <p className="text-xs text-slate-600">Highest ₹/kg</p>
              <p className="mt-1 font-semibold text-emerald-700">₹ {highestPrice.toLocaleString('en-IN')}</p>
            </div>
            <div className="rounded border border-amber-100 bg-amber-50 p-3 text-sm">
              <p className="text-xs text-slate-600">Lowest ₹/kg</p>
              <p className="mt-1 font-semibold text-amber-700">₹ {lowestPrice.toLocaleString('en-IN')}</p>
            </div>
            <div className="rounded border border-blue-100 bg-blue-50 p-3 text-sm">
              <p className="text-xs text-slate-600">YoY trend</p>
              <p className="mt-1 font-semibold text-blue-700">
                {avgYoYPercent >= 0 ? '+' : ''}
                {avgYoYPercent}%
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <form
            onSubmit={saveMarketPreferences}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h3 className="font-medium text-slate-900">Farmer Preferred Markets</h3>
            <label className="mt-3 block text-xs text-slate-600">
              Farmer field (block)
              <StaticSelect
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={marketPrefForm.blockId}
                onChange={(value) => setMarketPrefForm((f) => ({ ...f, blockId: value }))}
                options={fieldBlocks.map((b) => ({
                  value: b.id,
                  label: `${(b.plot_label || b.name) ?? 'Block'} - ${b.crop_type}`,
                }))}
              />
            </label>
            <div className="mt-3">
              <DynamicMasterPicker
                masterType="market"
                label="Preferred market(s)"
                apiBase={mastersApi}
                multiple
                value={marketPrefForm.selectedKeys}
                onChange={(selectedKeys) => setMarketPrefForm((f) => ({ ...f, selectedKeys }))}
              />
            </div>
            <button
              type="submit"
              className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
              disabled={!canWrite || !marketPrefForm.blockId}
            >
              Save preferences
            </button>
          </form>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-medium text-slate-900">Field GPS</h3>
            <p className="mt-1 text-xs text-slate-600">
              Lat/Lng: {selectedPriceBlock?.latitude ?? '—'}, {selectedPriceBlock?.longitude ?? '—'}
            </p>
            <button
              type="button"
              onClick={() => {
                setGpsForm({
                  latitude:
                    selectedPriceBlock?.latitude != null ? String(selectedPriceBlock.latitude) : '',
                  longitude:
                    selectedPriceBlock?.longitude != null ? String(selectedPriceBlock.longitude) : '',
                });
                setGpsModalOpen(true);
              }}
              disabled={!canWrite || !marketPrefForm.blockId}
              className="mt-3 rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Update GPS
            </button>
          </section>
        </section>
      </div>

      {confirmArchive ? (
        <Modal
          title="Archive crop price"
          onClose={() => setConfirmArchive(null)}
          onSave={async () => {
            await api(`${base}/crop-prices/${confirmArchive}`, { method: 'DELETE' });
            setConfirmArchive(null);
            await load();
          }}
          saveLabel="Confirm"
        >
          <p className="text-sm text-slate-700">Archive this crop price row?</p>
        </Modal>
      ) : null}
      {gpsModalOpen ? (
        <Modal
          title="Update field GPS"
          onClose={() => setGpsModalOpen(false)}
          onSave={saveBlockGps}
          saveLabel="Save GPS"
        >
          <div className="space-y-3">
            <Field label="Latitude">
              <input
                className={inputClass}
                value={gpsForm.latitude}
                onChange={(e) => setGpsForm((f) => ({ ...f, latitude: e.target.value }))}
              />
            </Field>
            <Field label="Longitude">
              <input
                className={inputClass}
                value={gpsForm.longitude}
                onChange={(e) => setGpsForm((f) => ({ ...f, longitude: e.target.value }))}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
