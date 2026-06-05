import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import { Alert, EmptyState, ListCard, Loading, ReadOnlyBanner } from '@/components/ui';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';

type ApprovalListItem = {
  id: string;
  status: string;
  farmerName: string | null;
  cropType: string | null;
  recommendationText: string;
  createdAt: string;
};

export function ApprovalsPage({
  canApprove,
  canWrite,
}: {
  canApprove: boolean;
  canWrite: boolean;
}) {
  const [items, setItems] = useState<ApprovalListItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ ok: boolean; items: ApprovalListItem[] }>(
      '/morbeez-staff/api/v1/os/recommendations/approvals?status=pending&mine=0'
    )
      .then((r) => setItems(r.items ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load approvals'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ConsoleScreenLayout scroll={false}>
      <Text style={styles.hint}>
        Review agronomist recommendations — same pending list as web Approvals workspace.
      </Text>
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {loading ? (
        <Loading label="Loading approvals…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ListCard
              title={item.farmerName ?? 'Farmer'}
              subtitle={item.recommendationText}
              meta={[item.cropType, item.status].filter(Boolean).join(' · ') || undefined}
            />
          )}
          ListEmptyComponent={
            <EmptyState>{canApprove ? 'No pending approvals.' : 'Nothing to review.'}</EmptyState>
          }
        />
      )}
    </ConsoleScreenLayout>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
});
