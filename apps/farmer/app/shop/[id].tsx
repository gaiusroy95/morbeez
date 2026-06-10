import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  fetchProductReviews,
  fetchStoreProduct,
  formatInr,
  formatDate,
  priceToPaise,
  stripHtml,
  tokens,
  type StoreProduct,
  type StoreVariant,
} from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel } from '@morbeez/ui-native';
import { useShopCart } from '@/context/ShopCartContext';

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <Text style={styles.stars}>
      {'★'.repeat(full)}
      {'☆'.repeat(Math.max(0, 5 - full))}
    </Text>
  );
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addItem } = useShopCart();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [reviews, setReviews] = useState<Awaited<ReturnType<typeof fetchProductReviews>> | null>(null);
  const [variant, setVariant] = useState<StoreVariant | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const p = await fetchStoreProduct(String(id));
        setProduct(p);
        const inStock = p.variants.find((v) => v.inventory > 0) ?? p.variants[0] ?? null;
        setVariant(inStock);
        setReviews(await fetchProductReviews(p.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load product');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const description = useMemo(
    () => (product?.bodyHtml ? stripHtml(product.bodyHtml) : ''),
    [product?.bodyHtml]
  );

  function addToCart() {
    if (!product || !variant) return;
    if (variant.inventory <= 0) {
      setError('This pack size is out of stock');
      return;
    }
    addItem({
      productId: product.id,
      variantId: variant.id,
      title: product.title,
      variantTitle: variant.option1 || variant.title,
      imageUrl: product.imageUrl,
      pricePaise: priceToPaise(variant.price),
      maxQuantity: Math.max(1, variant.inventory),
      quantity: 1,
    });
    setMessage('Added to cart');
    setError('');
  }

  function buyNow() {
    addToCart();
    router.push('/shop/checkout');
  }

  if (loading) return <Loading label="Loading product…" />;
  if (!product) {
    return (
      <View style={styles.centered}>
        <AlertBox>{error || 'Product not found'}</AlertBox>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, styles.heroPh]} />
      )}

      <Text style={styles.title}>{product.title}</Text>
      <Text style={styles.meta}>{product.category}{product.vendor ? ` · ${product.vendor}` : ''}</Text>

      {reviews && reviews.reviewCount > 0 ? (
        <View style={styles.reviewSummary}>
          <Stars rating={reviews.averageRating} />
          <Text style={styles.reviewMeta}>
            {reviews.averageRating} ({reviews.reviewCount} review{reviews.reviewCount === 1 ? '' : 's'})
          </Text>
        </View>
      ) : (
        <Text style={styles.reviewMeta}>No reviews yet</Text>
      )}

      {variant ? (
        <Text style={styles.price}>
          {formatInr(parseFloat(variant.price))}
          {variant.mrp && variant.mrp !== variant.price ? (
            <Text style={styles.mrp}>  MRP {formatInr(parseFloat(variant.mrp))}</Text>
          ) : null}
        </Text>
      ) : null}

      {product.variants.length > 1 ? (
        <Panel title="Pack size">
          <View style={styles.variantRow}>
            {product.variants.map((v) => {
              const active = variant?.id === v.id;
              const disabled = v.inventory <= 0;
              return (
                <Pressable
                  key={v.id}
                  style={[styles.variantChip, active && styles.variantChipActive, disabled && styles.variantChipDisabled]}
                  onPress={() => !disabled && setVariant(v)}
                  disabled={disabled}
                >
                  <Text style={[styles.variantChipText, active && styles.variantChipTextActive]}>
                    {v.option1 || v.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Panel>
      ) : null}

      {description ? (
        <Panel title="About">
          <Text style={styles.body}>{description}</Text>
          <Text style={styles.meta}>Suitable crops: {product.category}</Text>
          <Text style={styles.meta}>Usage: follow agronomist recommendation and label directions.</Text>
        </Panel>
      ) : null}

      {reviews?.reviews?.length ? (
        <Panel title="Farmer reviews">
          {reviews.reviews.slice(0, 5).map((r, idx) => (
            <View key={`${r.createdAt}-${idx}`} style={styles.reviewItem}>
              <Stars rating={r.rating} />
              {r.reviewText ? <Text style={styles.body}>{r.reviewText}</Text> : null}
              <Text style={styles.reviewDate}>{formatDate(r.createdAt)}</Text>
            </View>
          ))}
        </Panel>
      ) : null}

      <Btn label="Add to cart" onPress={addToCart} disabled={!variant || variant.inventory <= 0} />
      <Btn label="Buy now" onPress={buyNow} disabled={!variant || variant.inventory <= 0} />
      <Btn label="View cart" variant="secondary" onPress={() => router.push('/shop/cart')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: tokens.bg },
  hero: { width: '100%', aspectRatio: 1, borderRadius: tokens.radiusSm, marginBottom: 12 },
  heroPh: { backgroundColor: tokens.border },
  title: { fontSize: 22, fontWeight: '700', color: tokens.text, marginBottom: 4 },
  meta: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  price: { fontSize: 20, fontWeight: '700', color: tokens.green800, marginBottom: 12 },
  mrp: { fontSize: 14, color: tokens.textMuted, fontWeight: '400' },
  reviewSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  stars: { color: '#f5a623', fontSize: 16 },
  reviewMeta: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variantChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
  },
  variantChipActive: { borderColor: tokens.green500, backgroundColor: tokens.green100 },
  variantChipDisabled: { opacity: 0.45 },
  variantChipText: { fontSize: 13, color: tokens.text },
  variantChipTextActive: { color: tokens.green800, fontWeight: '600' },
  body: { fontSize: 14, color: tokens.text, lineHeight: 20 },
  reviewItem: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.border },
  reviewDate: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  success: { color: tokens.green700, marginBottom: 8, fontWeight: '600' },
});
