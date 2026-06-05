import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import { Alert, EmptyState, ListCard, Loading, ReadOnlyBanner } from '@/components/ui';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';

type QueueItem = {
  id: string;
  farmerName: string;
  cropType: string | null;
  district: string | null;
  status: string;
  createdAt: string;
};

export function AgronomistHubPage({ canWrite }: { canWrite: boolean }) {
  const base = '/morbeez-staff/api/v1/os/agronomist';
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ ok: boolean; items: QueueItem[] }>(`${base}/queue`)
      .then((d) => setItems(d.items ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load queue'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ConsoleScreenLayout scroll={false}>
      <Text style={styles.hint}>Field workflow queue — same API as web Agronomist Hub.</Text>
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {loading ? (
        <Loading label="Loading queue…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ListCard
              title={item.farmerName}
              subtitle={[item.cropType, item.district].filter(Boolean).join(' · ') || '—'}
              meta={item.status}
            />
          )}
          ListEmptyComponent={<EmptyState>No cases in queue.</EmptyState>}
        />
      )}
    </ConsoleScreenLayout>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
});
