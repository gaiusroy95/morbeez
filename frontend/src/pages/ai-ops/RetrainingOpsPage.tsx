import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Btn, PageShell, StatCard } from '../../components/ui';
import { MiniTrendChart } from '../../components/intelligence/MiniTrendChart';

export function RetrainingOpsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [evalSummary, setEvalSummary] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function load() {
    void api<{ ok: boolean; rows: typeof rows; evalSummary: Record<string, unknown> }>(
      '/morbeez-staff/api/v1/os/agronomist/ml-gold-queue'
    ).then((r) => {
      setRows(r.rows ?? []);
      setEvalSummary(r.evalSummary ?? null);
    });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <PageShell title="Retraining operations">
      <div className="agro-ops-stats mb-4">
        <StatCard label="Gold queue" value={String(rows.length)} />
        <StatCard label="Accuracy" value={String(evalSummary?.accuracy ?? '—')} />
        <StatCard label="FP rate" value={String(evalSummary?.falsePositiveRate ?? '—')} />
        <StatCard label="Recovery" value={String(evalSummary?.recoveryRate ?? '—')} />
      </div>
      {evalSummary ? (
        <MiniTrendChart
          label="Model eval snapshot"
          values={[
            Number(evalSummary.accuracy ?? 0) * 100,
            Number(evalSummary.falsePositiveRate ?? 0) * 100,
            Number(evalSummary.recoveryRate ?? 0) * 100,
          ]}
          unit="%"
        />
      ) : null}
      <Btn
        variant="secondary"
        label={busy ? 'Exporting…' : 'Trigger weekly export'}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setMsg('');
          void api('/morbeez-staff/api/v1/os/agronomist/ml-gold-queue/trigger-export', { method: 'POST' })
            .then(() => {
              setMsg('Export job started.');
              load();
            })
            .catch((e) => setMsg(e instanceof Error ? e.message : 'Export failed'))
            .finally(() => setBusy(false));
        }}
      />
      {msg ? <p className="muted mt-2">{msg}</p> : null}
      <table className="w-full text-sm mt-4">
        <thead>
          <tr>
            <th>Status</th>
            <th>Case</th>
            <th>Created</th>
            <th>Exported</th>
            <th>Retrain</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const meta = (r.metadata as { retrainWebhook?: { status?: string; at?: string } }) ?? {};
            const webhook = meta.retrainWebhook;
            return (
            <tr key={String(r.id)}>
              <td>{String(r.status)}</td>
              <td>{String(r.case_id ?? '—').slice(0, 8)}</td>
              <td>{String(r.created_at ?? '').slice(0, 10)}</td>
              <td>{r.exported_at ? String(r.exported_at).slice(0, 10) : '—'}</td>
              <td>{webhook?.status ?? '—'}</td>
            </tr>
          );
          })}
        </tbody>
      </table>
    </PageShell>
  );
}
