import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { formatDate, partnerClient, tokens } from '@morbeez/shared';
import {AlertBox, Btn, EmptyState, Loading, Panel, TextField, stableRowKey } from '@morbeez/ui-native';

type TaskRow = {
  id: string;
  title: string;
  taskCategory?: string;
  taskType?: string;
  status: string;
  dueAt?: string;
  farmerId?: string;
};

function parseTask(raw: Record<string, unknown>): TaskRow {
  return {
    id: String(raw.id),
    title: String(raw.title ?? 'Task'),
    taskCategory: raw.taskCategory ? String(raw.taskCategory) : undefined,
    taskType: raw.taskType ? String(raw.taskType) : undefined,
    status: String(raw.status),
    dueAt: raw.dueAt ? String(raw.dueAt) : undefined,
    farmerId: raw.farmerId ? String(raw.farmerId) : undefined,
  };
}

export default function TasksScreen() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await partnerClient.listTasks();
      setTasks(rows.map((r) => parseTask(r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept(id: string) {
    setBusy(id);
    try {
      await partnerClient.acceptTask(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept task');
    } finally {
      setBusy(null);
    }
  }

  async function complete(id: string) {
    setBusy(id);
    try {
      await partnerClient.completeTask(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete task');
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) {
      setError('Enter a reason to reject the task.');
      return;
    }
    setBusy(id);
    try {
      await partnerClient.rejectTask(id, rejectReason.trim());
      setRejectId(null);
      setRejectReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reject task');
    } finally {
      setBusy(null);
    }
  }

  async function reschedule(id: string, days = 1) {
    const due = new Date();
    due.setDate(due.getDate() + days);
    setBusy(id);
    try {
      await partnerClient.rescheduleTask(id, due.toISOString());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reschedule task');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loading label="Loading tasks…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={tasks}
      keyExtractor={(item, i) => stableRowKey(item.id, i)}
      ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
      ListEmptyComponent={<EmptyState>No pending tasks.</EmptyState>}
      renderItem={({ item }) => {
        const id = item.id;
        const status = item.status;
        const isRejecting = rejectId === id;
        return (
          <Panel title={item.title}>
            <Text style={styles.meta}>
              {item.taskCategory ?? item.taskType ?? 'Task'}
              {item.dueAt ? ` · Due ${formatDate(item.dueAt)}` : ''}
            </Text>
            {status === 'pending' ? (
              <Btn label="Accept" onPress={() => void accept(id)} disabled={busy === id} />
            ) : (
              <Btn
                label="Mark complete"
                onPress={() => void complete(id)}
                disabled={busy === id}
                variant="secondary"
              />
            )}
            <View style={styles.actions}>
              <Btn
                label="Reschedule +1d"
                variant="secondary"
                onPress={() => void reschedule(id)}
                disabled={busy === id}
              />
              <Btn
                label={isRejecting ? 'Cancel' : 'Reject'}
                variant="secondary"
                onPress={() => {
                  setRejectId(isRejecting ? null : id);
                  setRejectReason('');
                }}
                disabled={busy === id}
              />
            </View>
            {isRejecting ? (
              <View style={styles.rejectBox}>
                <TextField
                  label="Reject reason"
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="Why can't you take this task?"
                  multiline
                />
                <Btn label="Confirm reject" onPress={() => void reject(id)} disabled={busy === id} />
              </View>
            ) : null}
          </Panel>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 8 },
  meta: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  rejectBox: { marginTop: 8, gap: 8 },
});
