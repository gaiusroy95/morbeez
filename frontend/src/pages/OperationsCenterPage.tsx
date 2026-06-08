import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useSyncConsoleSearchMode } from '../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../lib/console-page-search';
import { matchesSearch } from '../lib/search-filter';
import {
  AutomationJobsPanel,
  LanguageTemplatesPanel,
  QuickRepliesPanel,
} from '../components/operations/OperationsMessagingExtras';
import { Alert, HubTabs, Loading, ReadOnlyBanner, StaticSelect } from '../components/ui';
import { Field, Modal, inputClass } from '../components/Modal';
import { DynamicMasterPicker } from '../components/DynamicMasterPicker';
import { cropSlugFromName } from '../lib/master-picker-utils';

type Tab =
  | 'messaging'
  | 'broadcasts'
  | 'prices'
  | 'terminology'
  | 'weather'
  | 'quickReplies'
  | 'langTemplates'
  | 'automationJobs';

type MessagingConfig = {
  provider: string;
  broadcastsEnabled: boolean;
  broadcastMaxPerDay: number;
  broadcastKindCooldownHours: number;
  sessionHours: number;
  cultivationFollowUpsEnabled: boolean;
  advisoryFollowUpsEnabled: boolean;
  advisoryAutomationEnabled: boolean;
  orderAlertsEnabled: boolean;
};

type BroadcastRule = {
  id: string;
  crop_type: string;
  broadcast_kind: string;
  target_dap: number | null;
  min_dap: number | null;
  max_dap: number | null;
  weekday: number | null;
  priority: number;
  active: boolean;
};

type Delivery = {
  id: string;
  broadcast_kind: string;
  status: string;
  created_at: string;
  farmers?: { phone: string; name: string | null; district: string | null };
};

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

type TermTask = {
  id: string;
  term: string;
  language: string | null;
  crop_type: string | null;
  district: string | null;
  context_text: string | null;
  raw_message?: string | null;
  occurrence_count?: number | null;
  priority_score?: number | null;
  status: string;
  created_at: string;
  farmers?: { phone: string; name: string | null; district: string | null };
};

type WeatherRule = {
  id: string;
  rule_key: string;
  version: number;
  crop_type: string | null;
  action_type: string;
  status: string;
  effective_from: string | null;
};

type FieldActivityBlock = {
  id: string;
  farmer_id: string;
  name: string;
  plot_label: string | null;
  crop_type: string;
  stage: string | null;
  acreage_decimal: number | null;
  planting_date: string | null;
  latitude?: number | null;
  longitude?: number | null;
  farmers?: { name: string | null; phone: string | null; district: string | null };
};

const BROADCAST_KINDS = [
  'cultivation_schedule',
  'fertigation_reminder',
  'pgr_broadcast',
  'dap_task',
  'cultivation_knowledge',
] as const;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'messaging', label: 'Messaging' },
  { id: 'broadcasts', label: 'Broadcasts' },
  { id: 'prices', label: 'Daily prices' },
  { id: 'terminology', label: 'Terminology' },
  { id: 'weather', label: 'Weather rules' },
  { id: 'quickReplies', label: 'Quick replies' },
  { id: 'langTemplates', label: 'Language templates' },
  { id: 'automationJobs', label: 'Automation jobs' },
];

const OPERATIONS_API_BASE = '/morbeez-staff/api/v1/os/operations';

