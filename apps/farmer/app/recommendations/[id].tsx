import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchRecommendationDetail, t, tokens, type RecommendationDetail } from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel } from '@morbeez/ui-native';
import { BulletList } from '@/components/PortalHelpers';
import { useShopCart } from '@/context/ShopCartContext';
import { buildCartItemFromRecommendationProduct } from '@/lib/shop-helpers';

export default function RecommendationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addItem } = useShopCart();
  const [rec, setRec] = useState<RecommendationDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void fetchRecommendationDetail(String(id))
      .then(setRec)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load recommendation'))
      .finally(() => setLoading(false));
  }, [id]);

  async function addAllToCart() {
    if (!rec?.products.length) return;
    try {
      let added = 0;
      for (const p of rec.products) {
        const item = await buildCartItemFromRecommendationProduct(p, {
          recommendationId: rec.id,
          recoveryPurpose: rec.title,
        });
        if (item) {
          addItem(item);
          added++;
        }
      }
      if (!added) {
        setError('Products not found in shop catalog');
        return;
      }
      router.push('/shop/cart');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add products');
    }
  }

  if (loading) return <Loading label="Loading recommendation…" />;
  if (!rec) return <AlertBox>{error || 'Not found'}</AlertBox>;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title={rec.title}>
        <Text style={styles.meta}>{rec.cropName}{rec.blockName ? ` · ${rec.blockName}` : ''} · {rec.dateLabel}</Text>
        {rec.dosage ? <Text style={styles.body}>Dosage: {rec.dosage}</Text> : null}
        {rec.applicationTiming ? <Text style={styles.body}>Timing: {rec.applicationTiming}</Text> : null}
        {rec.recoveryTimeline ? <Text style={styles.body}>{rec.recoveryTimeline}</Text> : null}
      </Panel>
      <Panel title="Application steps">
        <BulletList items={rec.applicationSteps} />
      </Panel>
      {rec.products.length ? (
        <Panel title="Products">
          {rec.products.map((p) => (
            <Text key={p.title} style={styles.body}>• {p.title}{p.quantity ? ` × ${p.quantity}` : ''}</Text>
          ))}
          <Btn label="Add all to cart" onPress={() => void addAllToCart()} />
        </Panel>
      ) : null}
      <Btn label={t('shop', 'en')} variant="secondary" onPress={() => router.push('/(tabs)/shop')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  meta: { fontSize: 12, color: tokens.textMuted, marginBottom: 8 },
  body: { fontSize: 14, color: tokens.text, marginBottom: 4 },
});
