import { useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchPortalNotifications, t, tokens, type PortalNotification } from '@morbeez/shared';
import { AlertBox, EmptyState, Loading } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

type GroupKey = 'Market' | 'Tasks' | 'Weather' | 'Orders';

function groupFor(item: PortalNotification): GroupKey {
  if (item.type === 'delivery' || item.message.toLowerCase().includes('order')) return 'Orders';
  if (item.type === 'advisory' || item.type === 'task') return 'Tasks';
  if (item.type === 'soil' || item.type === 'weather' || item.message.toLowerCase().includes('rain')) return 'Weather';
  return 'Market';
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchPortalNotifications()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load notifications'))
      .finally(() => setLoading(false));
  }, []);

  const sections = useMemo(() => {
    const groups: Record<GroupKey, PortalNotification[]> = {
      Market: [],
      Tasks: [],
      Weather: [],
      Orders: [],
    };
    for (const item of items) {
      groups[groupFor(item)].push(item);
    }
    return (['Market', 'Tasks', 'Weather', 'Orders'] as GroupKey[])
      .filter((k) => groups[k].length)
      .map((title) => ({ title, data: groups[title] }));
  }, [items]);

  function onPress(item: PortalNotification) {
    if (item.href) {
      router.push(item.href as '/orders');
      return;
    }
    if (item.type === 'advisory') router.push('/recommendations');
    else if (item.type === 'delivery') router.push('/orders');
    else if (item.type === 'soil') router.push('/reports');
    else router.push('/(tabs)/market');
  }

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <SectionList
      style={styles.list}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
      ListEmptyComponent={<EmptyState>No notifications right now.</EmptyState>}
      renderSectionHeader={({ section: { title } }) => (
        <Text style={styles.section}>{title}</Text>
      )}
      renderItem={({ item }) => (
        <View style={styles.row} accessibilityRole="button" accessibilityLabel={item.message}>
          <Text style={styles.message} onPress={() => onPress(item)}>
            {item.message}
          </Text>
          <Text style={styles.meta}>{item.atLabel}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  section: { fontSize: 13, fontWeight: '700', color: tokens.green800, marginTop: 12, marginBottom: 8, textTransform: 'uppercase' },
  row: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    marginBottom: 8,
  },
  message: { fontSize: 14, color: tokens.text, lineHeight: 20 },
  meta: { fontSize: 12, color: tokens.textMuted, marginTop: 6 },
});
