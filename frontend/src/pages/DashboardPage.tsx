import { useEffect, useRef, useState } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
} from 'chart.js';
import { Alert, PageShell, Panel, StaticSelect } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { canManageStaff } from '../lib/role-home';
import { formatInr, formatInrFull, formatTrend } from '../lib/format';
import { StatIcon } from '../components/NavIcon';
import { SuperAdminMonitorDashboard } from '../components/dashboard/SuperAdminMonitorDashboard';
import { cn } from '../lib/cn';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip
);

type Dashboard = {
  kpis: {
    farmers: number;
    farmersTrend: number;
    revenueInr: number;
    revenueTrend: number;
    orders: number;
    ordersTrend: number;
    conversionRate: number;
    conversionTrend: number;
    aiDiagnoses: number;
    aiTrend: number;
    avgOrderValue: number;
    avgOrderTrend: number;
    compareLabel?: string;
  };
  alerts: {
    lowStock: number;
    outOfStock: number;
    expiringSoon: number;
    pendingOrders: number;
  };
  salesChart: { labels: string[]; values: number[] };
  topProducts: Array<{ title: string; revenue: number; imageUrl?: string | null }>;
};

const KPI_ICON_TONES = {
  green: 'bg-brand-50 text-brand-600',
  blue: 'bg-sky-50 text-sky-600',
  teal: 'bg-teal-50 text-teal-600',
  purple: 'bg-violet-50 text-violet-600',
  orange: 'bg-amber-50 text-amber-600',
} as const;

function DashboardKpiCard({
  label,
  value,
  trendPct,
  compare,
  icon,
  iconTone,
}: {
  label: string;
  value: string;
  trendPct: number;
  compare: string;
  icon: string;
  iconTone: keyof typeof KPI_ICON_TONES;
}) {
  const trend = formatTrend(trendPct);
  return (
    <article className="rounded-[var(--radius-card)] border border-border/80 bg-surface-elevated p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]',
            KPI_ICON_TONES[iconTone]
          )}
        >
          <StatIcon name={icon} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-1.5 text-xs">
        <span className={cn('font-semibold', trend.up ? 'text-emerald-600' : 'text-red-600')}>
          {trend.text}
        </span>
        <span className="text-ink-muted"> vs {compare}</span>
      </p>
    </article>
  );
}

const ALERT_TONES = {
  warn: 'text-amber-600',
  danger: 'text-red-600',
  neutral: 'text-ink-secondary',
  success: 'text-emerald-600',
} as const;

function InventoryAlertTile({
  label,
  count,
  tone,
  unit,
}: {
  label: string;
  count: number;
  tone: keyof typeof ALERT_TONES;
  unit: string;
}) {
  return (
    <article className="rounded-[var(--radius-card)] border border-border/80 bg-surface-elevated p-5 shadow-[var(--shadow-card)] transition hover:border-brand-400/50">
      <p className="text-sm font-semibold text-ink-muted">{label}</p>
      <p className={cn('mt-2 text-3xl font-extrabold tracking-tight', ALERT_TONES[tone])}>{count}</p>
      <p className="mt-1 text-xs text-ink-muted">{unit}</p>
    </article>
  );
}

