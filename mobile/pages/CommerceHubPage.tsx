import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import {
  Alert,
  EmptyState,
  HubTabs,
  ListCard,
  Loading,
  Panel,
  ReadOnlyBanner,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatInr } from '@/lib/format';
import { theme } from '@/lib/theme';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

type Tab = 'products' | 'orders' | 'farmers';

type ProductRow = {
  id: string;
  title: string;
  status: string;
  category: string | null;
  brand: string | null;
  priceInr: number | null;
  stockQty: number | null;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  farmerName: string;
  totalInr: number;
  status: string;
  createdAt: string;
};

type FarmerRow = {
  id: string;
  name: string;
  phone: string | null;
  district: string | null;
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'farmers', label: 'Farmers' },
];

export function CommerceHubPage({ canWrite = false }: { canWrite?: boolean }) {
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [farmers, setFarmers] = useState<FarmerRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'products') {
        const d = await api<{ ok: boolean; products: ProductRow[] }>(
          '/morbeez-staff/api/v1/products?page=1&limit=50'
        );
        setProducts(d.products ?? []);
      } else if (tab === 'orders') {
        const d = await api<{ ok: boolean; orders: OrderRow[] }>(
          '/morbeez-staff/api/v1/orders?page=1&limit=50'
        );
        setOrders(d.orders ?? []);
      } else {
        const d = await api<{ ok: boolean; farmers: FarmerRow[] }>(
          '/morbeez-staff/api/v1/farmers?page=1&limit=50'
        );
        setFarmers(d.farmers ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load commerce data');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ConsoleScreenLayout scroll={false}>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert>{error}</Alert> : null}

      {loading ? (
        <Loading label="Loading commerce…" />
      ) : tab === 'products' ? (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            canWrite ? (
              <Panel title="Products">
                <Text style={styles.hint}>Tap a product to view details. Add/edit uses the same API as web console.</Text>
              </Panel>
            ) : null
          }
          renderItem={({ item }) => (
            <ListCard
              title={item.title}
              subtitle={[item.category, item.brand].filter(Boolean).join(' · ') || item.status}
              meta={
                item.priceInr != null
                  ? `${formatInr(item.priceInr)} · Stock ${item.stockQty ?? 0}`
                  : undefined
              }
              onPress={() =>
                router.push(`/(app)/commerce/products/${item.id}/edit` as Href)
              }
            />
          )}
          ListEmptyComponent={<EmptyState>No products found.</EmptyState>}
        />
      ) : tab === 'orders' ? (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListCard
              title={`#${item.orderNumber}`}
              subtitle={item.farmerName}
              meta={`${formatInr(item.totalInr)} · ${item.status}`}
            />
          )}
          ListEmptyComponent={<EmptyState>No orders found.</EmptyState>}
        />
      ) : (
        <FlatList
          data={farmers}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListCard
              title={item.name}
              subtitle={item.phone ?? '—'}
              meta={item.district ?? undefined}
            />
          )}
          ListEmptyComponent={<EmptyState>No farmers found.</EmptyState>}
        />
      )}
    </ConsoleScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  hint: { fontSize: 13, color: theme.muted },
});
