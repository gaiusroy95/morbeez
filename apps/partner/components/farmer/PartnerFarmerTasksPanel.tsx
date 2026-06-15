import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { partnerClient, tokens, type PartnerFarmerTaskRow } from '@morbeez/shared';
import { AlertBox, Btn, ListCard, Loading } from '@morbeez/ui-native';

type Props = { farmerId: string };

export function PartnerFarmerTasksPanel({ farmerId }: Props) {
  const [tasks, setTasks] = useState<PartnerFarmerTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setTasks(await partnerClient.getFarmerTasks(farmerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(taskId: string, action: 'accept' | 'complete' | 'escalate') {
    setBusyId(taskId);
    try {
      if (action === 'accept') await partnerClient.acceptTask(taskId);
      else if (action === 'complete') await partnerClient.completeTask(taskId);
      else {
        await partnerClient.createEscalation(farmerId, {
          category: 'repeated_issue',
          notes: `Escalated from task ${taskId}`,
        });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId('');
    }
  }

  if (loading) return <Loading label="Loading tasks…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {tasks.map((t) => (
        <View key={t.id} style={styles.taskCard}>
          <ListCard
            title={t.title}
            subtitle={`${t.taskType} · ${t.status}`}
            meta={t.dueAt ? t.dueAt.slice(0, 10) : undefined}
          />
          <View style={styles.actions}>
            {t.status === 'pending' ? (
              <Btn
                label={busyId === t.id ? '…' : 'Accept'}
                variant="secondary"
                onPress={() => void act(t.id, 'accept')}
                disabled={busyId === t.id}
              />
            ) : null}
            <Btn
              label="Complete"
              variant="secondary"
              onPress={() => void act(t.id, 'complete')}
              disabled={busyId === t.id}
            />
            <Btn
              label="Escalate"
              variant="secondary"
              onPress={() => void act(t.id, 'escalate')}
              disabled={busyId === t.id}
            />
          </View>
        </View>
      ))}
      {!tasks.length ? <Text style={styles.empty}>No pending tasks for this farmer.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  taskCard: { gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