export function DashboardPage() {
  const { admin } = useAuth();
  const showSuperAdminMonitor = canManageStaff(admin?.role);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (showSuperAdminMonitor) {
      setLoading(false);
      return;
    }
    api<{ ok: boolean } & Dashboard>('/morbeez-staff/api/v1/dashboard')
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [showSuperAdminMonitor]);

  useEffect(() => {
    if (!data?.salesChart || !canvasRef.current) return;
    const chartData = data.salesChart;
    const max = Math.max(...chartData.values, 1);

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: 'Sales (₹)',
            data: chartData.values,
            borderColor: '#3aad62',
            backgroundColor: 'rgba(58, 173, 98, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#3aad62',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => '₹' + Number(ctx.raw).toLocaleString('en-IN'),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#667a70', font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            suggestedMax: max * 1.1,
            ticks: {
              color: '#667a70',
              font: { size: 11 },
              callback: (v) => (Number(v) >= 1000 ? Number(v) / 1000 + 'K' : String(v)),
            },
            grid: { color: '#eaefeb' },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data]);

  if (loading && !showSuperAdminMonitor) {
    return <PageShell loading loadingLabel="Loading dashboard…" />;
  }

  if (showSuperAdminMonitor) {
    return <SuperAdminMonitorDashboard />;
  }

  if (error) {
    return <Alert tone="error">{error}</Alert>;
  }

  if (!data) return null;

  const k = data.kpis;
  const a = data.alerts;
  const compare = k.compareLabel ?? 'previous period';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <DashboardKpiCard
          label="Total Sales"
          value={formatInrFull(k.revenueInr)}
          trendPct={k.revenueTrend}
          compare={compare}
          icon="sales"
          iconTone="green"
        />
        <DashboardKpiCard
          label="Orders"
          value={Number(k.orders).toLocaleString('en-IN')}
          trendPct={k.ordersTrend}
          compare={compare}
          icon="cart"
          iconTone="blue"
        />
        <DashboardKpiCard
          label="Farmers"
          value={Number(k.farmers).toLocaleString('en-IN')}
          trendPct={k.farmersTrend}
          compare={compare}
          icon="farmers"
          iconTone="teal"
        />
        <DashboardKpiCard
          label="Conversion Rate"
          value={`${k.conversionRate}%`}
          trendPct={k.conversionTrend}
          compare={compare}
          icon="trend"
          iconTone="purple"
        />
        <DashboardKpiCard
          label="AI Diagnoses"
          value={Number(k.aiDiagnoses).toLocaleString('en-IN')}
          trendPct={k.aiTrend}
          compare={compare}
          icon="ai"
          iconTone="orange"
        />
        <DashboardKpiCard
          label="Avg. Order Value"
          value={formatInr(k.avgOrderValue)}
          trendPct={k.avgOrderTrend}
          compare={compare}
          icon="sales"
          iconTone="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.65fr_1fr]">
        <Panel
          title="Sales Overview"
          actions={
            <StaticSelect
              className="h-9 min-w-[9rem] text-sm"
              value="week"
              onChange={() => {}}
              options={[
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' },
              ]}
            />
          }
          bodyClassName="pt-2"
        >
          <div className="h-[280px] w-full">
            <canvas ref={canvasRef} className="h-full w-full" />
          </div>
        </Panel>

        <Panel title="Top Products" bodyClassName="p-0 sm:p-0">
          <div className="divide-y divide-border/60">
            {!data.topProducts?.length ? (
              <p className="px-4 py-10 text-center text-sm text-ink-muted sm:px-5">
                No sales data yet — orders will appear here.
              </p>
            ) : (
              data.topProducts.map((p, i) => (
                <div
                  key={`${p.title}-${i}`}
                  className="flex items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-xs font-bold text-ink-muted">
                    {i + 1}
                  </span>
                  {p.imageUrl ? (
                    <img
                      className="h-10 w-10 shrink-0 rounded-[var(--radius-control)] border border-border/60 object-cover"
                      src={p.imageUrl}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded-[var(--radius-control)] border border-border/60 bg-surface-subtle" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{p.title}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-brand-700">
                    {formatInrFull(p.revenue)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InventoryAlertTile label="Low Stock Alerts" count={a.lowStock} tone="warn" unit="Products" />
        <InventoryAlertTile label="Out of Stock" count={a.outOfStock} tone="danger" unit="Products" />
        <InventoryAlertTile label="Expiring Soon" count={a.expiringSoon} tone="neutral" unit="Products" />
        <InventoryAlertTile label="Pending Orders" count={a.pendingOrders} tone="success" unit="Orders" />
      </div>
    </div>
  );
}
