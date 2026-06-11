import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { agronomistClient, t, tokens } from '@morbeez/shared';
import { AlertBox, Btn } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

type MapPin = {
  id: string;
  farmerId: string;
  name: string;
  latitude: number;
  longitude: number;
  subtitle?: string;
};

function openInMaps(lat: number, lng: number) {
  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
}

export default function MapScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat: number | undefined;
      let lng: number | undefined;
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
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
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      {error ? <AlertBox>{error}</AlertBox> : null}

      {loading && pins.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={tokens.green700} />
          <Text style={styles.loadingText}>{t('loading', locale)}</Text>
        </View>
      ) : null}

      {!loading && pins.length === 0 ? (
        <Text style={styles.empty}>No GPS-tagged plots found nearby.</Text>
      ) : null}

      {pins.map((p) => (
        <View key={p.id} style={styles.card}>
          <Pressable style={styles.cardMain} onPress={() => router.push(`/farmer/${p.farmerId}`)}>
            <Text style={styles.name}>{p.name}</Text>
            {p.subtitle ? <Text style={styles.subtitle}>{p.subtitle}</Text> : null}
            <Text style={styles.coords}>
              {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
            </Text>
          </Pressable>
          <Btn label={t('farmerMap', locale)} variant="secondary" onPress={() => openInMaps(p.latitude, p.longitude)} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  loadingText: { color: tokens.textMuted },
  empty: { textAlign: 'center', color: tokens.textMuted, paddingVertical: 24 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    gap: 10,
  },
  cardMain: { gap: 4 },
  name: { fontSize: 16, fontWeight: '700', color: tokens.text },
  subtitle: { fontSize: 13, color: tokens.textMuted },
  coords: { fontSize: 12, color: tokens.green800, marginTop: 4 },
});
