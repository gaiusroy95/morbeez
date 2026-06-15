import { useCallback, useEffect, useState } from 'react';
import { telecallerClient } from '@morbeez/shared';
import { Alert, Btn, Loading } from '../ui';

const STATUS_OPTIONS = [
  { value: 'follow_up_required', label: 'Follow-up required' },
  { value: 'hot_lead', label: 'Hot lead' },
  { value: 'ready_to_order', label: 'Ready to order' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
] as const;

type Props = {
  canWrite: boolean;
  onOpenLead: (leadId: string) => void;
};

export function TelecallerSalesOpportunitiesPanel({ canWrite, onOpenLead }: Props) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await telecallerClient.listSalesOpportunities());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sales opportunities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    try {
      await telecallerClient.updateSalesOpportunityStatus(id, status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Loading label="Loading sales opportunities…" />;

  return (
    <div className="tc-sales-opps">
      {error ? <Alert>{error}</Alert> : null}
      <div className="tc-followups-head">
        <p className="muted">{items.length} opportunities</p>
        <Btn label="Refresh" variant="secondary" size="sm" onClick={() => void load()} />
      </div>
      {!items.length ? <p className="muted">No partner sales opportunities assigned to you.</p> : null}
      <ul className="tc-followups-list">
        {items.map((opp) => {
          const id = String(opp.id);
          const farmers = opp.farmers as Record<string, unknown> | null;
          const farmerName = String(
            (farmers?.name as string | undefined) ||
              [farmers?.first_name, farmers?.last_name].filter(Boolean).join(' ') ||
              'Farmer'
          );
          const leadId = opp.lead_id ? String(opp.lead_id) : null;
          return (
            <li key={id} className="tc-followups-card">
              <strong>{String(opp.product ?? 'Product')}</strong>
              <div className="muted">
                {farmerName} · {String(opp.status ?? 'interested')}
              </div>
              {opp.notes ? <p>{String(opp.notes)}</p> : null}
              {leadId ? (
                <Btn label="Open lead" size="sm" variant="secondary" onClick={() => onOpenLead(leadId)} />
              ) : null}
              {canWrite ? (
                <div className="tc-sales-opps-chips">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="tc-sales-opps-chip"
                      disabled={busyId === id}
                      onClick={() => void updateStatus(id, opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
