import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { fetchStoreProducts, formatInr, t, tokens, type StoreProduct } from '@morbeez/shared';
import { AlertBox, EmptyState, HubTabs, Loading, ProductCard } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

type SortKey = 'featured' | 'price_low' | 'price_high';

export default function CategoryListingScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const category = decodeURIComponent(String(slug ?? ''));
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [stockOnly, setStockOnly] = useState(false);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      setRefreshing(false);
    }
  }, [category, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    let list = [...products];
    if (stockOnly) list = list.filter((p) => p.inventory > 0);
    if (sort === 'price_low') {
      list.sort((a, b) => parseFloat(a.price || '0') - parseFloat(b.price || '0'));
    } else if (sort === 'price_high') {
      list.sort((a, b) => parseFloat(b.price || '0') - parseFloat(a.price || '0'));
    }
    return list;
  }, [products, sort, stockOnly]);

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={visible}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
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
          <HubTabs
            tabs={[
              { id: 'featured' as SortKey, label: 'Featured' },
              { id: 'price_low' as SortKey, label: 'Price ↑' },
              { id: 'price_high' as SortKey, label: 'Price ↓' },
            ]}
            active={sort}
            onChange={setSort}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <Pressable style={[styles.chip, !stockOnly && styles.chipActive]} onPress={() => setStockOnly(false)}>
              <Text style={[styles.chipText, !stockOnly && styles.chipTextActive]}>All</Text>
            </Pressable>
            <Pressable style={[styles.chip, stockOnly && styles.chipActive]} onPress={() => setStockOnly(true)}>
              <Text style={[styles.chipText, stockOnly && styles.chipTextActive]}>In stock</Text>
            </Pressable>
          </ScrollView>
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
  filters: { gap: 8, paddingVertical: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: tokens.green100, borderColor: tokens.green500 },
  chipText: { fontSize: 13, color: tokens.textMuted },
  chipTextActive: { color: tokens.green800, fontWeight: '600' },
});
