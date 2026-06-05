import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import { Alert, HubTabs, KeyValueRow, Loading, Panel, ReadOnlyBanner } from '@/components/ui';
import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

const base = '/morbeez-staff/api/v1/os/operations';

type Tab = 'messaging' | 'broadcasts';

type MessagingConfig = {
  provider: string;
  broadcastsEnabled: boolean;
  broadcastMaxPerDay: number;
  sessionHours: number;
  orderAlertsEnabled: boolean;
};

type BroadcastRule = {
  id: string;
  crop_type: string;
  broadcast_kind: string;
  active: boolean;
};

export function OperationsCenterPage({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>('messaging');
  const [config, setConfig] = useState<MessagingConfig | null>(null);
  const [rules, setRules] = useState<BroadcastRule[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'messaging') {
        const d = await api<{ ok: boolean; config: MessagingConfig }>(`${base}/messaging-config`);
        setConfig(d.config);
      } else {
        const d = await api<{ ok: boolean; rules: BroadcastRule[] }>(`${base}/broadcast-rules`);
        setRules(d.rules ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load operations');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ConsoleScreenLayout>
      <HubTabs
        tabs={[
          { id: 'messaging' as Tab, label: 'Messaging' },
          { id: 'broadcasts' as Tab, label: 'Broadcast rules' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert>{error}</Alert> : null}
      {loading ? (
        <Loading label="Loading operations…" />
      ) : tab === 'messaging' && config ? (
        <Panel title="Messaging config">
          <KeyValueRow label="Provider" value={config.provider} />
          <KeyValueRow label="Broadcasts enabled" value={config.broadcastsEnabled ? 'Yes' : 'No'} />
          <KeyValueRow label="Max broadcasts / day" value={String(config.broadcastMaxPerDay)} />
          <KeyValueRow label="Session hours" value={String(config.sessionHours)} />
          <KeyValueRow label="Order alerts" value={config.orderAlertsEnabled ? 'On' : 'Off'} />
        </Panel>
      ) : (
        <Panel title={`Broadcast rules (${rules.length})`}>
          {rules.length === 0 ? (
            <Text style={styles.muted}>No broadcast rules configured.</Text>
          ) : (
            rules.slice(0, 20).map((r) => (
              <KeyValueRow
                key={r.id}
                label={`${r.crop_type} · ${r.broadcast_kind}`}
                value={r.active ? 'Active' : 'Inactive'}
              />
            ))
          )}
        </Panel>
      )}
    </ConsoleScreenLayout>
  );
}

const styles = StyleSheet.create({
  muted: { color: '#6b7280', fontSize: 14 },
});
