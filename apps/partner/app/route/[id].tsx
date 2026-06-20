import { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import {
  coordSourceLabel,
  partnerClient,
  tokens,
  type AgentRouteSummary,
} from '@morbeez/shared';
import {AlertBox, Btn, EmptyState, KeyValueRow, ListCard, Loading, Panel, stableRowKey } from '@morbeez/ui-native';

export default function PartnerRouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = String(id ?? '');
  const [route, setRoute] = useState<AgentRouteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!routeId) return;
    setError('');
    try {
      setRoute(await partnerClient.getRoute(routeId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load route');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function optimize() {
    setBusy(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat: number | undefined;
      let lng: number | undefined;
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
      setRoute(await partnerClient.optimizeRoute(routeId, lat, lng));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Optimize failed');
    } finally {
      setBusy(false);
    }
  }

  function openMaps() {
    if (!route?.stops.length) return;
    const withCoords = route.stops.filter((s) => s.latitude != null && s.longitude != null);
    if (withCoords.length === 0) {
      setError('No coordinates on stops yet.');
      return;
    }
    const origin = withCoords[0];
    const dest = withCoords[withCoords.length - 1];
    const waypoints = withCoords.slice(1, -1).map((s) => `${s.latitude},${s.longitude}`).join('|');
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?saddr=${origin.latitude},${origin.longitude}&daddr=${dest.latitude},${dest.longitude}${waypoints ? `&waypoints=${waypoints}` : ''}`
        : `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}`;
    void Linking.openURL(url);
  }

  if (loading) return <Loading label="Loading route…" />;
  if (!route) {
    return (
      <View style={styles.center}>
        {error ? <AlertBox>{error}</AlertBox> : <Text style={styles.muted}>Route not found.</Text>}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={route.stops}
        keyExtractor={(s, i) => stableRowKey(s.id, i)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {error ? <AlertBox>{error}</AlertBox> : null}
            <Panel title={route.routeName}>
              <KeyValueRow label="Date" value={route.routeDate} />
              <KeyValueRow label="Status" value={route.status} />
              <KeyValueRow label="Stops" value={String(route.stopCount)} />
              {route.pincodeClusters?.length ? (
                <KeyValueRow label="Pincode areas" value={String(route.pincodeClusters.length)} />
              ) : null}
              {route.estimatedDistanceKm != null ? (
                <KeyValueRow label="Distance" value={`${route.estimatedDistanceKm.toFixed(1)} km`} />
              ) : null}
              {route.estimatedHours != null ? (
                <KeyValueRow label="Est. time" value={`${route.estimatedHours.toFixed(1)} h`} />
              ) : null}
              <View style={styles.actions}>
                <Btn label={busy ? 'Optimizing…' : 'Optimize route'} onPress={optimize} disabled={busy} />
                <Btn label="Open in maps" onPress={openMaps} variant="secondary" />
              </View>
            </Panel>
            {route.pincodeClusters?.length ? (
              <Panel title="Pincode clusters">
                {route.pincodeClusters.map((c, i) => (
                  <Text key={`${c.pincode ?? 'unknown'}-${i}`} style={styles.clusterLine}>
                    {c.pincode ? `PIN ${c.pincode}` : 'Unknown area'} · {c.stopCount} stop(s)
                  </Text>
                ))}
              </Panel>
            ) : null}
            <Text style={styles.section}>Stops (optimized order)</Text>
          </>
        }
        renderItem={({ item, index }) => (
          <ListCard
            title={`${index + 1}. ${item.farmerName}`}
            subtitle={[
              item.blockName,
              item.pincode ? `PIN ${item.pincode}` : null,
              coordSourceLabel(item.coordSource),
            ]
              .filter(Boolean)
              .join(' · ')}
            meta={
              item.latitude != null && item.longitude != null
                ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
                : 'No coordinates'
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState>Add farmers from their workspace using &quot;Add to route&quot;.</EmptyState>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  muted: { color: tokens.textMuted, textAlign: 'center' },
  actions: { gap: 8, marginTop: 8 },
  section: { fontSize: 16, fontWeight: '600', color: tokens.text, marginTop: 8, marginBottom: 8 },
  clusterLine: { fontSize: 13, color: tokens.textMuted, marginBottom: 4 },
});
