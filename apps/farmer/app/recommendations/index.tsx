import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import {
  fetchRecommendations,
  markRecommendationApplied,
  tokens,
  type FarmerRecommendation,
} from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, Loading, Panel, SectionHeader } from '@morbeez/ui-native';
import { BulletList, WhatsAppBtn } from '@/components/PortalHelpers';
import { whatsAppUrl } from '@/lib/config';

export default function RecommendationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<FarmerRecommendation[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchRecommendations()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load recommendations'))
      .finally(() => setLoading(false));
  }, []);

  async function markApplied(id: string) {
    try {
      await markRecommendationApplied(id);
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'applied' } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    }
  }

  if (loading) return <Loading label="Loading recommendations…" />;

  const technical = items.filter((r) => r.kind === 'technical');
  const product = items.filter((r) => r.kind === 'product');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {!items.length ? <EmptyState>No recommendations yet. Run an AI scan or wait for agronomist advice.</EmptyState> : null}

      {technical.length ? (
        <>
          <SectionHeader title="Technical advisory" />
          {technical.map((r) => (
            <Panel key={r.id} title={r.title}>
              <BulletList items={r.bullets} />
              {r.dosage ? <Text style={styles.meta}>Dosage: {r.dosage}</Text> : null}
              {r.followUpDate ? <Text style={styles.meta}>Follow-up: {r.followUpDate}</Text> : null}
              <Btn label="Details" variant="secondary" onPress={() => router.push(`/recommendations/${r.id}`)} />
              <Btn label="Mark applied" onPress={() => void markApplied(r.id)} />
            </Panel>
          ))}
        </>
      ) : null}

      {product.length ? (
        <>
          <SectionHeader title="Product recommendation" />
          {product.map((r) => (
            <Panel key={r.id} title={r.title}>
              <BulletList items={r.bullets.length ? r.bullets : r.products.map((p) => p.title)} />
              <Btn label="View details" variant="secondary" onPress={() => router.push(`/recommendations/${r.id}`)} />
              <Btn label="Mark applied" onPress={() => void markApplied(r.id)} />
            </Panel>
          ))}
        </>
      ) : null}

      <WhatsAppBtn label="Request support" message="I need help with my crop recommendation" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  meta: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
});
