import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { formatDate, partnerClient, tokens } from '@morbeez/shared';
import {AlertBox, Btn, EmptyState, Loading, Panel, stableRowKey } from '@morbeez/ui-native';

type LeadOffer = {
  id: string;
  farmerName?: string;
  phone?: string;
  district?: string;
  offeredAt?: string;
  allocationScore?: number;
};

function parseOffer(raw: Record<string, unknown>): LeadOffer {
  const farmers = raw.farmers as Record<string, unknown> | undefined;
  const leads = raw.leads as Record<string, unknown> | undefined;
  return {
    id: String(raw.id),
    farmerName: farmers?.name ? String(farmers.name) : undefined,
    phone: farmers?.phone ? String(farmers.phone) : undefined,
    district: farmers?.district ? String(farmers.district) : undefined,
    offeredAt: raw.offered_at ? String(raw.offered_at) : undefined,
    allocationScore: raw.allocation_score != null ? Number(raw.allocation_score) : undefined,
  };
}

export default function LeadsScreen() {
  const [offers, setOffers] = useState<LeadOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await partnerClient.listLeadOffers();
      setOffers(rows.map((r) => parseOffer(r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lead offers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(id: string, action: 'accepted' | 'declined') {
    setBusy(id);
    try {
      await partnerClient.respondLeadOffer(id, action);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not respond to offer');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loading label="Loading lead offers…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={offers}
      keyExtractor={(o, i) => stableRowKey(o.id, i)}
      ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
      ListEmptyComponent={<EmptyState>No pending lead offers.</EmptyState>}
      renderItem={({ item }) => (
        <Panel title={item.farmerName ?? 'Lead offer'}>
          {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
          {item.district ? <Text style={styles.meta}>{item.district}</Text> : null}
          {item.offeredAt ? <Text style={styles.meta}>Offered {formatDate(item.offeredAt)}</Text> : null}
          {item.allocationScore != null ? (
            <Text style={styles.meta}>Match score {item.allocationScore}</Text>
          ) : null}
          <View style={styles.actions}>
            <Btn
              label="Accept"
              onPress={() => void respond(item.id, 'accepted')}
              disabled={busy === item.id}
            />
            <Btn
              label="Decline"
              variant="secondary"
              onPress={() => void respond(item.id, 'declined')}
              disabled={busy === item.id}
            />
          </View>
        </Panel>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 8 },
  meta: { fontSize: 13, color: tokens.textMuted, marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
