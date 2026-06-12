import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';

const base = '/morbeez-staff/api/v1/os/telecaller';

type TimelineItem = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  at: string;
  meta?: {
    qcScore?: number;
    qcFlagged?: boolean;
    callId?: string;
    outcome?: string;
    workflowStatus?: string;
  };
};

const TYPE_ICON: Record<string, string> = {
  call: '📞',
  'Phone Call': '📞',
  whatsapp: '💬',
  soil_test: '🧪',
  field_finding: '🌿',
  interaction: '📋',
};

function formatAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function LeadTimelineFeed({ leadId, refreshKey = 0 }: { leadId: string; refreshKey?: number }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api<{ ok: boolean; items: TimelineItem[] }>(`${base}/leads/${leadId}/timeline`);
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load timeline');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading) return <p className="tc-empty-row">Loading timeline…</p>;
  if (error) return <p className="tc-empty-row">{error}</p>;
  if (!items.length) return <p className="tc-empty-row">No interactions yet.</p>;

  return (
    <section className="tc-dashboard-card tc-timeline-feed">
      <div className="tc-card-head">
        <h3>Unified timeline</h3>
      </div>
      <ul className="tc-timeline-list">
        {items.map((item) => (
          <li key={item.id} className="tc-timeline-item">
            <span className="tc-timeline-icon" aria-hidden>
              {TYPE_ICON[item.type] ?? '📋'}
            </span>
            <div className="tc-timeline-body">
              <div className="tc-timeline-head">
                <strong>{item.title}</strong>
                <time dateTime={item.at}>{formatAt(item.at)}</time>
              </div>
              {item.detail ? <p>{item.detail}</p> : null}
              {item.meta?.qcScore != null ? (
                <span className="tc-timeline-qc">
                  QC {item.meta.qcScore}
                  {item.meta.qcFlagged ? ' · flagged' : ''}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
