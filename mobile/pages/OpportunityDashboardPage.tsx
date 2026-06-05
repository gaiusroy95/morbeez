import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import { Alert, ListCard, Loading, ReadOnlyBanner, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';

const dashBase = '/morbeez-staff/api/v1/os/intelligence/opportunity-dashboard';

type Overview = {
  kpis: {
    farmersScored: number;
    avgOpportunityScore: number;
    highOpportunityFarmers: number;
    atRiskFarmers: number;
    events30d: number;
    conversions30d: number;
  };
};

type FarmerRow = {
  id: string;
  farmerName: string;
  district: string | null;
  opportunityScore: number;
  cropType: string | null;
};

export function OpportunityDashboardPage({ canWrite }: { canWrite: boolean }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [farmers, setFarmers] = useState<FarmerRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<{ ok: boolean; overview: Overview }>(`${dashBase}/overview?days=30`),
      api<{ ok: boolean; farmers: FarmerRow[] }>(`${dashBase}/farmers/top?limit=30&minScore=50`),
    ])
      .then(([ov, top]) => {
        setOverview(ov.overview);
        setFarmers(top.farmers ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load opportunities'))
      .finally(() => setLoading(false));
  }, []);

  const compare = '30 days';
  const k = overview?.kpis;

  return (
    <ConsoleScreenLayout scroll={false}>
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {loading || !k ? (
        <Loading label="Loading opportunities…" />
      ) : (
        <FlatList
          data={farmers}
          keyExtractor={(r) => r.id}
          ListHeaderComponent={
            <>
              <StatCard label="Farmers scored" value={String(k.farmersScored)} trendPct={0} compare={compare} />
              <StatCard label="High opportunity" value={String(k.highOpportunityFarmers)} trendPct={0} compare={compare} />
              <StatCard label="At risk" value={String(k.atRiskFarmers)} trendPct={0} compare={compare} />
              <StatCard label="Avg score" value={String(k.avgOpportunityScore)} trendPct={0} compare={compare} />
            </>
          }
          renderItem={({ item }) => (
            <ListCard
              title={item.farmerName}
              subtitle={[item.cropType, item.district].filter(Boolean).join(' · ') || '—'}
              meta={`Score ${item.opportunityScore}`}
            />
          )}
        />
      )}
    </ConsoleScreenLayout>
  );
}

const styles = StyleSheet.create({});
