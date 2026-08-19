import { useState, useEffect, useCallback } from 'react';
import { PageHeader, Panel, TableWrap, DataTable, THead, TBody, Th, Td, EmptyState, Loading, Alert } from '../../components/ui';
import api from '../../lib/api';

const base = '/morbeez-staff/api/v1/partners';

interface AuditEvent {
  id: string;
  timestamp: string;
  eventCode: string;
  name: string;
  status: string;
}

export function PartnerAuditLogPage({ canWrite }: { canWrite: boolean }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`${base}/events/list`);
      setEvents(res.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading />;
  if (error) return <Alert variant="error">{error}</Alert>;

  return (
    <div>
      <PageHeader title="Audit Log" />
      {events.length === 0 ? (
        <EmptyState message="No audit events found" />
      ) : (
        <Panel title="Events">
          <TableWrap>
            <DataTable>
              <THead>
                <tr>
                  <Th>Timestamp</Th><Th>Event Code</Th><Th>Name</Th><Th>Status</Th>
                </tr>
              </THead>
              <TBody>
                {events.map(ev => (
                  <tr key={ev.id}>
                    <Td>{new Date(ev.timestamp).toLocaleString()}</Td>
                    <Td>{ev.eventCode}</Td>
                    <Td>{ev.name}</Td>
                    <Td>{ev.status}</Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          </TableWrap>
        </Panel>
      )}
    </div>
  );
}
