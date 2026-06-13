import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, telecallerClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, Loading, Panel } from '@morbeez/ui-native';

const STATUS_OPTIONS = [
  { value: 'follow_up_required', label: 'Follow-up required' },
  { value: 'hot_lead', label: 'Hot lead' },
  { value: 'ready_to_order', label: 'Ready to order' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
] as const;

export function SalesOpportunitiesPanel() {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setItems(await telecallerClient.listSalesOpportunities());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sales opportunities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      await telecallerClient.updateSalesOpportunityStatus(id, status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !items.length) return <Loading label="Loading sales opportunities…" />;

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
      }
      contentContainerStyle={styles.content}
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      {!items.length ? (
        <EmptyState>No partner sales opportunities assigned to you.</EmptyState>
      ) : (
        items.map((opp) => {
          const id = String(opp.id);
          const farmers = opp.farmers as Record<string, unknown> | null;
          const farmerName = String(
            (farmers?.name as string | undefined) ||
              [farmers?.first_name, farmers?.last_name].filter(Boolean).join(' ') ||
              'Farmer'
          );
          const leadId = opp.lead_id ? String(opp.lead_id) : undefined;
          return (
            <Panel key={id} title={String(opp.product ?? 'Product')}>
              <Text style={styles.meta}>
                {farmerName} · {String(opp.status ?? 'interested')}
              </Text>
              {opp.notes ? <Text style={styles.notes}>{String(opp.notes)}</Text> : null}
              <Text style={styles.time}>
                {opp.created_at ? formatDate(String(opp.created_at)) : '—'}
              </Text>
              {leadId ? (
                <Btn
                  label="Open lead workspace"
                  variant="secondary"
                  onPress={() => router.push(`/lead/${leadId}`)}
                />
              ) : null}
              <View style={styles.actions}>
                {STATUS_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={styles.chip}
                    disabled={busyId === id}
                    onPress={() => void updateStatus(id, opt.value)}
                  >
                    <Text style={styles.chipText}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Panel>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  meta: { fontSize: 13, color: tokens.textMuted, marginBottom: 4 },
  notes: { fontSize: 14, color: tokens.text, marginBottom: 4 },
  time: { fontSize: 12, color: tokens.textMuted, marginBottom: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  chipText: { fontSize: 12, color: tokens.green700, fontWeight: '600' },
});
