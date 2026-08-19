import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Alert, Badge, DataTable, Loading, PageHeader, Panel, ReadOnlyBanner, StatCard, TableWrap, TBody, Td, THead, Th } from '../../components/ui';

const base = '/morbeez-staff/api/v1/partners';

type PartnerRow = {
  id: string;
  partnerCode: string;
  fullName: string;
  phone: string;
  status: string;
  tier: string;
  reliabilityScore: number;
  performanceScore: number;
  currentActiveFarmers: number;
  territory?: string;
  cropAdvisor?: string;
  totalFarmers?: number;
  totalAcres?: number;
  eligibleSales?: number;
  invoiceValue?: number;
  partnerEarnings?: number;
};

export function PartnerControlTowerPage({ canWrite }: { canWrite: boolean }) {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await api<{ ok: boolean; partners: PartnerRow[] }>(base);
      setPartners(r.partners ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading />;

  const active = partners.filter((p) => p.status === 'active');
  const avgKpi = partners.length
    ? Math.round(partners.reduce((s, p) => s + (p.performanceScore ?? 0), 0) / partners.length)
    : 0;
  const avgReliability = partners.length
    ? Math.round(partners.reduce((s, p) => s + (p.reliabilityScore ?? 0), 0) / partners.length)
    : 0;

  const topPerformers = [...partners]
    .sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0))
    .slice(0, 10);
  const attentionRequired = partners.filter(
    (p) => (p.reliabilityScore ?? 0) < 50 || p.status !== 'active'
  );

  return (
    <div>
      <PageHeader title="Partner Control Tower" />
      {!canWrite && <ReadOnlyBanner />}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Partners" value={String(partners.length)} />
        <StatCard label="Active Partners" value={String(active.length)} />
        <StatCard label="Avg KPI Score" value={String(avgKpi)} />
        <StatCard label="Avg Reliability" value={String(avgReliability)} />
      </div>

      <Panel title="Top Performers">
        <TableWrap>
          <DataTable>
            <THead>
              <tr>
                <Th>Code</Th><Th>Name</Th><Th>Tier</Th><Th>KPI</Th><Th>Reliability</Th><Th>Farmers</Th>
              </tr>
            </THead>
            <TBody>
              {topPerformers.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link to={`/partners/${p.id}`} className="text-brand-600 hover:underline">
                      {p.partnerCode}
                    </Link>
                  </Td>
                  <Td>{p.fullName}</Td>
                  <Td><Badge>{p.tier}</Badge></Td>
                  <Td>{p.performanceScore}</Td>
                  <Td>{p.reliabilityScore}</Td>
                  <Td>{p.totalFarmers ?? p.currentActiveFarmers}</Td>
                </tr>
              ))}
            </TBody>
          </DataTable>
        </TableWrap>
      </Panel>

      <Panel title="Attention Required">
        <TableWrap>
          <DataTable>
            <THead>
              <tr>
                <Th>Code</Th><Th>Name</Th><Th>Status</Th><Th>Reliability</Th>
              </tr>
            </THead>
            <TBody>
              {attentionRequired.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link to={`/partners/${p.id}`} className="text-brand-600 hover:underline">
                      {p.partnerCode}
                    </Link>
                  </Td>
                  <Td>{p.fullName}</Td>
                  <Td><Badge tone={p.status === 'active' ? 'active' : 'warn'}>{p.status}</Badge></Td>
                  <Td>{p.reliabilityScore}</Td>
                </tr>
              ))}
            </TBody>
          </DataTable>
        </TableWrap>
      </Panel>
    </div>
  );
}
