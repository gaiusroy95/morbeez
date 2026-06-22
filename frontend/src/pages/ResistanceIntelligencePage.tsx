import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { MiniTrendChart } from '../components/intelligence/MiniTrendChart';
import { PageShell } from '../components/ui';

export function ResistanceIntelligencePage() {
  const [rows, setRows] = useState<Array<{ crop: string; cases: number; avgResistanceScore: number }>>([]);

  useEffect(() => {
    void api<{ ok: boolean; rows: typeof rows }>('/morbeez-staff/api/v1/os/analytics/resistance-dashboard').then(
      (r) => setRows(r.rows ?? [])
    );
  }, []);

  return (
    <PageShell title="Resistance intelligence">
      {rows.length ? (
        <>
          <MiniTrendChart label="Avg resistance score by crop" values={rows.map((r) => r.avgResistanceScore)} />
          <MiniTrendChart label="Case volume by crop" values={rows.map((r) => r.cases)} />
        </>
      ) : null}
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Crop</th>
            <th>Cases</th>
            <th>Avg resistance score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.crop}>
              <td>{r.crop}</td>
              <td>{r.cases}</td>
              <td>{r.avgResistanceScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="muted mt-2">No resistance signals in recent cases.</p> : null}
    </PageShell>
  );
}
