import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchStoreBanners,
  fetchStoreProducts,
  fetchStoreRecommendations,
  formatInr,
  t,
  tokens,
  type StoreProduct,
} from '@morbeez/shared';
import { AlertBox, EmptyState, Loading, ProductCard, PromoBanner, SectionHeader } from '@morbeez/ui-native';
import { useShopCart } from '@/context/ShopCartContext';
import { useLocale } from '@/context/LocaleContext';

const SHOP_CATEGORIES = ['Fungicides', 'Insecticides', 'Nutrition', 'Bio Products', 'Growth Promoters'];

export default function ShopScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { locale } = useLocale();
  const { count } = useShopCart();
  const params = useLocalSearchParams<{ q?: string }>();
  const [search, setSearch] = useState(params.q ? String(params.q) : '');
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [banners, setBanners] = useState<Awaited<ReturnType<typeof fetchStoreBanners>>>([]);
  const [recommended, setRecommended] = useState<StoreProduct[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => router.push('/shop/cart')}
          style={styles.headerCart}
          accessibilityLabel="Open cart"
        >
          <Ionicons name="cart-outline" size={22} color="#fff" />
          {count > 0 ? (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{count > 99 ? '99+' : count}</Text>
            </View>
          ) : null}
        </Pressable>
      ),
    });
  }, [navigation, count, router]);

  const load = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) setError('');
      try {
        const [data, bannerRows, reco] = await Promise.all([
          fetchStoreProducts({
            page: pageNum,
            limit: 20,
            search: search.trim() || undefined,
            category: category ?? undefined,
          }),
          pageNum === 1 ? fetchStoreBanners('home_hero').catch(() => []) : Promise.resolve([]),
          pageNum === 1 ? fetchStoreRecommendations().catch(() => []) : Promise.resolve([]),
        ]);
        if (pageNum === 1) {
          setBanners(bannerRows);
          setRecommended(reco);
        }
        setCategories(data.categories);
        setPages(data.pagination.pages);
        setPage(data.pagination.page);
        setProducts((prev) => (replace ? data.products : [...prev, ...data.products]));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load products');
      }
    },
    [search, category]
  );

  useEffect(() => {
    setLoading(true);
    void load(1, true).finally(() => setLoading(false));
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load(1, true);
    setRefreshing(false);
  }

  async function loadMore() {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    await load(page + 1, false);
    setLoadingMore(false);
  }

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          {error ? <AlertBox>{error}</AlertBox> : null}
          {banners.map((b) => (
            <PromoBanner
              key={b.id}
              title={b.title}
              subtitle={b.subtitle ?? undefined}
              onPress={() => {
                if (b.linkUrl) router.push(b.linkUrl as '/shop/cart');
              }}
            />
          ))}
          {recommended.length ? (
            <>
              <SectionHeader title="Recommended for you" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recoRow}>
                {recommended.map((item) => (
                  <View key={item.id} style={styles.recoCard}>
                    <ProductCard
                      title={item.title}
                      price={item.price ? formatInr(parseFloat(item.price)) : '—'}
                      imageUrl={item.imageUrl}
                      onPress={() => router.push(`/shop/${item.id}`)}
                    />
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search products…"
            placeholderTextColor={tokens.textMuted}
            returnKeyType="search"
            onSubmitEditing={() => void load(1, true)}
          />
          {categories.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Pressable
                style={[styles.chip, !category && styles.chipActive]}
                onPress={() => setCategory(null)}
              >
                <Text style={[styles.chipText, !category && styles.chipTextActive]}>All</Text>
              </Pressable>
              {categories.map((c) => {
                const active = category === c;
                return (
                  <Pressable
                    key={c}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          <SectionHeader title="Browse by category" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {SHOP_CATEGORIES.map((c) => (
              <Pressable
                key={c}
                style={styles.chip}
                onPress={() => router.push(`/shop/category/${encodeURIComponent(c)}`)}
              >
                <Text style={styles.chipText}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <SectionHeader title="All products" />
        </View>
      }
      ListEmptyComponent={<EmptyState>No products found. Try another search.</EmptyState>}
      renderItem={({ item }) => {
        const price = item.price ? formatInr(parseFloat(item.price)) : '—';
        const outOfStock = item.inventory <= 0;
        return (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/shop/${item.id}`)}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.imagePh]} />
            )}
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.price}>{price}</Text>
            {outOfStock ? <Text style={styles.oos}>Out of stock</Text> : null}
          </Pressable>
        );
      }}
      ListFooterComponent={
        loadingMore ? <Text style={styles.footer}>Loading more…</Text> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 12, paddingBottom: 32 },
  headerBlock: { marginBottom: 8 },
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
  chips: { gap: 8, paddingBottom: 8 },
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
  row: { gap: 10 },
  card: {
    flex: 1,
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 10,
    marginBottom: 10,
    maxWidth: '50%',
  },
  image: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 8 },
  imagePh: { backgroundColor: tokens.border },
  title: { fontSize: 13, fontWeight: '600', color: tokens.text, minHeight: 34 },
  price: { fontSize: 14, fontWeight: '700', color: tokens.green800, marginTop: 4 },
  oos: { fontSize: 11, color: tokens.danger, marginTop: 2 },
  headerCart: { marginRight: 12, padding: 4, position: 'relative' },
  headerBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  footer: { textAlign: 'center', color: tokens.textMuted, paddingVertical: 12 },
  recoRow: { paddingBottom: 12, gap: 10 },
  recoCard: { width: 160, marginRight: 10 },
});
