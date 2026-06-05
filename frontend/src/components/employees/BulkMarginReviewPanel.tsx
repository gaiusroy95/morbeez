import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, Badge, Loading, Panel, TableWrap, DataTable } from '../ui';

const pricingApi = '/morbeez-staff/api/v1/os/pricing';

type Review = {
  id: string;
  commerce_quote_id: string;
  order_value_inr: number;
  gross_profit_inr: number;
  gross_margin_pct: number;
  min_required_pct: number;
  requested_by_name: string | null;
  created_at: string;
  employee_profiles?: { full_name?: string; employee_code?: string } | null;
  commerce_quotes?: { quote_number?: string; customer_name?: string; total?: number } | null;
};

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function BulkMarginReviewPanel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api<{ ok: boolean; reviews: Review[] }>(`${pricingApi}/bulk-reviews/pending`)
      .then((d) => setReviews(d.reviews ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load reviews'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, action: 'approve' | 'reject') {
    setActing(id);
    setError('');
    try {
      await api(`${pricingApi}/bulk-reviews/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(null);
    }
  }

  return (
    <Panel
      title="Bulk margin reviews"
      description="Quotes below 12% gross margin need owner approval before send"
      actions={
        <Btn size="sm" variant="secondary" onClick={() => load()}>
          Refresh
        </Btn>
      }
    >
      {loading ? <Loading label="Loading pending reviews…" /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!loading && !reviews.length ? (
        <p className="muted">No pending bulk margin reviews.</p>
      ) : null}
      {!loading && reviews.length > 0 ? (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Quote</th>
                <th>Employee</th>
                <th>Margin</th>
                <th>Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const quote = r.commerce_quotes;
                const emp = r.employee_profiles;
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{quote?.quote_number ?? r.commerce_quote_id.slice(0, 8)}</strong>
                      <div className="muted text-xs">{quote?.customer_name ?? '—'}</div>
                    </td>
                    <td>
                      {emp?.full_name ?? r.requested_by_name ?? '—'}
                      <div className="muted text-xs">{emp?.employee_code ?? ''}</div>
                    </td>
                    <td>
                      <Badge tone="warning">{Number(r.gross_margin_pct).toFixed(1)}%</Badge>
                      <div className="muted text-xs">min {Number(r.min_required_pct).toFixed(0)}%</div>
                    </td>
                    <td>
                      {formatInr(Number(quote?.total ?? r.order_value_inr))}
                      <div className="muted text-xs">GP {formatInr(Number(r.gross_profit_inr))}</div>
                    </td>
                    <td className="text-right">
                      <Btn
                        size="sm"
                        variant="primary"
                        disabled={acting === r.id}
                        onClick={() => void decide(r.id, 'approve')}
                      >
                        Approve
                      </Btn>{' '}
                      <Btn
                        size="sm"
                        variant="secondary"
                        disabled={acting === r.id}
                        onClick={() => void decide(r.id, 'reject')}
                      >
                        Reject
                      </Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </TableWrap>
      ) : null}
    </Panel>
  );
}
