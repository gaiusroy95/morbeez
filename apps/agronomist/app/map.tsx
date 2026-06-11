import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { agronomistClient, tokens } from '@morbeez/shared';
import { AlertBox } from '@morbeez/ui-native';

type MapPin = {
  id: string;
  farmerId: string;
  name: string;
  latitude: number;
  longitude: number;
  subtitle?: string;
};

const DEFAULT_REGION: Region = {
  latitude: 10.8505,
  longitude: 76.2711,
  latitudeDelta: 0.8,
  longitudeDelta: 0.8,
};

export default function MapScreen() {
  const router = useRouter();
  const [pins, setPins] = useState<MapPin[]>([]);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat: number | undefined;
      let lng: number | undefined;
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        setRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        });
      }
      const farmers = await agronomistClient.listFarmers({
        filter: 'nearby',
        lat,
        lng,
        limit: 30,
      });

      const nextPins: MapPin[] = [];
      await Promise.all(
        farmers.map(async (f) => {
          const blocks = await agronomistClient.getFarmerBlocks(f.id);
          const withGps = blocks.find((b) => b.latitude != null && b.longitude != null);
          if (!withGps?.latitude || !withGps.longitude) return;
          nextPins.push({
            id: withGps.id,
            farmerId: f.id,
            name: f.name,
            latitude: withGps.latitude,
            longitude: withGps.longitude,
            subtitle: [f.district, withGps.cropType].filter(Boolean).join(' · '),
          });
        })
      );
      setPins(nextPins);
      if (nextPins.length > 0 && lat == null) {
        setRegion({
          latitude: nextPins[0].latitude,
          longitude: nextPins[0].longitude,
          latitudeDelta: 0.2,
          longitudeDelta: 0.2,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.root}>
      {error ? (
        <View style={styles.banner}>
          <AlertBox>{error}</AlertBox>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={tokens.green700} />
          <Text style={styles.loadingText}>Loading nearby farmers…</Text>
        </View>
      ) : (
        <MapView style={styles.map} region={region} onRegionChangeComplete={setRegion}>
          {pins.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              title={p.name}
              description={p.subtitle}
              onCalloutPress={() => router.push(`/farmer/${p.farmerId}`)}
            />
          ))}
        </MapView>
      )}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{pins.length} plot pins · tap for workspace</Text>
        <Pressable onPress={() => void load()}>
          <Text style={styles.refresh}>Refresh</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  map: { flex: 1 },
  banner: { position: 'absolute', top: 8, left: 8, right: 8, zIndex: 2 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: tokens.textMuted },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    backgroundColor: tokens.card,
  },
  footerText: { fontSize: 13, color: tokens.textMuted },
  refresh: { fontSize: 13, color: tokens.green700, fontWeight: '600' },
});
