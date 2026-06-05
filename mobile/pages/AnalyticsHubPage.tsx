import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import { Alert, HubTabs, KeyValueRow, ListCard, Loading, Panel, ReadOnlyBanner, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { theme } from '@/lib/theme';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';

const base = '/morbeez-staff/api/v1/os/analytics';

type Tab = 'summary' | 'geography' | 'retention';

type Summary = {
  periodDays: number;
  kpis: {
    farmers: number;
    activeFarmers30d: number;
    retentionRate30d: number;
    broadcastsSent: number;
    recommendationsTotal: number;
    topDistrict: string;
    aiDiagnosisCount: number;
  };
  geography: {
    districts: Array<{ district: string; farmers: number; recommendations: number }>;
  };
  retention: {
    active7d: number;
    active30d: number;
    rate7d: number;
    rate30d: number;
    inactive90d: number;
  };
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'geography', label: 'Districts' },
  { id: 'retention', label: 'Retention' },
];

export function AnalyticsHubPage() {
  const [tab, setTab] = useState<Tab>('summary');
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean } & Summary>(`${base}/summary?days=30`);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const compare = 'prior 30 days';

  return (
    <ConsoleScreenLayout scroll={false}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {error ? <Alert>{error}</Alert> : null}
      {loading || !data ? (
        <Loading label="Loading analytics…" />
      ) : tab === 'summary' ? (
        <>
          <StatCard label="Farmers" value={String(data.kpis.farmers)} trendPct={0} compare={compare} />
          <StatCard label="Active (30d)" value={String(data.kpis.activeFarmers30d)} trendPct={0} compare={compare} />
          <StatCard
            label="Retention (30d)"
            value={`${data.kpis.retentionRate30d}%`}
            trendPct={0}
            compare={compare}
          />
          <StatCard label="Broadcasts" value={String(data.kpis.broadcastsSent)} trendPct={0} compare={compare} />
          <StatCard label="AI diagnoses" value={String(data.kpis.aiDiagnosisCount)} trendPct={0} compare={compare} />
          <Panel title="Top district">
            <Text style={styles.highlight}>{data.kpis.topDistrict || '—'}</Text>
          </Panel>
        </>
      ) : tab === 'geography' ? (
        <FlatList
          data={data.geography.districts}
          keyExtractor={(d) => d.district}
          renderItem={({ item }) => (
            <ListCard
              title={item.district}
              subtitle={`${item.farmers} farmers`}
              meta={`${item.recommendations} recommendations`}
            />
          )}
        />
      ) : (
        <Panel title="Retention">
          <KeyValueRow label="Active 7d" value={String(data.retention.active7d)} />
          <KeyValueRow label="Active 30d" value={String(data.retention.active30d)} />
          <KeyValueRow label="Rate 7d" value={`${data.retention.rate7d}%`} />
          <KeyValueRow label="Rate 30d" value={`${data.retention.rate30d}%`} />
          <KeyValueRow label="Inactive 90d+" value={String(data.retention.inactive90d)} />
        </Panel>
      )}
    </ConsoleScreenLayout>
  );
}

const styles = StyleSheet.create({
  highlight: { fontSize: 18, fontWeight: '700', color: theme.green },
});
