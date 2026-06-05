import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import { Alert, ListCard, Loading, ReadOnlyBanner } from '@/components/ui';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';

type Gap = {
  id: string;
  technical_name: string;
  crop_type: string | null;
  district: string | null;
  recommendation_count: number;
  urgency: string;
};

export function ProductGapsPage({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<Gap[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ ok: boolean; gaps: Gap[] }>('/morbeez-staff/api/v1/os/product-gaps')
      .then((d) => setRows(d.gaps ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load product gaps'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ConsoleScreenLayout scroll={false}>
      <Text style={styles.hint}>Product gap signals from intelligence engine.</Text>
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {loading ? (
        <Loading label="Loading product gaps…" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <ListCard
              title={item.technical_name}
              subtitle={[item.crop_type, item.district].filter(Boolean).join(' · ') || '—'}
              meta={`${item.recommendation_count} recs · ${item.urgency}`}
            />
          )}
        />
      )}
    </ConsoleScreenLayout>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
});
