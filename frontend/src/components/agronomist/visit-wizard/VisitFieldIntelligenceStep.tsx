import { useEffect, useState } from 'react';
import type { MeasurementTemplate } from '@morbeez/shared';
import { api } from '../../../lib/api';
import { HubTabs } from '../../ui';
import { VisitMeasurementsStep } from './VisitMeasurementsStep';
import { VisitSoilWeatherStep } from './VisitSoilWeatherStep';

type Tab = 'measurements' | 'soil' | 'weather' | 'activity';

type ActivityRow = {
  id?: string;
  product_name?: string;
  method?: string;
  dose?: string;
  applied_at?: string;
};

type Props = {
  cropType: string;
  farmerId: string;
  blockId: string;
  templates: MeasurementTemplate[];
  measurements: Record<string, string>;
  onMeasurementChange: (key: string, value: string) => void;
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'measurements', label: 'Measurements' },
  { id: 'soil', label: 'Soil test' },
  { id: 'weather', label: 'Weather' },
  { id: 'activity', label: 'Field activity' },
];

function VisitFieldActivityTab({ farmerId, blockId }: { farmerId: string; blockId: string }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void api<{ ok: boolean; rows: ActivityRow[] }>(
      `/morbeez-staff/api/v1/os/farmers/${farmerId}/application-history?blockId=${blockId}`
    )
      .then((r) => setRows(r.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [farmerId, blockId]);

  if (loading) return <p className="vw-hint">Loading recent applications…</p>;
  if (!rows.length) {
    return (
      <p className="vw-hint">
        No spray, drench, or fertigation records in the last 30 days for this plot. Check farmer workspace for older
        history.
      </p>
    );
  }

  return (
    <div className="vw-stack">
      <p className="vw-hint">Last applications on this block — used for resistance tracking and recommendation safety.</p>
      <table className="vw-activity-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Product</th>
            <th>Method</th>
            <th>Dose</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((r, i) => (
            <tr key={String(r.id ?? i)}>
              <td>{String(r.applied_at ?? '').slice(0, 10)}</td>
              <td>{String(r.product_name ?? '—')}</td>
              <td>{String(r.method ?? '—')}</td>
              <td>{String(r.dose ?? '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Measurements + soil + weather + field activity in one step (tabs). */
export function VisitFieldIntelligenceStep({
  cropType,
  farmerId,
  blockId,
  templates,
  measurements,
  onMeasurementChange,
}: Props) {
  const [tab, setTab] = useState<Tab>('measurements');

  return (
    <div className="vw-stack">
      <div className="vw-banner vw-banner--info">
        Field intelligence — capture plot measurements, review soil & weather context, and check recent applications before
        AI diagnosis.
      </div>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'measurements' ? (
        <VisitMeasurementsStep
          cropType={cropType}
          templates={templates}
          values={measurements}
          onChange={onMeasurementChange}
        />
      ) : null}
      {tab === 'soil' ? (
        <VisitSoilWeatherStep farmerId={farmerId} blockId={blockId} soilOnly />
      ) : null}
      {tab === 'weather' ? (
        <VisitSoilWeatherStep farmerId={farmerId} blockId={blockId} weatherOnly />
      ) : null}
      {tab === 'activity' ? <VisitFieldActivityTab farmerId={farmerId} blockId={blockId} /> : null}
    </div>
  );
}
