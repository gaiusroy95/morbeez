import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { telecallerClient, tokens, type TelecallerTaskRow } from '@morbeez/shared';
import { AlertBox, Loading } from '@morbeez/ui-native';

export default function FollowUpsScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TelecallerTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      setTasks(await telecallerClient.listFollowUps('pending'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load follow-ups');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !tasks.length) return <Loading label="Loading follow-ups…" />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      {tasks.map((task) => (
        <Pressable
          key={task.id}
          style={styles.card}
          onPress={() => task.leadId && router.push(`/lead/${task.leadId}`)}
        >
          <Text style={styles.title}>{task.title}</Text>
          {task.farmerName ? <Text style={styles.meta}>{task.farmerName}</Text> : null}
          {task.dueLabel ? (
            <Text style={[styles.due, task.isDueToday && styles.dueToday]}>{task.dueLabel}</Text>
          ) : null}
        </Pressable>
      ))}
      {!tasks.length ? <Text style={styles.empty}>No pending follow-ups.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  title: { fontSize: 15, fontWeight: '600', color: tokens.text },
  meta: { marginTop: 4, fontSize: 13, color: tokens.textMuted },
  due: { marginTop: 6, fontSize: 12, color: tokens.textMuted },
  dueToday: { color: '#b45309', fontWeight: '600' },
  empty: { textAlign: 'center', color: tokens.textMuted, marginTop: 24 },
});
