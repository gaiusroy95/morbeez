import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Loading } from '../ui';
import '../../styles/follow-up-kpi.css';

const base = '/morbeez-staff/api/v1/os/agronomist';

type FollowUpKpis = {
  periodDays: number;
  recommendationsCommunicated: number;
  applicationRatePct: number;
  outcomeRecorded: number;
  successRatePct: number;
  whatsappKpi: {
    outcomeMessagesSent: number;
    outcomeResponseRatePct: number;
    fullyImprovedCount: number;
    slightImprovementCount: number;
    photoUploadedCount: number;
    pendingHumanVerification: number;
  };
  pendingScheduledFollowUps: number;
  noResponseFarmers: number;
};

export function FollowUpKpiPanel() {
  const [days, setDays] = useState(30);
  const [kpis, setKpis] = useState<FollowUpKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api<{ ok: boolean; kpis: FollowUpKpis }>(
        `${base}/follow-up/kpis?days=${days}`
      );
      setKpis(r.kpis);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load follow-up KPIs');
      setKpis(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !kpis) return <Loading label="Loading WhatsApp follow-up KPIs…" />;
  if (!kpis) return error ? <Alert tone="error">{error}</Alert> : null;

  const k = kpis.whatsappKpi;

  return (
    <section className="fu-kpi-panel">
      <div className="fu-kpi-head">
        <div>
          <h3 className="fu-kpi-title">WhatsApp outcome KPIs</h3>
          <p className="fu-kpi-sub">
            Automated follow-up after recommendations — human review only for failed, severe, or
            uncertain cases.
          </p>
        </div>
        <label className="fu-kpi-period">
          <span>Period</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </label>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="fu-kpi-grid">
        <div className="fu-kpi-card">
          <span className="fu-kpi-label">Outcome messages sent</span>
          <strong className="fu-kpi-value">{k.outcomeMessagesSent}</strong>
        </div>
        <div className="fu-kpi-card">
          <span className="fu-kpi-label">Farmer response rate</span>
          <strong className="fu-kpi-value">{k.outcomeResponseRatePct}%</strong>
        </div>
        <div className="fu-kpi-card">
          <span className="fu-kpi-label">Fully improved</span>
          <strong className="fu-kpi-value">{k.fullyImprovedCount}</strong>
        </div>
        <div className="fu-kpi-card">
          <span className="fu-kpi-label">Slight improvement</span>
          <strong className="fu-kpi-value">{k.slightImprovementCount}</strong>
        </div>
        <div className="fu-kpi-card">
          <span className="fu-kpi-label">Photos on follow-up</span>
          <strong className="fu-kpi-value">{k.photoUploadedCount}</strong>
        </div>
        <div className="fu-kpi-card fu-kpi-card--warn">
          <span className="fu-kpi-label">Needs human verification</span>
          <strong className="fu-kpi-value">{k.pendingHumanVerification}</strong>
        </div>
        <div className="fu-kpi-card">
          <span className="fu-kpi-label">Spray confirmed</span>
          <strong className="fu-kpi-value">{kpis.applicationRatePct}%</strong>
        </div>
        <div className="fu-kpi-card">
          <span className="fu-kpi-label">Recorded outcomes</span>
          <strong className="fu-kpi-value">{kpis.outcomeRecorded}</strong>
        </div>
      </div>
    </section>
  );
}
