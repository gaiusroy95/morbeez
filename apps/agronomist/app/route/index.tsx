import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { agronomistClient, tokens, type AgronomistRouteSummary } from '@morbeez/shared';
import {AlertBox, Btn, EmptyState, ListCard, Loading, stableRowKey } from '@morbeez/ui-native';

export default function RouteListScreen() {
  const router = useRouter();
  const [routes, setRoutes] = useState<AgronomistRouteSummary[]>([]);
  const [routeName, setRouteName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setRoutes(await agronomistClient.listRoutes());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load routes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRoute() {
    const name = routeName.trim() || `Route ${new Date().toLocaleDateString()}`;
    setBusy(true);
    setError('');
    try {
      const route = await agronomistClient.createRoute(name);
      setRouteName('');
      router.push(`/route/${route.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create route');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading routes…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={routes}
        keyExtractor={(r, i) => stableRowKey(r.id, i)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {error ? <AlertBox>{error}</AlertBox> : null}
            <Text style={styles.label}>New route name</Text>
            <TextInput
              style={styles.input}
              value={routeName}
              onChangeText={setRouteName}
              placeholder="Morning cluster"
              placeholderTextColor={tokens.textMuted}
            />
            <Btn label={busy ? 'Creating…' : 'Create route'} onPress={createRoute} disabled={busy} />
            <Text style={styles.section}>Today&apos;s routes</Text>
          </>
        }
        renderItem={({ item }) => (
          <ListCard
            title={item.routeName}
            subtitle={`${item.stopCount} stops · ${item.pincodeClusters?.length ?? 0} pincode area(s) · ${item.status}`}
            meta={
              item.estimatedDistanceKm != null
                ? `${item.estimatedDistanceKm.toFixed(1)} km`
                : item.routeDate
            }
            onPress={() => router.push(`/route/${item.id}`)}
          />
        )}
        ListEmptyComponent={<EmptyState>No routes planned for today.</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: tokens.text,
    marginBottom: 8,
  },
  section: { fontSize: 16, fontWeight: '600', color: tokens.text, marginTop: 16, marginBottom: 8 },
});
