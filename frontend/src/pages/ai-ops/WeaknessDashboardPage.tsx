import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  TRAINING_EVENT_TYPES,
  TRAINING_EVENT_TYPE_LABELS,
  type TrainingEventType,
} from '../../lib/ai-training-enums';
import { PageShell, Loading, StaticSelect } from '../../components/ui';
import { MiniTrendChart } from '../../components/intelligence/MiniTrendChart';

type WeaknessData = {
  topMislabels: Array<{ crop: string; label: string; count: number }>;
  districtDrift: Array<{ district: string; count: number }>;
  byEventType: Array<{ eventType: string; count: number }>;
  totalEvents: number;
};

export function WeaknessDashboardPage() {
  const [data, setData] = useState<WeaknessData | null>(null);
  const [eventType, setEventType] = useState<string>('');

  useEffect(() => {
    const qs = eventType ? `?eventType=${encodeURIComponent(eventType)}` : '';
    void api<{ ok: boolean } & WeaknessData>(
      `/morbeez-staff/api/v1/os/analytics/weakness-dashboard${qs}`
    ).then((r) => setData(r));
  }, [eventType]);

  if (!data) return <Loading label="Loading weakness dashboard…" />;

  return (
    <PageShell title="AI weakness dashboard">
      <p className="muted mb-3">{data.totalEvents} correction events (90d)</p>
      <StaticSelect
        className="mb-4 max-w-xs"
        value={eventType}
        onChange={(e) => setEventType(e.target.value)}
      >
        <option value="">All event types</option>
        {TRAINING_EVENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {TRAINING_EVENT_TYPE_LABELS[t as TrainingEventType]}
          </option>
        ))}
      </StaticSelect>

      <h3 className="font-semibold mb-2">By event type</h3>
      <table className="w-full text-sm mb-6">
        <thead>
          <tr>
            <th>Type</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {data.byEventType.map((r) => (
            <tr key={r.eventType}>
              <td>{TRAINING_EVENT_TYPE_LABELS[r.eventType as TrainingEventType] ?? r.eventType}</td>
              <td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="font-semibold mb-2">Top mislabels</h3>
      <table className="w-full text-sm mb-6">
        <thead>
          <tr>
            <th>Crop</th>
            <th>Issue</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {data.topMislabels.map((r) => (
            <tr key={`${r.crop}-${r.label}`}>
              <td>{r.crop}</td>
              <td>{r.label}</td>
              <td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="font-semibold mb-2">District drift</h3>
      {data.districtDrift.length ? (
        <MiniTrendChart
          label="Events by district (top 8)"
          values={data.districtDrift.slice(0, 8).map((r) => r.count)}
        />
      ) : null}
      <table className="w-full text-sm mt-4">
        <thead>
          <tr>
            <th>District</th>
            <th>Events</th>
          </tr>
        </thead>
        <tbody>
          {data.districtDrift.map((r) => (
            <tr key={r.district}>
              <td>{r.district}</td>
              <td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
