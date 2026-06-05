import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Badge, Loading, Panel, TableWrap, DataTable } from '../ui';

const pricingApi = '/morbeez-staff/api/v1/os/pricing';

type Row = {
  employeeProfileId: string;
  fullName: string;
  employeeCode: string;
  salesVolumeInr: number;
  avgRealizationPct: number;
  netProfitInr: number;
  incentiveEarnedInr: number;
  status: 'excellent' | 'good' | 'warning' | 'critical' | 'restricted';
  actionStage: number;
};

function statusTone(s: Row['status']) {
  if (s === 'excellent') return 'success';
  if (s === 'good') return 'info';
  if (s === 'warning') return 'warning';
  return 'error';
}

function formatInr(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function EmployeePricingDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ ok: boolean; employees: Row[] }>(`${pricingApi}/performance/dashboard`)
      .then((d) => setRows(d.employees ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load pricing KPIs'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Panel
      title="Sales realization & profit"
      description="Avg realization %, net profit, incentive — ranked by profit contribution"
    >
      {loading ? <Loading label="Loading pricing KPIs…" /> : null}
      {error ? <p className="pricing-dash-error">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="muted">No sales data yet — quotes with pricing will appear here.</p>
      ) : null}
      {!loading && rows.length > 0 ? (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Sales</th>
                <th>Avg realization</th>
                <th>Net profit</th>
                <th>Incentive</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employeeProfileId}>
                  <td>
                    <strong>{r.fullName}</strong>
                    <div className="muted text-xs">{r.employeeCode}</div>
                  </td>
                  <td>{formatInr(r.salesVolumeInr)}</td>
                  <td>{r.avgRealizationPct.toFixed(1)}%</td>
                  <td>{formatInr(r.netProfitInr)}</td>
                  <td>{formatInr(r.incentiveEarnedInr)}</td>
                  <td>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    {r.actionStage > 0 ? (
                      <span className="pricing-action-stage">Stage {r.actionStage}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      ) : null}
    </Panel>
  );
}
