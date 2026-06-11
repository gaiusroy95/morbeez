import { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { agronomistClient, tokens, type AgronomistRouteSummary } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, KeyValueRow, ListCard, Loading, Panel } from '@morbeez/ui-native';

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = String(id ?? '');
  const [route, setRoute] = useState<AgronomistRouteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!routeId) return;
    setError('');
    try {
      setRoute(await agronomistClient.getRoute(routeId));
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
      setRoute(await agronomistClient.optimizeRoute(routeId, lat, lng));
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
      setError('No GPS coordinates on stops yet.');
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
        keyExtractor={(s) => s.id}
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
            <Text style={styles.section}>Stops</Text>
          </>
        }
        renderItem={({ item, index }) => (
          <ListCard
            title={`${index + 1}. ${item.farmerName}`}
            subtitle={
              item.latitude != null && item.longitude != null
                ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
                : 'No GPS'
            }
          />
        )}
        ListEmptyComponent={<EmptyState>No stops on this route yet.</EmptyState>}
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
});
