import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchStoreProducts, formatInr, tokens, type StoreProduct } from '@morbeez/shared';
import { AlertBox, EmptyState, Loading, ProductCard, SectionHeader } from '@morbeez/ui-native';

const SHOP_CATEGORIES = ['Fungicides', 'Insecticides', 'Nutrition', 'Bio Products', 'Growth Promoters'];

export default function CategoryListingScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const category = decodeURIComponent(String(slug ?? ''));
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchStoreProducts({ category, search: search.trim() || undefined, limit: 40 });
      setProducts(data.products);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load products');
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading products…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={products}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={
        <View>
          {error ? <AlertBox>{error}</AlertBox> : null}
          <Text style={styles.title}>{category}</Text>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search in category…"
            placeholderTextColor={tokens.textMuted}
            onSubmitEditing={() => void load()}
          />
        </View>
      }
      ListEmptyComponent={<EmptyState>No products in this category.</EmptyState>}
      renderItem={({ item }) => (
        <ProductCard
          title={item.title}
          price={item.price ? formatInr(parseFloat(item.price)) : '—'}
          imageUrl={item.imageUrl}
          onPress={() => router.push(`/shop/${item.id}`)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 12, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '700', color: tokens.text, marginBottom: 10 },
  search: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: tokens.text,
    marginBottom: 10,
  },
  row: { gap: 10 },
});
