import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import { Alert, HubTabs, ListCard, Loading, ReadOnlyBanner } from '@/components/ui';
import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';

const base = '/morbeez-staff/api/v1/os/intelligence';

type Tab = 'rules' | 'tasks' | 'templates';

export function IntelligenceHubPage({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>('rules');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'rules') {
        const d = await api<{ ok: boolean; rules: Array<Record<string, unknown>> }>(`${base}/rules`);
        setRows(d.rules ?? []);
      } else if (tab === 'tasks') {
        const d = await api<{ ok: boolean; tasks: Array<Record<string, unknown>> }>(`${base}/tasks`);
        setRows(d.tasks ?? []);
      } else {
        const d = await api<{ ok: boolean; templates: Array<Record<string, unknown>> }>(
          `${base}/templates`
        );
        setRows(d.templates ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load intelligence data');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ConsoleScreenLayout scroll={false}>
      <HubTabs
        tabs={[
          { id: 'rules' as Tab, label: 'Rules' },
          { id: 'tasks' as Tab, label: 'Tasks' },
          { id: 'templates' as Tab, label: 'Templates' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {loading ? (
        <Loading label="Loading intelligence…" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => String(item.id ?? i)}
          ListHeaderComponent={
            <Text style={styles.hint}>Agriculture intelligence masters — same endpoints as web hub.</Text>
          }
          renderItem={({ item }) => (
            <ListCard
              title={String(item.name ?? item.title ?? item.code ?? item.id ?? 'Item')}
              subtitle={String(item.crop_type ?? item.module ?? item.kind ?? '') || undefined}
              meta={String(item.status ?? item.active ?? '') || undefined}
            />
          )}
        />
      )}
    </ConsoleScreenLayout>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
});
