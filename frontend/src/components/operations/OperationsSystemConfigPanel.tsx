import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Panel } from '../ui';

type MessagingConfig = {
  provider: string;
  broadcastsEnabled: boolean;
  broadcastMaxPerDay: number;
  broadcastKindCooldownHours: number;
  sessionHours: number;
  cultivationFollowUpsEnabled: boolean;
  advisoryFollowUpsEnabled: boolean;
  advisoryAutomationEnabled: boolean;
  orderAlertsEnabled: boolean;
};

const base = '/morbeez-staff/api/v1/os/operations';

export function OperationsSystemConfigPanel() {
  const [config, setConfig] = useState<MessagingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ ok: boolean; config: MessagingConfig }>(`${base}/messaging-config`)
      .then((d) => setConfig(d.config))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading system config…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!config) return null;

  return (
    <Panel title="WhatsApp system config">
      <p className="mb-4 text-sm text-slate-600">
        Server environment flags for WhatsApp provider, broadcast limits, and follow-up automation. Change in
        deployment config, then restart the API.
      </p>
      <div className="grid max-w-2xl gap-3 text-sm">
        <Row label="Provider" value={config.provider} />
        <Row label="Broadcasts enabled" value={config.broadcastsEnabled ? 'Yes' : 'No'} />
        <Row label="Max broadcasts / day" value={String(config.broadcastMaxPerDay)} />
        <Row label="Kind cooldown (hours)" value={String(config.broadcastKindCooldownHours)} />
        <Row label="Session window (hours)" value={String(config.sessionHours)} />
        <Row label="Cultivation follow-ups" value={config.cultivationFollowUpsEnabled ? 'Yes' : 'No'} />
        <Row label="Advisory follow-ups" value={config.advisoryFollowUpsEnabled ? 'Yes' : 'No'} />
        <Row label="Advisory automation" value={config.advisoryAutomationEnabled ? 'Yes' : 'No'} />
        <Row label="Order alerts" value={config.orderAlertsEnabled ? 'Yes' : 'No'} />
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
