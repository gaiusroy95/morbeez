import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { agronomistClient, formatDate, tokens } from '@morbeez/shared';
import { AlertBox, Btn, ListCard, Loading, Panel } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

type Props = {
  farmerId: string;
};

type Bundle = {
  tasks: Array<Record<string, unknown>>;
  recommendationFollowUps: Array<Record<string, unknown>>;
  callbacks: Array<Record<string, unknown>>;
};

function taskCategory(row: Record<string, unknown>): string {
  return String(row.task_category ?? row.task_type ?? 'general');
}

function followUpState(row: Record<string, unknown>): string {
  const status = String(row.status ?? 'scheduled');
  const type = String(row.follow_up_type ?? 'recommendation');
  return `${type.replace(/_/g, ' ')} · ${status}`;
}

export function FarmerFollowUpsPanel({ farmerId }: Props) {
  const { canWrite } = useStaffAuth();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setBundle(await agronomistClient.getFarmerFollowUps(farmerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load follow-ups');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function completeTask(taskId: string) {
    if (!canWrite) return;
    setBusyId(taskId);
    try {
      await agronomistClient.completeOperationsTask(taskId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete task');
    } finally {
      setBusyId('');
    }
  }

  async function completeCallback(callbackId: string) {
    if (!canWrite) return;
    setBusyId(callbackId);
    try {
      await agronomistClient.updateCallback(callbackId, 'completed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update callback');
    } finally {
      setBusyId('');
    }
  }

  if (loading) return <Loading label="Loading follow-ups…" />;

  const byCategory = (cat: string) =>
    (bundle?.tasks ?? []).filter((t) => taskCategory(t).toLowerCase().includes(cat));

  const sections = [
    { title: 'Recommendation follow-ups', rows: bundle?.recommendationFollowUps ?? [], kind: 'rec' as const },
    { title: 'Visit tasks', rows: byCategory('visit'), kind: 'task' as const },
    { title: 'Sales & payment', rows: [...byCategory('sales'), ...byCategory('payment')], kind: 'task' as const },
    { title: 'General tasks', rows: byCategory('general'), kind: 'task' as const },
    { title: 'Callbacks', rows: bundle?.callbacks ?? [], kind: 'callback' as const },
  ];

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {sections.map((section) => (
        <Panel key={section.title} title={section.title}>
          {section.rows.length === 0 ? (
            <Text style={styles.empty}>None scheduled</Text>
          ) : (
            section.rows.map((row) => {
              const id = String(row.id);
              const isRec = section.kind === 'rec';
              const isCallback = section.kind === 'callback';
              return (
                <View key={id} style={styles.rowWrap}>
                  <ListCard
                    title={String(row.title ?? row.follow_up_type ?? row.reason ?? 'Follow-up')}
                    subtitle={String(row.notes ?? row.task_type ?? '')}
                    meta={[
                      row.due_at ? formatDate(String(row.due_at)) : null,
                      row.scheduled_at ? formatDate(String(row.scheduled_at)) : null,
                      isRec ? followUpState(row) : String(row.status ?? ''),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                  {canWrite && (section.kind === 'task' || isCallback) ? (
                    <Btn
                      label={busyId === id ? 'Saving…' : isCallback ? 'Mark callback done' : 'Complete task'}
                      variant="secondary"
                      disabled={busyId === id}
                      onPress={() =>
                        void (isCallback ? completeCallback(id) : completeTask(id))
                      }
                    />
                  ) : null}
                </View>
              );
            })
          )}
        </Panel>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 12, paddingBottom: 32 },
  rowWrap: { marginBottom: 8 },
  empty: { fontSize: 14, color: tokens.textMuted, paddingVertical: 8 },
});
