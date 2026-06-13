import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { telecallerClient, tokens, type TelecallerFollowUpSections, type TelecallerTaskRow } from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel } from '@morbeez/ui-native';

const EMPTY_SECTIONS: TelecallerFollowUpSections = {
  today: [],
  overdue: [],
  upcoming: [],
  recommendationReviews: [],
  visitFollowUps: [],
  orderFollowUps: [],
  general: [],
};

function TaskSection({
  title,
  tasks,
  onComplete,
  onSnooze,
  onOpen,
}: {
  title: string;
  tasks: TelecallerTaskRow[];
  onComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  onOpen: (task: TelecallerTaskRow) => void;
}) {
  if (!tasks.length) return null;
  return (
    <Panel title={title}>
      {tasks.map((task) => (
        <View key={task.id} style={styles.card}>
          <Pressable onPress={() => onOpen(task)}>
            <Text style={styles.title}>{task.title}</Text>
            {task.farmerName ? <Text style={styles.meta}>{task.farmerName}</Text> : null}
            {task.dueLabel ? (
              <Text style={[styles.due, task.isDueToday && styles.dueToday]}>{task.dueLabel}</Text>
            ) : null}
          </Pressable>
          <View style={styles.actions}>
            <Btn label="Complete" variant="secondary" onPress={() => onComplete(task.id)} />
            <Btn label="Snooze 1d" variant="secondary" onPress={() => onSnooze(task.id)} />
          </View>
        </View>
      ))}
    </Panel>
  );
}

export default function FollowUpsScreen() {
  const router = useRouter();
  const [sections, setSections] = useState<TelecallerFollowUpSections>(EMPTY_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      setSections(await telecallerClient.listFollowUpSections());
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

  const complete = async (taskId: string) => {
    try {
      await telecallerClient.completeTask(taskId);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete task');
    }
  };

  const snooze = async (taskId: string) => {
    const due = new Date();
    due.setDate(due.getDate() + 1);
    try {
      await telecallerClient.snoozeTask(taskId, due.toISOString());
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not snooze task');
    }
  };

  const openTask = (task: TelecallerTaskRow) => {
    if (task.leadId) router.push(`/lead/${task.leadId}`);
  };

  if (loading && !sections.today.length && !sections.overdue.length) {
    return <Loading label="Loading follow-ups…" />;
  }

  const total =
    sections.today.length +
    sections.overdue.length +
    sections.upcoming.length;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      {!total ? <Text style={styles.empty}>No pending follow-ups.</Text> : null}

      <TaskSection title="Today" tasks={sections.today} onComplete={complete} onSnooze={snooze} onOpen={openTask} />
      <TaskSection title="Overdue" tasks={sections.overdue} onComplete={complete} onSnooze={snooze} onOpen={openTask} />
      <TaskSection title="Upcoming" tasks={sections.upcoming} onComplete={complete} onSnooze={snooze} onOpen={openTask} />
      <TaskSection
        title="Recommendation reviews"
        tasks={sections.recommendationReviews}
        onComplete={complete}
        onSnooze={snooze}
        onOpen={openTask}
      />
      <TaskSection
        title="Visit follow-ups"
        tasks={sections.visitFollowUps}
        onComplete={complete}
        onSnooze={snooze}
        onOpen={openTask}
      />
      <TaskSection
        title="Order follow-ups"
        tasks={sections.orderFollowUps}
        onComplete={complete}
        onSnooze={snooze}
        onOpen={openTask}
      />
      <TaskSection title="General" tasks={sections.general} onComplete={complete} onSnooze={snooze} onOpen={openTask} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    marginBottom: 10,
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: '600', color: tokens.text },
  meta: { marginTop: 4, fontSize: 13, color: tokens.textMuted },
  due: { marginTop: 6, fontSize: 12, color: tokens.textMuted },
  dueToday: { color: '#b45309', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  empty: { textAlign: 'center', color: tokens.textMuted, marginTop: 24 },
});