export function OperationsCenterPage({ canWrite }: { canWrite: boolean }) {
  const base = OPERATIONS_API_BASE;
  const mastersApi = `${base}/masters`;

  const [tab, setTab] = useState<Tab>('broadcasts');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    body: string;
    action: () => Promise<void>;
  } | null>(null);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [gpsForm, setGpsForm] = useState({ latitude: '', longitude: '' });
  const [resolveModal, setResolveModal] = useState<{ id: string } | null>(null);
  const [resolveForm, setResolveForm] = useState({ meaning: '', standardTerm: '' });
  const searchDefaults = defaultsForPage('operations');
  useSyncConsoleSearchMode(
    tab === 'messaging' ? 'none' : 'local',
    search,
    setSearch,
    searchDefaults.placeholder ?? 'Search broadcasts, prices…'
  );
  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState<MessagingConfig | null>(null);
  const [rules, setRules] = useState<BroadcastRule[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [prices, setPrices] = useState<CropPrice[]>([]);
  const [priceViewCrop, setPriceViewCrop] = useState('ginger');
  const [priceMarketsFilter, setPriceMarketsFilter] = useState<string[]>([]);
  const [priceYearView, setPriceYearView] = useState(new Date().getFullYear());
  const [districtWeather, setDistrictWeather] = useState<DistrictWeather | null>(null);
  const [fieldBlocks, setFieldBlocks] = useState<FieldActivityBlock[]>([]);
  const [tasks, setTasks] = useState<TermTask[]>([]);
  const [termStatus, setTermStatus] = useState('open');
  const [weatherRules, setWeatherRules] = useState<WeatherRule[]>([]);

  const [quickReplies, setQuickReplies] = useState<
    Array<{
      id: string;
      shortcut_key: string;
      category: string;
      label_en: string;
      body_en: string;
      body_ml: string | null;
      active: boolean;
      sort_order: number;
    }>
  >([]);
  const [qrCategory, setQrCategory] = useState('all');
  const [langTemplates, setLangTemplates] = useState<
    Array<{
      id: string;
      template_key: string;
      language: string;
      channel: string;
      body_text: string;
      meta_template_name: string | null;
      status: string;
      active: boolean;
    }>
  >([]);
  const [tplStatus, setTplStatus] = useState('all');
  const [autoJobs, setAutoJobs] = useState<
    Array<{
      id: string;
      job_type: string;
      status: string;
      scheduled_at: string;
      attempts: number;
      last_error: string | null;
      farmerName: string;
      farmerPhone: string | null;
      payload: Record<string, unknown>;
    }>
  >([]);
  const [autoStats, setAutoStats] = useState<Record<string, number> | null>(null);
  const [jobStatus, setJobStatus] = useState('active');
  const [jobType, setJobType] = useState('all');

  const [runDryRun, setRunDryRun] = useState(true);
  const [runResult, setRunResult] = useState<string>('');

  const [ruleForm, setRuleForm] = useState({
    cropType: 'ginger',
    broadcastKind: 'cultivation_schedule' as (typeof BROADCAST_KINDS)[number],
    targetDap: '',
    priority: '50',
    active: true,
  });

  const [priceForm, setPriceForm] = useState({
    cropType: 'ginger',
    marketName: '',
    district: '',
    pricePerKg: '',
  });

  const [marketPrefForm, setMarketPrefForm] = useState<{
    blockId: string;
    selectedKeys: string[];
  }>({
    blockId: '',
    selectedKeys: [],
  });

  const [termForm, setTermForm] = useState({
    term: '',
    rawMessage: '',
    farmerPhone: '',
    language: 'ml',
    cropType: 'cardamom',
    district: '',
  });

  const visibleRules = useMemo(
    () =>
      rules.filter((r) =>
        matchesSearch(search, r.crop_type, r.broadcast_kind, String(r.target_dap), String(r.id))
      ),
    [rules, search]
  );
  const visibleDeliveries = useMemo(
    () =>
      deliveries.filter((d) =>
        matchesSearch(
          search,
          d.broadcast_kind,
          d.status,
          d.farmers?.name,
          d.farmers?.phone,
          d.farmers?.district
        )
      ),
    [deliveries, search]
  );
  const visiblePrices = useMemo(
    () =>
      prices.filter((p) =>
        matchesSearch(search, p.crop_type, p.market_name, p.district, String(p.price_per_kg))
      ),
    [prices, search]
  );
  const visibleTasks = useMemo(
    () =>
      tasks.filter((t) =>
        matchesSearch(
          search,
          t.term,
          t.language,
          t.crop_type,
          t.district,
          t.context_text,
          t.farmers?.name,
          t.farmers?.phone
        )
      ),
    [tasks, search]
  );
  const visibleWeatherRules = useMemo(
    () =>
      weatherRules.filter((r) =>
        matchesSearch(search, r.rule_key, r.crop_type, r.action_type, r.status)
      ),
    [weatherRules, search]
  );
  const visibleQuickReplies = useMemo(
    () =>
      quickReplies.filter((r) =>
        matchesSearch(search, r.shortcut_key, r.category, r.label_en, r.body_en, r.body_ml)
      ),
    [quickReplies, search]
  );
  const visibleLangTemplates = useMemo(
    () =>
      langTemplates.filter((t) =>
        matchesSearch(
          search,
          t.template_key,
          t.language,
          t.channel,
          t.body_text,
          t.meta_template_name,
          t.status
        )
      ),
    [langTemplates, search]
  );
  const visibleAutoJobs = useMemo(
    () =>
      autoJobs.filter((j) =>
        matchesSearch(
          search,
          j.job_type,
          j.status,
          j.farmerName,
          j.farmerPhone,
          j.last_error,
          JSON.stringify(j.payload)
        )
      ),
    [autoJobs, search]
  );

  const loadTab = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'messaging') {
        const d = await api<{ ok: boolean; config: MessagingConfig }>(`${base}/messaging-config`);
        setConfig(d.config);
      } else if (tab === 'broadcasts') {
        const [r, del] = await Promise.all([
          api<{ ok: boolean; rules: BroadcastRule[] }>(`${base}/broadcasts/rules`),
          api<{ ok: boolean; deliveries: Delivery[] }>(`${base}/broadcasts/deliveries?limit=40`),
        ]);
        setRules(r.rules ?? []);
        setDeliveries(del.deliveries ?? []);
      } else if (tab === 'prices') {
        const [d, blocks] = await Promise.all([
          api<{ ok: boolean; prices: CropPrice[] }>(`${base}/crop-prices?crop=${encodeURIComponent(priceViewCrop)}`),
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
      } else if (tab === 'terminology') {
        const d = await api<{ ok: boolean; tasks: TermTask[] }>(
          `${base}/terminology/tasks?status=${encodeURIComponent(termStatus)}`
        );
        setTasks(d.tasks ?? []);
      } else if (tab === 'weather') {
        const d = await api<{ ok: boolean; rules: WeatherRule[] }>(`${base}/weather-rules`);
        setWeatherRules(d.rules ?? []);
      } else if (tab === 'quickReplies') {
        const q =
          qrCategory !== 'all' ? `?category=${encodeURIComponent(qrCategory)}` : '';
        const d = await api<{ ok: boolean; replies: typeof quickReplies }>(
          `${base}/quick-replies${q}`
        );
        setQuickReplies(d.replies ?? []);
      } else if (tab === 'langTemplates') {
        const q =
          tplStatus !== 'all' ? `?status=${encodeURIComponent(tplStatus)}` : '';
        const d = await api<{ ok: boolean; templates: typeof langTemplates }>(
          `${base}/language-templates${q}`
        );
        setLangTemplates(d.templates ?? []);
      } else if (tab === 'automationJobs') {
        const params = new URLSearchParams();
        params.set('status', jobStatus);
        if (jobType !== 'all') params.set('jobType', jobType);
        const [jobsRes, statsRes] = await Promise.all([
          api<{ ok: boolean; jobs: typeof autoJobs }>(`${base}/automation-jobs?${params}`),
          api<{ ok: boolean; stats: Record<string, number> }>(`${base}/automation-jobs/stats`),
        ]);
        setAutoJobs(jobsRes.jobs ?? []);
        setAutoStats(statsRes.stats ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    termStatus,
    qrCategory,
    tplStatus,
    jobStatus,
    jobType,
    priceViewCrop,
    marketPrefForm.blockId,
  ]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  useEffect(() => {
    if (tab !== 'prices') return;
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
  }, [tab, priceForm.district, base]);

  async function saveRule(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setError('');
    try {
      await api(`${base}/broadcasts/rules`, {
        method: 'POST',
        body: JSON.stringify({
          cropType: ruleForm.cropType,
          broadcastKind: ruleForm.broadcastKind,
          targetDap: ruleForm.targetDap ? Number(ruleForm.targetDap) : null,
          priority: Number(ruleForm.priority) || 50,
          active: ruleForm.active,
        }),
      });
      await loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save rule');
    }
  }

  async function runBroadcasts() {
    if (!canWrite) return;
    setRunResult('');
    setError('');
    try {
      const d = await api<{ ok: boolean; result: unknown }>(`${base}/broadcasts/run`, {
        method: 'POST',
        body: JSON.stringify({ dryRun: runDryRun }),
      });
      setRunResult(JSON.stringify(d.result, null, 2));
      await loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    }
  }

  async function savePrice(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setError('');
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
      await loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save price');
    }
  }

  async function saveMarketPreferences(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || !marketPrefForm.blockId) return;
    const block = fieldBlocks.find((b) => b.id === marketPrefForm.blockId);
    if (!block?.farmer_id) return;
    setError('');
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
      await loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save market preferences');
    }
  }

  async function saveBlockGps() {
    if (!canWrite || !marketPrefForm.blockId) return;
    const latitude = Number(gpsForm.latitude);
    const longitude = Number(gpsForm.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
    setError('');
    try {
      await api(`${base}/field-activities/blocks/${marketPrefForm.blockId}/location`, {
        method: 'PATCH',
        body: JSON.stringify({ latitude, longitude }),
      });
      setGpsModalOpen(false);
      setGpsForm({ latitude: '', longitude: '' });
      await loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save GPS');
    }
  }

  async function createTermTask(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || !termForm.term.trim()) return;
    setError('');
    try {
      await api(`${base}/terminology/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          term: termForm.term.trim(),
          rawMessage: termForm.rawMessage.trim() || termForm.term.trim(),
          language: termForm.language,
          cropType: termForm.cropType || undefined,
          district: termForm.district || undefined,
          farmerPhone: termForm.farmerPhone.trim() || undefined,
        }),
      });
      setTermForm((f) => ({ ...f, term: '', rawMessage: '' }));
      setTermStatus('open');
      await loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add terminology task');
    }
  }

  async function resolveTerm(id: string, status: 'resolved' | 'dismissed') {
    if (!canWrite) return;
    if (status === 'resolved') {
      setResolveModal({ id });
      setResolveForm({ meaning: '', standardTerm: '' });
      return;
    }
    try {
      await api(`${base}/terminology/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function submitResolvedTerm() {
    if (!resolveModal?.id) return;
    const meaning = resolveForm.meaning.trim();
    if (!meaning) return;
    const standardTerm = resolveForm.standardTerm.trim() || meaning;
    try {
      await api(`${base}/terminology/tasks/${resolveModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'resolved',
          resolutionMeaning: meaning,
          standardTerm,
        }),
      });
      setResolveModal(null);
      await loadTab();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function archiveBroadcastRule(id: string) {
    if (!canWrite) return;
    setConfirmModal({
      title: 'Archive broadcast rule',
      body: 'Do you want to archive this broadcast rule?',
      action: async () => {
        await api(`${base}/broadcasts/rules/${id}`, { method: 'DELETE' });
        await loadTab();
      },
    });
  }

  async function archiveCropPrice(id: string) {
    if (!canWrite) return;
    setConfirmModal({
      title: 'Archive crop price',
      body: 'Do you want to archive this crop price?',
      action: async () => {
        await api(`${base}/crop-prices/${id}`, { method: 'DELETE' });
        await loadTab();
      },
    });
  }

  const selectedPriceBlock =
    fieldBlocks.find((b) => b.id === marketPrefForm.blockId) ?? fieldBlocks[0] ?? null;
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

  return (
    <div className="operations-hub">
      <p className="muted" style={{ marginBottom: 12 }}>
        WhatsApp broadcasts, field activities, quick replies, templates, automation, mandi prices, terminology
      </p>
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {loading ? (
        <Loading />
      ) : (
        <div className="mt-6">
          {tab === 'messaging' && config ? (
            <div className="grid max-w-2xl gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
              <Row label="Provider" value={config.provider} />
              <Row label="Broadcasts enabled" value={config.broadcastsEnabled ? 'Yes' : 'No'} />
              <Row label="Max broadcasts / day" value={String(config.broadcastMaxPerDay)} />
              <Row label="Kind cooldown (hours)" value={String(config.broadcastKindCooldownHours)} />
              <Row label="Session window (hours)" value={String(config.sessionHours)} />
              <Row label="Cultivation follow-ups" value={config.cultivationFollowUpsEnabled ? 'Yes' : 'No'} />
              <Row label="Advisory follow-ups" value={config.advisoryFollowUpsEnabled ? 'Yes' : 'No'} />
              <Row label="Advisory automation" value={config.advisoryAutomationEnabled ? 'Yes' : 'No'} />
              <Row label="Order alerts" value={config.orderAlertsEnabled ? 'Yes' : 'No'} />
              <p className="mt-2 text-xs text-slate-500">
                Values come from server environment. Change in deployment config, then restart API.
              </p>
            </div>
          ) : null}

          {tab === 'broadcasts' ? (
            <div className="space-y-8">
              {canWrite ? (
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="font-medium text-slate-900">Run broadcasts now</h2>
                  <p className="mt-1 text-xs text-slate-500">Manual trigger bypasses IST morning window</p>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={runDryRun}
                      onChange={(e) => setRunDryRun(e.target.checked)}
                    />
                    Dry run (no messages sent)
                  </label>
                  <button
                    type="button"
                    onClick={runBroadcasts}
                    className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Run
                  </button>
                  {runResult ? (
                    <pre className="mt-3 max-h-48 overflow-auto rounded bg-slate-50 p-3 text-xs">
                      {runResult}
                    </pre>
                  ) : null}
                </section>
              ) : null}

              {canWrite ? (
                <form onSubmit={saveRule} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="font-medium text-slate-900">Add broadcast rule</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-sm">
                      <span className="text-slate-600">Crop</span>
                      <input
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                        value={ruleForm.cropType}
                        onChange={(e) => setRuleForm((f) => ({ ...f, cropType: e.target.value }))}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-slate-600">Kind</span>
                      <StaticSelect
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                        value={ruleForm.broadcastKind}
                        onChange={(value) =>
                          setRuleForm((f) => ({
                            ...f,
                            broadcastKind: value as (typeof BROADCAST_KINDS)[number],
                          }))
                        }
                        options={BROADCAST_KINDS.map((k) => ({ value: k, label: k }))}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-slate-600">Target DAP</span>
                      <input
                        type="number"
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                        value={ruleForm.targetDap}
                        onChange={(e) => setRuleForm((f) => ({ ...f, targetDap: e.target.value }))}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-slate-600">Priority</span>
                      <input
                        type="number"
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                        value={ruleForm.priority}
                        onChange={(e) => setRuleForm((f) => ({ ...f, priority: e.target.value }))}
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
                  >
                    Save rule
                  </button>
                </form>
              ) : null}

              <TableSection title="Broadcast rules">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Crop</th>
                      <th className="px-4 py-3">Kind</th>
                      <th className="px-4 py-3">DAP</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Active</th>
                      {canWrite ? <th className="px-4 py-3" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRules.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">{r.crop_type}</td>
                        <td className="px-4 py-3">{r.broadcast_kind}</td>
                        <td className="px-4 py-3">{r.target_dap ?? `${r.min_dap ?? '—'}–${r.max_dap ?? '—'}`}</td>
                        <td className="px-4 py-3">{r.priority}</td>
                        <td className="px-4 py-3">{r.active ? 'Yes' : 'No'}</td>
                        {canWrite ? (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:underline"
                              onClick={() => archiveBroadcastRule(r.id)}
                            >
                              Archive
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rules.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">No rules yet.</p>
                ) : null}
              </TableSection>

              <TableSection title="Recent deliveries">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Farmer</th>
                      <th className="px-4 py-3">Kind</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDeliveries.map((d) => (
                      <tr key={d.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {new Date(d.created_at).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          {d.farmers?.name ?? '—'}
                          <span className="block text-xs text-slate-500">{d.farmers?.phone}</span>
                        </td>
                        <td className="px-4 py-3">{d.broadcast_kind}</td>
                        <td className="px-4 py-3 capitalize">{d.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSection>
            </div>
          ) : null}

          {tab === 'prices' ? (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-5">
                {canWrite ? (
                  <form onSubmit={savePrice} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
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
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="font-semibold text-slate-900">{Math.round(districtWeather.maxTempCToday)}°C</p>
                          <p className="text-slate-500">Temperature</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{Math.round(districtWeather.avgHumidityPct)}%</p>
                          <p className="text-slate-500">Humidity</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{Math.round(districtWeather.rainMmToday)} mm</p>
                          <p className="text-slate-500">Rainfall</p>
                        </div>
                      </div>
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
                      <div className="min-w-[10rem]">
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
                      </div>
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-2 py-1 text-xs"
                        onClick={loadTab}
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
                                onClick={() => archiveCropPrice(p.id)}
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
                      <p className="mt-1 font-semibold text-blue-700">{avgYoYPercent >= 0 ? '+' : ''}{avgYoYPercent}%</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Trend year filter ({priceYearView}) is a scaffold view. Price summary uses available current rows.
                  </p>
                </section>

                <section className="space-y-4">
                  <form onSubmit={saveMarketPreferences} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="font-medium text-slate-900">Farmer Preferred Markets</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Used for daily market-price personalization and future broadcast targeting.
                    </p>
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
                        onChange={(selectedKeys) =>
                          setMarketPrefForm((f) => ({ ...f, selectedKeys }))
                        }
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
                            selectedPriceBlock?.latitude != null
                              ? String(selectedPriceBlock.latitude)
                              : '',
                          longitude:
                            selectedPriceBlock?.longitude != null
                              ? String(selectedPriceBlock.longitude)
                              : '',
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
            </div>
          ) : null}

          {tab === 'terminology' ? (
            <div>
              <p className="mb-4 text-sm text-slate-600">
                Tasks are created automatically when a farmer sends an unknown local word on WhatsApp
                (with <code className="text-xs">ENABLE_REGIONAL_TERMINOLOGY_ENGINE=true</code>). You
                can also add one manually below for review.
              </p>
              {canWrite ? (
                <form
                  onSubmit={createTermTask}
                  className="mb-6 rounded-lg border border-slate-200 bg-slate-50/80 p-4"
                >
                  <h3 className="mb-3 text-sm font-semibold text-slate-800">Add term for review</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="block text-xs text-slate-600">
                      Unknown word / phrase *
                      <input
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                        value={termForm.term}
                        onChange={(e) => setTermForm((f) => ({ ...f, term: e.target.value }))}
                        placeholder="e.g. moola vattam"
                        required
                      />
                    </label>
                    <label className="block text-xs text-slate-600">
                      Full farmer message
                      <input
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                        value={termForm.rawMessage}
                        onChange={(e) => setTermForm((f) => ({ ...f, rawMessage: e.target.value }))}
                        placeholder="Moola vattam vannu"
                      />
                    </label>
                    <label className="block text-xs text-slate-600">
                      Farmer phone (optional)
                      <input
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                        value={termForm.farmerPhone}
                        onChange={(e) => setTermForm((f) => ({ ...f, farmerPhone: e.target.value }))}
                        placeholder="9876543210"
                      />
                    </label>
                    <label className="block text-xs text-slate-600">
                      Language
                      <StaticSelect
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                        value={termForm.language}
                        onChange={(value) => setTermForm((f) => ({ ...f, language: value }))}
                        options={['ml', 'en', 'ta', 'kn', 'hi'].map((l) => ({ value: l, label: l }))}
                      />
                    </label>
                    <label className="block text-xs text-slate-600">
                      Crop
                      <input
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                        value={termForm.cropType}
                        onChange={(e) => setTermForm((f) => ({ ...f, cropType: e.target.value }))}
                      />
                    </label>
                    <label className="block text-xs text-slate-600">
                      District
                      <input
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                        value={termForm.district}
                        onChange={(e) => setTermForm((f) => ({ ...f, district: e.target.value }))}
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="mt-3 rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
                  >
                    Add to queue
                  </button>
                </form>
              ) : null}
              <div className="mb-4 flex items-center gap-2">
                <label className="text-sm text-slate-600">Status</label>
                <StaticSelect
                  className="rounded border border-slate-200 px-2 py-1 text-sm"
                  value={termStatus}
                  onChange={setTermStatus}
                  options={['open', 'in_review', 'resolved', 'dismissed', 'all'].map((s) => ({
                    value: s,
                    label: s,
                  }))}
                />
              </div>
              <TableSection title="Unknown terms queue">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Term</th>
                      <th className="px-4 py-3">Farmer</th>
                      <th className="px-4 py-3">Message</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Status</th>
                      {canWrite ? <th className="px-4 py-3" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTasks.map((t) => (
                      <tr key={t.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium">
                          {t.term}
                          <span className="block text-xs font-normal text-slate-500">
                            {[t.language, t.crop_type, t.district].filter(Boolean).join(' · ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {t.farmers?.name ?? '—'}
                          <br />
                          {t.farmers?.phone}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-600">
                          {t.raw_message ?? t.context_text ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {t.occurrence_count ?? 1}
                          {t.priority_score != null && t.priority_score > 1
                            ? ` · p${t.priority_score}`
                            : ''}
                        </td>
                        <td className="px-4 py-3 capitalize">{t.status}</td>
                        {canWrite ? (
                          <td className="px-4 py-3">
                            {t.status === 'open' || t.status === 'in_review' ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="text-xs text-emerald-700 hover:underline"
                                  onClick={() => resolveTerm(t.id, 'resolved')}
                                >
                                  Resolve
                                </button>
                                <button
                                  type="button"
                                  className="text-xs text-slate-500 hover:underline"
                                  onClick={() => resolveTerm(t.id, 'dismissed')}
                                >
                                  Dismiss
                                </button>
                              </div>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tasks.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">No tasks in this filter.</p>
                ) : null}
              </TableSection>
            </div>
          ) : null}

          {tab === 'quickReplies' ? (
            <QuickRepliesPanel
              replies={visibleQuickReplies}
              canWrite={canWrite}
              category={qrCategory}
              onCategoryChange={setQrCategory}
              onRefresh={loadTab}
            />
          ) : null}

          {tab === 'langTemplates' ? (
            <LanguageTemplatesPanel
              templates={visibleLangTemplates}
              canWrite={canWrite}
              statusFilter={tplStatus}
              onStatusChange={setTplStatus}
              onRefresh={loadTab}
            />
          ) : null}

          {tab === 'automationJobs' ? (
            <AutomationJobsPanel
              jobs={visibleAutoJobs}
              stats={autoStats}
              canWrite={canWrite}
              statusFilter={jobStatus}
              jobTypeFilter={jobType}
              onStatusChange={setJobStatus}
              onJobTypeChange={setJobType}
              onRefresh={loadTab}
            />
          ) : null}

          {tab === 'weather' ? (
            <TableSection title="Weather rule definitions (read-only)">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Rule</th>
                    <th className="px-4 py-3">Crop</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleWeatherRules.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        {r.rule_key} v{r.version}
                      </td>
                      <td className="px-4 py-3">{r.crop_type ?? 'all'}</td>
                      <td className="px-4 py-3">{r.action_type}</td>
                      <td className="px-4 py-3 capitalize">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {weatherRules.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  No weather rules — apply OS foundation migration.
                </p>
              ) : null}
            </TableSection>
          ) : null}
        </div>
      )}
      {confirmModal ? (
        <Modal
          title={confirmModal.title}
          onClose={() => setConfirmModal(null)}
          onSave={async () => {
            try {
              await confirmModal.action();
              setConfirmModal(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Action failed');
            }
          }}
          saveLabel="Confirm"
        >
          <p className="text-sm text-slate-700">{confirmModal.body}</p>
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
            <Field label="Latitude (-90 to 90)">
              <input
                className={inputClass}
                value={gpsForm.latitude}
                onChange={(e) => setGpsForm((f) => ({ ...f, latitude: e.target.value }))}
              />
            </Field>
            <Field label="Longitude (-180 to 180)">
              <input
                className={inputClass}
                value={gpsForm.longitude}
                onChange={(e) => setGpsForm((f) => ({ ...f, longitude: e.target.value }))}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
      {resolveModal ? (
        <Modal
          title="Resolve terminology"
          onClose={() => setResolveModal(null)}
          onSave={submitResolvedTerm}
          saveLabel="Resolve"
        >
          <div className="space-y-3">
            <Field label="Farmer meaning">
              <input
                className={inputClass}
                value={resolveForm.meaning}
                onChange={(e) => setResolveForm((f) => ({ ...f, meaning: e.target.value }))}
                placeholder="e.g. new sprout"
              />
            </Field>
            <Field label="Standard agriculture term">
              <input
                className={inputClass}
                value={resolveForm.standardTerm}
                onChange={(e) => setResolveForm((f) => ({ ...f, standardTerm: e.target.value }))}
                placeholder="e.g. shoot emergence"
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function TableSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

