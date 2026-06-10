import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { whatsAppUrl } from '@/lib/config';

export function Badge({ label, tone = 'info' }: { label: string; tone?: string }) {
  const bg =
    tone === 'success' || tone === 'good'
      ? tokens.green100
      : tone === 'warning' || tone === 'monitor'
        ? '#fef3c7'
        : tone === 'danger' || tone === 'critical'
          ? tokens.dangerBg
          : '#eff6ff';
  const color =
    tone === 'success' || tone === 'good'
      ? tokens.green800
      : tone === 'warning' || tone === 'monitor'
        ? tokens.warning
        : tone === 'danger' || tone === 'critical'
          ? tokens.danger
          : tokens.info;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function WhatsAppBtn({ label, message }: { label: string; message?: string }) {
  return (
    <Pressable style={styles.waBtn} onPress={() => Linking.openURL(whatsAppUrl(message))}>
      <Text style={styles.waBtnText}>{label}</Text>
    </Pressable>
  );
}

export function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.bullets}>
      {items.map((b) => (
        <Text key={b} style={styles.bulletItem}>
          • {b}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  waBtn: {
    backgroundColor: '#25D366',
    borderRadius: tokens.radiusSm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  waBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  bullets: { marginTop: 8, gap: 4 },
  bulletItem: { fontSize: 14, color: tokens.text, lineHeight: 20 },
});
