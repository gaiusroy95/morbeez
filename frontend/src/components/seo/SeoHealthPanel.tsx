import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, DataTable, EmptyState, Loading, Panel, TableWrap } from '../ui';
import { SEO_API } from './seo-api';

type Issue = {
  id: string;
  issue_type: string;
  severity: string;
  url: string | null;
  message: string;
  resolved: boolean;
};

export function SeoHealthPanel({ canWrite }: { canWrite: boolean }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ ok: boolean; issues: Issue[] }>(`${SEO_API}/health?resolved=false`);
      setIssues(d.issues ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load health issues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runScan() {
    if (!canWrite) return;
    setScanning(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; issuesFound: number; scannedProducts: number }>(
        `${SEO_API}/health/scan`,
        { method: 'POST' }
      );
      setScanResult(`Scanned ${d.scannedProducts} products — ${d.issuesFound} issues found`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function resolve(id: string) {
    if (!canWrite) return;
    await api(`${SEO_API}/health/${id}/resolve`, { method: 'POST' });
    await load();
  }

  return (
    <Panel
      title="SEO health scanner"
      description="Missing meta, thin content, duplicate slugs, missing ALT tags"
      actions={
        canWrite ? (
          <Btn size="sm" onClick={() => void runScan()} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Run scan'}
          </Btn>
        ) : null
      }
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {scanResult ? <Alert tone="success">{scanResult}</Alert> : null}
      {loading ? <Loading /> : null}
      {!loading && issues.length === 0 ? <EmptyState>No open SEO issues.</EmptyState> : null}
      {!loading && issues.length > 0 ? (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Message</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id}>
                  <td>{i.issue_type}</td>
                  <td>{i.severity}</td>
                  <td>{i.message}</td>
                  <td>
                    {canWrite ? (
                      <Btn size="sm" variant="secondary" onClick={() => void resolve(i.id)}>
                        Resolve
                      </Btn>
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
