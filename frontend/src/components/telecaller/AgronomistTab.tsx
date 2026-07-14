import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert } from '../ui';

const base = '/morbeez-staff/api/v1/os/telecaller';

type AgronomistInfo = {
  name: string;
  employeeId: string;
  mobile: string;
  email: string;
  specialization: string;
  assignedSince: string;
  assignedBlocks: string;
  lastReview: string;
  nextVisit: string;
  status: string;
  statusTone: string;
  initials: string;
};

type ActivityRow = {
  id: string;
  source: 'field_finding' | 'recommendation';
  dateLabel: string;
  activity: string;
  activityTone: string;
  block: string;
  notes: string;
};

type BlockRow = {
  block: string;
  crop: string;
  area: string;
  status: string;
  statusTone: string;
};

type PerformanceCard = {
  label: string;
  value: string;
  icon: string;
};

function activityClass(tone: string): string {
  return `tc-ag-activity tc-ag-activity--${tone}`;
}

function blockStatusClass(tone: string): string {
  return `tc-ag-block-status tc-ag-block-status--${tone}`;
}

type Props = {
  leadId: string;
  canWrite: boolean;
  refreshKey: number;
  onScheduleVisit: () => void;
  onAddRecommendation: () => void;
  onOpenActivity: (row: ActivityRow) => void;
};

export function AgronomistTab({
  leadId,
  canWrite,
  refreshKey,
  onScheduleVisit,
  onAddRecommendation,
  onOpenActivity,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agronomist, setAgronomist] = useState<AgronomistInfo | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [performance, setPerformance] = useState<PerformanceCard[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{
        ok: boolean;
        agronomist: AgronomistInfo;
        activities: ActivityRow[];
        blocks: BlockRow[];
        performance: PerformanceCard[];
      }>(`${base}/leads/${leadId}/agronomist`);
      setAgronomist(data.agronomist);
      setActivities(data.activities ?? []);
      setBlocks(data.blocks ?? []);
      setPerformance(data.performance ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agronomist panel');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function callAgronomist() {
    if (!agronomist?.mobile) return;
    const tel = agronomist.mobile.replace(/\D/g, '');
    window.open(`tel:${tel}`, '_self');
  }

  function whatsappAgronomist() {
    if (!agronomist?.mobile) return;
    const digits = agronomist.mobile.replace(/\D/g, '');
    const phone = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${phone}`, '_blank');
  }

  if (loading) {
    return <p className="tc-ag-empty">Loading agronomist profile…</p>;
  }

  if (error) {
    return <Alert tone="error">{error}</Alert>;
  }

  if (!agronomist) return null;

  return (
    <div className="tc-agronomist">
      <div className="tc-ag-profile-card">
        <div className="tc-ag-profile-head">
          <div className="tc-ag-avatar-lg">{agronomist.initials}</div>
          <div>
            <h2 className="tc-ag-name">{agronomist.name}</h2>
            <p className="tc-ag-meta">Primary agronomist for this farmer</p>
          </div>
          <span className="tc-ag-status-badge">{agronomist.status}</span>
        </div>

        <dl className="tc-ag-info-grid">
          <div>
            <dt>Employee ID</dt>
            <dd>{agronomist.employeeId}</dd>
          </div>
          <div>
            <dt>Mobile</dt>
            <dd>{agronomist.mobile || '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{agronomist.email || '—'}</dd>
          </div>
          <div>
            <dt>Specialization</dt>
            <dd>{agronomist.specialization}</dd>
          </div>
          <div>
            <dt>Assigned since</dt>
            <dd>{agronomist.assignedSince}</dd>
          </div>
          <div>
            <dt>Assigned blocks</dt>
            <dd>{agronomist.assignedBlocks}</dd>
          </div>
          <div>
            <dt>Last review</dt>
            <dd>{agronomist.lastReview}</dd>
          </div>
          <div>
            <dt>Next visit</dt>
            <dd>{agronomist.nextVisit}</dd>
          </div>
        </dl>

        <div className="tc-ag-actions">
          <button type="button" className="tc-ag-btn-primary" onClick={callAgronomist}>
            Call agronomist
          </button>
          <button type="button" className="tc-ag-btn-primary" onClick={whatsappAgronomist}>
            WhatsApp
          </button>
          {canWrite ? (
            <>
              <button type="button" className="tc-ag-btn-secondary" onClick={onScheduleVisit}>
                Schedule visit
              </button>
              <button type="button" className="tc-ag-btn-secondary" onClick={onAddRecommendation}>
                + Recommendation
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="tc-ag-columns">
        <section className="tc-ag-section">
          <h3 className="tc-ag-section-title">Recent activities</h3>
          <div className="tc-ag-table-wrap">
            <table className="tc-ag-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Activity</th>
                  <th>Block</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr
                    key={`${a.source}-${a.id}`}
                    className="tc-ag-row"
                    onClick={() => onOpenActivity(a)}
                  >
                    <td className="tc-ag-date">{a.dateLabel}</td>
                    <td>
                      <span className={activityClass(a.activityTone)}>{a.activity}</span>
                    </td>
                    <td>{a.block}</td>
                    <td className="tc-ag-notes">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activities.length === 0 ? (
              <p className="tc-ag-empty">No agronomist activities recorded yet.</p>
            ) : null}
          </div>
        </section>

        <div className="tc-ag-side">
          <section className="tc-ag-section">
            <h3 className="tc-ag-section-title">Assigned blocks</h3>
            <div className="tc-ag-table-wrap">
              <table className="tc-ag-table tc-ag-table--compact">
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Crop</th>
                    <th>Area</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((b) => (
                    <tr key={b.block}>
                      <td className="font-medium">{b.block}</td>
                      <td>{b.crop}</td>
                      <td>{b.area}</td>
                      <td>
                        <span className={blockStatusClass(b.statusTone)}>{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {blocks.length === 0 ? (
                <p className="tc-ag-empty">No blocks assigned.</p>
              ) : null}
            </div>
          </section>

          <section className="tc-ag-section">
            <h3 className="tc-ag-section-title">Agronomist performance (this farmer)</h3>
            <div className="tc-ag-kpi-grid">
              {performance.map((p) => (
                <div key={p.label} className="tc-ag-kpi">
                  <span className="tc-ag-kpi-icon" aria-hidden>
                    {p.icon}
                  </span>
                  <span className="tc-ag-kpi-value">{p.value}</span>
                  <span className="tc-ag-kpi-label">{p.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export type { ActivityRow as AgronomistActivityRow };
