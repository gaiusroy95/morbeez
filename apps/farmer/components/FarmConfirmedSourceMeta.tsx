import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  farmConfirmedBadgeLabel,
  farmConfirmedProvenanceSummary,
  resolveFarmConfirmedVisibility,
  t,
  tokens,
  type AppLocale,
  type FarmConfirmedVisibilityInput,
} from '@morbeez/shared';
import { presentFarmConfirmedActions } from '@/lib/farm-confirmed-actions';

export function FarmConfirmedSourceMeta({
  input,
  locale,
  kind,
  id,
  label,
  onEdit,
}: {
  input: FarmConfirmedVisibilityInput;
  locale: AppLocale;
  kind: 'activity' | 'roi';
  id: string;
  label: string;
  onEdit?: () => void;
}) {
  const visibility = resolveFarmConfirmedVisibility(input);
  if (!visibility.isWhatsAppConfirmed) return null;

  const badge = farmConfirmedBadgeLabel(visibility.badge);
  const summary = farmConfirmedProvenanceSummary(visibility);

  return (
    <View style={styles.wrap}>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}
      <Pressable
        onPress={() =>
          presentFarmConfirmedActions({
            input,
            locale,
            kind,
            id,
            label,
            onEdit,
          })
        }
        accessibilityRole="button"
      >
        <Text style={styles.action}>{t('requestCorrectionWhatsApp', locale)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6, gap: 4 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#1B5E20' },
  summary: { fontSize: 12, color: tokens.textMuted, lineHeight: 16 },
  action: { fontSize: 12, fontWeight: '700', color: tokens.green800, marginTop: 2 },
});
