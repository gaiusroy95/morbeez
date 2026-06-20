import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchScanHistory, t, tokens } from '@morbeez/shared';
import {AlertBox, EmptyState, Loading, Panel, stableRowKey } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

export default function ScanHistoryScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [scans, setScans] = useState<Awaited<ReturnType<typeof fetchScanHistory>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setScans(await fetchScanHistory({ limit: 30 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load scans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={scans}
      keyExtractor={(item, i) => stableRowKey(item.sessionId, i)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
      ListEmptyComponent={<EmptyState>{t('scanHistory', locale)} — none yet</EmptyState>}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/scan/${item.sessionId}`)} accessibilityRole="button">
          <Panel title={item.detectedIssue}>
            <Text style={styles.meta}>{item.dateLabel}</Text>
            {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}
          </Panel>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  meta: { fontSize: 12, color: tokens.textMuted, marginBottom: 4 },
  summary: { fontSize: 13, color: tokens.text, lineHeight: 18 },
});
