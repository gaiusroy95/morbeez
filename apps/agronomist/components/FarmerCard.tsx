import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  formatPhoneDisplay,
  telHref,
  tokens,
  whatsAppHref,
  type AgronomistFarmerSearchRow,
} from '@morbeez/shared';

type Props = {
  farmer: AgronomistFarmerSearchRow;
  onOpenWorkspace?: () => void;
};

function dialPhone(phone: string | null | undefined) {
  const href = telHref(phone);
  if (href) void Linking.openURL(href);
}

function openWhatsApp(phone: string | null | undefined) {
  const href = whatsAppHref(phone);
  if (href) void Linking.openURL(href);
}

function openMaps(farmer: AgronomistFarmerSearchRow) {
  if (farmer.district) {
    void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(farmer.district)}`);
  }
}

export function FarmerCard({ farmer, onOpenWorkspace }: Props) {
  const router = useRouter();
  const openWorkspace = onOpenWorkspace ?? (() => router.push(`/farmer/${farmer.id}`));
  const phoneLabel = farmer.phone ? formatPhoneDisplay(farmer.phone) : null;

  return (
    <View style={styles.card}>
      <Pressable onPress={openWorkspace} style={styles.main}>
        <Text style={styles.name}>{farmer.name}</Text>
        <Text style={styles.sub}>
          {[farmer.village, farmer.district, farmer.primaryCrop].filter(Boolean).join(' · ')}
        </Text>
        {phoneLabel ? <Text style={styles.phone}>{phoneLabel}</Text> : null}
        <View style={styles.metaRow}>
          {farmer.healthStatus ? <Text style={styles.badge}>{farmer.healthStatus}</Text> : null}
          {farmer.openTaskCount ? (
            <Text style={styles.meta}>{farmer.openTaskCount} open tasks</Text>
          ) : null}
          {farmer.distanceKm != null ? (
            <Text style={styles.meta}>{farmer.distanceKm.toFixed(1)} km</Text>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => dialPhone(farmer.phone)}
          disabled={!farmer.phone}
          accessibilityLabel="Call farmer"
        >
          <Ionicons name="call-outline" size={20} color={farmer.phone ? tokens.green700 : tokens.textMuted} />
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={() => openWhatsApp(farmer.phone)}
          disabled={!farmer.phone}
          accessibilityLabel="WhatsApp farmer"
        >
          <Ionicons name="logo-whatsapp" size={20} color={farmer.phone ? tokens.green700 : tokens.textMuted} />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => openMaps(farmer)} accessibilityLabel="Navigate">
          <Ionicons name="navigate-outline" size={20} color={tokens.green700} />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={openWorkspace} accessibilityLabel="Open workspace">
          <Ionicons name="folder-open-outline" size={20} color={tokens.green700} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  main: { padding: 14 },
  name: { fontSize: 16, fontWeight: '600', color: tokens.text },
  sub: { fontSize: 13, color: tokens.textMuted, marginTop: 2 },
  phone: { fontSize: 13, color: tokens.text, marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.green800,
    backgroundColor: tokens.green100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  meta: { fontSize: 12, color: tokens.textMuted },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    backgroundColor: tokens.bg,
  },
  actionBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
});
