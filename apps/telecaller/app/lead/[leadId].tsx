import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { telecallerClient, tokens, type TelecallerTimelineItem } from '@morbeez/shared';
import { AlertBox, Loading } from '@morbeez/ui-native';

export default function LeadDetailScreen() {
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const [timeline, setTimeline] = useState<TelecallerTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (background = false) => {
    if (!leadId) return;
    if (!background) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      setTimeline(await telecallerClient.getLeadTimeline(String(leadId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lead');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !timeline.length) return <Loading label="Loading lead…" />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.heading}>Timeline</Text>
      {timeline.map((item) => (
        <View key={item.id} style={styles.item}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemTime}>{new Date(item.at).toLocaleString('en-IN')}</Text>
          {item.detail ? <Text style={styles.itemDetail}>{item.detail}</Text> : null}
        </View>
      ))}
      {!timeline.length ? <Text style={styles.empty}>No activity yet.</Text> : null}
      <Text style={styles.hint}>
        Upload call recordings from staff web CRM or queue offline uploads when connectivity returns.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: '700', color: tokens.text },
  item: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  itemTitle: { fontWeight: '600', color: tokens.text },
  itemTime: { fontSize: 12, color: tokens.textMuted, marginTop: 2 },
  itemDetail: { marginTop: 6, fontSize: 14, color: tokens.text },
  empty: { color: tokens.textMuted },
  hint: { marginTop: 16, fontSize: 13, color: tokens.textMuted, lineHeight: 20 },
});
