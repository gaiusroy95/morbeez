import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  fetchPortalSummary,
  formatInr,
  tokens,
  uploadFieldPhoto,
  type PortalSummary,
} from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Panel, StatCard } from '@morbeez/ui-native';
import { Badge, BulletList, WhatsAppBtn } from '@/components/PortalHelpers';
import { SHOP_URL, whatsAppUrl } from '@/lib/config';
import { useFarmerAuth } from '@/context/FarmerAuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const { logout } = useFarmerAuth();
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchPortalSummary();
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadPhoto(type: 'field' | 'leaf' | 'rhizome') {
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (pick.canceled || !pick.assets[0]?.base64) return;
    setMessage('');
    try {
      await uploadFieldPhoto({
        photoType: type,
        imageData: pick.assets[0].base64,
        mimeType: pick.assets[0].mimeType ?? 'image/jpeg',
      });
      setMessage('Photo uploaded — our agronomist will review it.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading your farm dashboard…</Text>
      </View>
    );
  }

  const crop = summary?.crop;
  const glance = summary?.atAGlance;
  const rec = summary?.latestRecommendation;
  const ord = summary?.recentOrder;
  const addr = summary?.shippingAddress;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Text style={styles.greeting}>Hello {summary?.greetingName ?? 'Farmer'} 👋</Text>
      <Text style={styles.sub}>Welcome to your Morbeez Dashboard</Text>

      {crop ? (
        <View style={styles.pillRow}>
          <Text style={styles.pill}>🌿 {crop.name}{crop.variety ? ` ${crop.variety}` : ''}</Text>
          {crop.fieldSize ? <Text style={styles.pill}>📐 {crop.fieldSize}</Text> : null}
          {crop.stage ? <Text style={styles.pill}>📈 {crop.stage}</Text> : null}
        </View>
      ) : null}

      <Panel title="Good day to grow!">
        <Text style={styles.body}>Stay consistent with nutrition and crop protection.</Text>
      </Panel>

      <View style={styles.statsRow}>
        <StatCard label="Active orders" value={glance?.activeOrders ?? 0} />
        <StatCard label="Est. profit" value={formatInr(glance?.estimatedProfitInr ?? 0)} />
      </View>

      <Panel title="Delivery address">
        {addr?.lines.map((line, i) => (
          <Text key={i} style={styles.body}>{line}</Text>
        ))}
        <Btn
          label={addr?.verified ? 'Edit address' : 'Add delivery address'}
          onPress={() => router.push('/address')}
          variant="secondary"
        />
      </Panel>

      <Panel title="At a glance">
        <KeyValueRow label="Next advisory" value={glance?.nextAdvisory ?? '—'} />
        <KeyValueRow label="New soil reports" value={String(glance?.newReports ?? 0)} />
      </Panel>

      {rec ? (
        <Panel title={`Today's recommendation — ${rec.cropName}`}>
          <Text style={styles.meta}>{rec.dateLabel}{rec.dayLabel ? ` · ${rec.dayLabel}` : ''}</Text>
          <BulletList items={rec.bullets} />
          {!rec.bullets.length && rec.summary ? <Text style={styles.body}>{rec.summary}</Text> : null}
        </Panel>
      ) : null}

      {ord ? (
        <Panel title="Recent order">
          <Pressable onPress={() => router.push(`/order/${ord.id}`)} style={styles.orderRow}>
            {ord.productImageUrl ? (
              <Image source={{ uri: ord.productImageUrl }} style={styles.orderImg} />
            ) : (
              <View style={[styles.orderImg, styles.orderImgPlaceholder]} />
            )}
            <View style={styles.orderMain}>
              <Text style={styles.orderTitle}>{ord.productTitle}</Text>
              <Badge label={ord.statusLabel} tone={ord.statusTone} />
              <Text style={styles.meta}>{ord.orderNumber} · {ord.orderedOn}</Text>
              <Text style={styles.link}>Tap for tracking{ord.status === 'delivered' ? ' & review' : ''} →</Text>
            </View>
          </Pressable>
          <Btn
            label="Order again"
            variant="secondary"
            onPress={() => Linking.openURL(`${SHOP_URL.replace(/\/$/, '')}/search?q=${encodeURIComponent(ord.productTitle)}`)}
          />
        </Panel>
      ) : null}

      <Panel title="Upload field photo">
        <Text style={styles.body}>Share crop photos for agronomist review.</Text>
        <View style={styles.uploadRow}>
          <Btn label="Field" onPress={() => uploadPhoto('field')} variant="secondary" />
          <Btn label="Leaf" onPress={() => uploadPhoto('leaf')} variant="secondary" />
          <Btn label="Rhizome" onPress={() => uploadPhoto('rhizome')} variant="secondary" />
        </View>
      </Panel>

      <WhatsAppBtn label="WhatsApp support" />

      {summary?.notifications?.length ? (
        <Panel title="Notifications">
          {summary.notifications.slice(0, 5).map((n) => (
            <Text key={n.id} style={styles.body}>• {n.message} ({n.atLabel})</Text>
          ))}
        </Panel>
      ) : null}

      <Btn label="Browse shop" onPress={() => Linking.openURL(`${SHOP_URL.replace(/\/$/, '')}/collections/all`)} />
      <Btn label="Sign out" onPress={() => void logout()} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.bg },
  greeting: { fontSize: 24, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 14, color: tokens.textMuted, marginBottom: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: {
    backgroundColor: tokens.green100,
    color: tokens.green800,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    overflow: 'hidden',
  },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  body: { fontSize: 14, color: tokens.text, lineHeight: 20, marginBottom: 4 },
  meta: { fontSize: 12, color: tokens.textMuted, marginBottom: 6 },
  success: { color: tokens.green700, marginBottom: 8 },
  muted: { color: tokens.textMuted },
  orderRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  orderImg: { width: 64, height: 64, borderRadius: 8 },
  orderImgPlaceholder: { backgroundColor: tokens.border },
  orderMain: { flex: 1 },
  orderTitle: { fontSize: 15, fontWeight: '600', color: tokens.text },
  link: { fontSize: 12, color: tokens.green700, fontWeight: '600', marginTop: 4 },
  uploadRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
});
