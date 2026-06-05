import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import { Alert, EmptyState, PageShell, Panel, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { formatInr, formatInrFull } from '@/lib/format';
import { theme } from '@/lib/theme';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
  topProducts: Array<{ title: string; revenue: number; imageUrl?: string | null }>;
};

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ ok: boolean } & Dashboard>('/morbeez-staff/api/v1/dashboard')
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ConsoleScreenLayout>
        <PageShell loading loadingLabel="Loading dashboard…" />
      </ConsoleScreenLayout>
    );
  }

  if (error) {
    return (
      <ConsoleScreenLayout>
        <Alert>{error}</Alert>
      </ConsoleScreenLayout>
    );
  }

  if (!data) return null;

  const k = data.kpis;
  const a = data.alerts;
  const compare = k.compareLabel ?? 'previous period';

  return (
    <ConsoleScreenLayout>
      <View style={styles.statGrid}>
        <StatCard label="Total Sales" value={formatInrFull(k.revenueInr)} trendPct={k.revenueTrend} compare={compare} />
        <StatCard label="Orders" value={Number(k.orders).toLocaleString('en-IN')} trendPct={k.ordersTrend} compare={compare} />
        <StatCard label="Farmers" value={Number(k.farmers).toLocaleString('en-IN')} trendPct={k.farmersTrend} compare={compare} />
        <StatCard
          label="Conversion Rate"
          value={`${k.conversionRate}%`}
          trendPct={k.conversionTrend}
          compare={compare}
        />
        <StatCard
          label="AI Diagnoses"
          value={Number(k.aiDiagnoses).toLocaleString('en-IN')}
          trendPct={k.aiTrend}
          compare={compare}
        />
        <StatCard label="Avg. Order Value" value={formatInr(k.avgOrderValue)} trendPct={k.avgOrderTrend} compare={compare} />
      </View>

      <Panel title="Inventory alerts">
        <View style={styles.alertGrid}>
          <AlertChip label="Low stock" count={a.lowStock} />
          <AlertChip label="Out of stock" count={a.outOfStock} tone="danger" />
          <AlertChip label="Expiring soon" count={a.expiringSoon} tone="warning" />
          <AlertChip label="Pending orders" count={a.pendingOrders} />
        </View>
      </Panel>

      <Panel title="Top products">
        {data.topProducts.length === 0 ? (
          <EmptyState>No product revenue data yet.</EmptyState>
        ) : (
          data.topProducts.map((p, i) => (
            <View key={`${p.title}-${i}`} style={styles.productRow}>
              <Text style={styles.productTitle} numberOfLines={1}>
                {p.title}
              </Text>
              <Text style={styles.productRevenue}>{formatInr(p.revenue)}</Text>
            </View>
          ))
        )}
      </Panel>
    </ConsoleScreenLayout>
  );
}

function AlertChip({
  label,
  count,
  tone = 'default',
}: {
  label: string;
  count: number;
  tone?: 'default' | 'danger' | 'warning';
}) {
  const color = tone === 'danger' ? theme.danger : tone === 'warning' ? theme.warning : theme.green;
  return (
    <View style={styles.alertChip}>
      <Text style={styles.alertChipLabel}>{label}</Text>
      <Text style={[styles.alertChipValue, { color }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  alertGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  alertChip: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eef2ef',
  },
  alertChipLabel: { fontSize: 12, color: theme.muted, marginBottom: 4 },
  alertChipValue: { fontSize: 22, fontWeight: '800' },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  productTitle: { flex: 1, fontSize: 14, color: theme.text, marginRight: 8 },
  productRevenue: { fontSize: 14, fontWeight: '700', color: theme.green },
});
