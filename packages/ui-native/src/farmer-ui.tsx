import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';

const healthColors: Record<string, { bg: string; text: string }> = {
  stable: { bg: tokens.green100, text: tokens.green800 },
  monitor: { bg: '#FFF4E5', text: '#B45309' },
  alert: { bg: tokens.dangerBg, text: tokens.danger },
  critical: { bg: tokens.dangerBg, text: tokens.danger },
};

export function HealthBadge({ status, label }: { status: string; label: string }) {
  const colors = healthColors[status] ?? healthColors.stable;
  return (
    <View style={[styles.healthBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.healthBadgeText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

export function FieldCard({
  name,
  crop,
  acreage,
  dap,
  healthStatus,
  healthLabel,
  lastActivity,
  currentAlert,
  onPress,
}: {
  name: string;
  crop: string;
  acreage: number | null;
  dap: number | null;
  healthStatus: string;
  healthLabel: string;
  lastActivity: string | null;
  currentAlert: string | null;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.fieldCard}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldName}>{name}</Text>
        <HealthBadge status={healthStatus} label={healthLabel} />
      </View>
      <Text style={styles.fieldMeta}>
        {crop}
        {acreage ? ` · ${acreage} acre` : ''}
        {dap != null ? ` · DAP ${dap}` : ''}
      </Text>
      {lastActivity ? <Text style={styles.fieldSub}>Last: {lastActivity}</Text> : null}
      {currentAlert ? <Text style={styles.fieldAlert}>⚠ {currentAlert}</Text> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }
  return content;
}

export function AlertCard({ message, meta, tone = 'info' }: { message: string; meta?: string; tone?: string }) {
  const bg = tone === 'warning' ? '#FFF4E5' : tone === 'success' ? tokens.green100 : tokens.card;
  return (
    <View style={[styles.alertCard, { backgroundColor: bg }]}>
      <Text style={styles.alertMessage}>{message}</Text>
      {meta ? <Text style={styles.alertMeta}>{meta}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const full = Math.round(rating);
  return (
    <Text style={{ color: '#f5a623', fontSize: size }}>
      {'★'.repeat(full)}
      {'☆'.repeat(Math.max(0, 5 - full))}
    </Text>
  );
}

export function ProductCard({
  title,
  price,
  imageUrl,
  rating,
  recommended,
  onPress,
}: {
  title: string;
  price: string;
  imageUrl?: string | null;
  rating?: number;
  recommended?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.productCard}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.productImage} />
      ) : (
        <View style={[styles.productImage, styles.productImagePh]} />
      )}
      {recommended ? <Text style={styles.recTag}>Recommended</Text> : null}
      <Text style={styles.productTitle} numberOfLines={2}>
        {title}
      </Text>
      {rating != null && rating > 0 ? <StarRating rating={rating} size={12} /> : null}
      <Text style={styles.productPrice}>{price}</Text>
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.productWrap, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.productWrap}>{content}</View>;
}

export function QuickActionGrid({
  actions,
}: {
  actions: Array<{ id: string; label: string; onPress: () => void }>;
}) {
  return (
    <View style={styles.quickGrid}>
      {actions.map((a) => (
        <Pressable key={a.id} style={styles.quickBtn} onPress={a.onPress}>
          <Text style={styles.quickBtnText}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  healthBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  healthBadgeText: { fontSize: 11, fontWeight: '700' },
  fieldCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    marginBottom: 10,
  },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  fieldName: { fontSize: 16, fontWeight: '700', color: tokens.text, flex: 1 },
  fieldMeta: { fontSize: 13, color: tokens.textMuted, marginTop: 6 },
  fieldSub: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  fieldAlert: { fontSize: 12, color: tokens.danger, marginTop: 6, fontWeight: '600' },
  alertCard: {
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    marginBottom: 10,
  },
  alertMessage: { fontSize: 14, color: tokens.text, lineHeight: 20 },
  alertMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: tokens.text },
  sectionAction: { fontSize: 13, color: tokens.green700, fontWeight: '600' },
  productWrap: { flex: 1, maxWidth: '50%' },
  productCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 10,
    marginBottom: 10,
  },
  productImage: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 8 },
  productImagePh: { backgroundColor: tokens.border },
  recTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: tokens.green700,
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  productTitle: { fontSize: 13, fontWeight: '600', color: tokens.text, minHeight: 34 },
  productPrice: { fontSize: 14, fontWeight: '700', color: tokens.green800, marginTop: 4 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: {
    backgroundColor: tokens.green100,
    borderRadius: tokens.radiusSm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: tokens.green500,
  },
  quickBtnText: { fontSize: 13, fontWeight: '600', color: tokens.green800 },
  pressed: { opacity: 0.9 },
});
