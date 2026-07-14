import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { agronomistClient } from '@morbeez/shared';
import { api } from '../../lib/api';
import { Alert, Btn, Loading } from '../../components/ui';
import { paths, toPath } from '../../lib/routes';
import '../../styles/visit-wizard.css';

export function VisitDetailPage() {
  const { findingId } = useParams<{ findingId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [finding, setFinding] = useState<Record<string, unknown> | null>(null);
  const [issues, setIssues] = useState<unknown[]>([]);
  const [measurements, setMeasurements] = useState<unknown[]>([]);
  const [recommendations, setRecommendations] = useState<unknown[]>([]);

  const load = useCallback(async () => {
    if (!findingId) return;
    setLoading(true);
    setError('');
    try {
      const r = await agronomistClient.getVisitDetail(findingId);
      setFinding(r.finding ?? null);
      setIssues(r.issues ?? []);
      setMeasurements(r.measurements ?? []);
      setRecommendations(r.recommendations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load visit');
    } finally {
      setLoading(false);
    }
  }, [findingId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading visit…" />;
  if (error) return <Alert>{error}</Alert>;
  if (!finding) return <p className="text-sm text-ink-muted">Visit not found.</p>;

  return (
    <div className="visit-wizard-page">
      <div className="visit-wizard-head">
        <div>
          <h1 className="page-title">Field visit</h1>
          <p className="page-subtitle">
            {String(finding.visitedAt ?? finding.visited_at ?? '—')} ·{' '}
            {String(finding.blockName ?? finding.block_name ?? 'Block')}
          </p>
        </div>
        <Link to={toPath(paths.agronomist)}>
          <Btn label="Back to operations" variant="secondary" />
        </Link>
        {findingId ? (
          <Btn
            label="Download report"
            variant="secondary"
            onClick={() => {
              void api<{ ok: boolean; report: { farmerText: string; agronomistText: string } }>(
                `/morbeez-staff/api/v1/os/field/visits/${findingId}/report`
              ).then((r) => {
                const blob = new Blob(
                  [`FARMER VERSION\n\n${r.report.farmerText}\n\n---\n\nAGRONOMIST VERSION\n\n${r.report.agronomistText}`],
                  { type: 'text/plain' }
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `visit-report-${findingId}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              });
            }}
          />
        ) : null}
      </div>

      <section className="visit-panel">
        <h3>Block assessment</h3>
        <p>
          Health: {String(finding.blockHealth ?? finding.block_health ?? '—')} · Performance:{' '}
          {String(finding.cropPerformance ?? finding.crop_performance ?? '—')} · Moisture:{' '}
          {String(finding.soilMoisture ?? finding.soil_moisture ?? '—')}
        </p>
      </section>

      <section className="visit-panel">
        <h3>Issues ({issues.length})</h3>
        <ul className="visit-detail-list">
          {(issues as Array<Record<string, unknown>>).map((issue, i) => (
            <li key={String(issue.id ?? i)}>
              <strong>{String(issue.issueName ?? issue.issue_name ?? 'Issue')}</strong>
              {issue.finalDiagnosis || issue.final_diagnosis ? (
                <span> — {String(issue.finalDiagnosis ?? issue.final_diagnosis)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="visit-panel">
        <h3>Measurements ({measurements.length})</h3>
        <ul className="visit-detail-list">
          {(measurements as Array<Record<string, unknown>>).map((m, i) => (
            <li key={i}>
              {String(m.measurementKey ?? m.measurement_key ?? m.key)}: {String(m.value ?? '—')}{' '}
              {String(m.unit ?? '')}
            </li>
          ))}
        </ul>
      </section>

      <section className="visit-panel">
        <h3>Recommendations ({recommendations.length})</h3>
        <ul className="visit-detail-list">
          {(recommendations as Array<Record<string, unknown>>).map((rec, i) => (
            <li key={String(rec.id ?? i)}>{String(rec.recommendationText ?? rec.recommendation_text ?? rec.text ?? '—')}</li>
          ))}
        </ul>
      </section>

      {findingId ? (
        <section className="visit-panel">
          <h3>Reports</h3>
          <Btn
            variant="secondary"
            onClick={() => {
              void api<{ ok: boolean; report: { pdfBase64?: string; farmerHtml?: string } }>(
                `/morbeez-staff/api/v1/os/field/visits/${findingId}/report`
              ).then((r) => {
                if (r.report.pdfBase64) {
                  const bin = atob(r.report.pdfBase64);
                  const bytes = new Uint8Array(bin.length);
                  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                  const blob = new Blob([bytes], { type: 'application/pdf' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `visit-${findingId}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              });
            }}
          >
            Download PDF report
          </Btn>
        </section>
      ) : null}
    </div>
  );
}
