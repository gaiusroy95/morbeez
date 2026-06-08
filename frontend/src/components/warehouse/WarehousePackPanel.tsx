import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import { Alert, Btn, DataTable, EmptyState, Loading, Panel, TableWrap, inputClass } from '../ui';
import { WMS_API } from './warehouse-api';
import { BarcodeScanInput } from './BarcodeScanInput';

function printUrl(type: string, id: string) {
  return toPath(`${paths.warehouse}/print/${type}/${id}`);
}

type PickList = {
  id: string;
  commerce_order_id: string;
  status: string;
  commerce_orders: { order_name: string | null };
  pick_list_lines: Array<{
    id: string;
    product_title: string;
    sku: string | null;
    batch_code: string | null;
    qty_required: number;
    qty_picked: number;
    manually_verified: boolean;
  }>;
};

export function WarehousePackPanel({
  canWrite,
  focusOrderId,
}: {
  canWrite: boolean;
  focusOrderId?: string | null;
}) {
  const [pickLists, setPickLists] = useState<PickList[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<PickList | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [scanMsg, setScanMsg] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const autoOpenedPick = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ ok: boolean; pickLists: PickList[] }>(`${WMS_API}/pick-lists`);
      const open = (d.pickLists ?? []).filter((p) =>
        ['pending', 'picking', 'picked'].includes(p.status)
      );
      setPickLists(open);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pick lists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusOrderId || loading || selectedId || autoOpenedPick.current) return;
    const pick = pickLists.find((p) => p.commerce_order_id === focusOrderId);
    if (pick) {
      autoOpenedPick.current = true;
      void loadDetail(pick.id);
    }
  }, [focusOrderId, pickLists, loading, selectedId]);

  async function loadDetail(id: string) {
    setSelectedId(id);
    setScanMsg('');
    setSuccess('');
    const d = await api<{ ok: boolean; pickList: PickList }>(`${WMS_API}/pick-lists/${id}`);
    setDetail(d.pickList);
    if (canWrite) {
      const sess = await api<{ ok: boolean; session: { id: string } }>(
        `${WMS_API}/pick-lists/${id}/pack-session`,
        { method: 'POST', body: JSON.stringify({ mode: 'barcode' }) }
      );
      setSessionId(sess.session.id);
    }
  }

  async function verifyLine(lineId: string) {
    if (!selectedId || !canWrite) return;
    await api(`${WMS_API}/pick-lists/${selectedId}/lines/${lineId}/verify`, { method: 'POST' });
    await loadDetail(selectedId);
  }

  async function scan() {
    if (!sessionId || !scanCode.trim()) return;
    setScanMsg('');
    const r = await api<{ ok: boolean; error?: string; productTitle?: string }>(
      `${WMS_API}/pack-sessions/${sessionId}/scan`,
      { method: 'POST', body: JSON.stringify({ code: scanCode.trim() }) }
    );
    setScanMsg(r.ok ? `OK: ${r.productTitle ?? scanCode}` : r.error ?? 'Scan failed');
    setScanCode('');
  }

  async function completePack() {
    if (!selectedId || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      await api(`${WMS_API}/pick-lists/${selectedId}/complete-pack`, { method: 'POST' });
      setSuccess('Packed — invoice generated. Print docs & scan AWB in Orders tab to dispatch.');
      await loadDetail(selectedId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pack failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading pack queue…" />;

  return (
    <div className="warehouse-pack">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <Panel title="Select pick list">
        {pickLists.length === 0 ? <EmptyState>No lists ready for packing.</EmptyState> : null}
        <div className="warehouse-pack-picker">
          {pickLists.map((p) => (
            <Btn
              key={p.id}
              size="sm"
              variant={selectedId === p.id ? 'primary' : 'secondary'}
              onClick={() => void loadDetail(p.id)}
            >
              {p.commerce_orders?.order_name ?? p.id.slice(0, 8)} ({p.status})
            </Btn>
          ))}
        </div>
      </Panel>

      {detail ? (
        <Panel title="Pack & verify">
          {canWrite ? (
            <div className="warehouse-scan-block">
              <BarcodeScanInput
                value={scanCode}
                onChange={setScanCode}
                onScan={() => void scan()}
                placeholder="Scan barcode, SKU, or batch code"
              />
              {scanMsg ? <span className="scan-msg">{scanMsg}</span> : null}
            </div>
          ) : null}
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch</th>
                  <th>Qty</th>
                  <th>Verified</th>
                  {canWrite ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {detail.pick_list_lines?.map((l) => (
                  <tr key={l.id}>
                    <td>{l.product_title}</td>
                    <td>{l.batch_code ?? '—'}</td>
                    <td>{l.qty_required}</td>
                    <td>{l.manually_verified || l.qty_picked >= l.qty_required ? '✓' : '—'}</td>
                    {canWrite ? (
                      <td>
                        {!l.manually_verified && l.qty_picked < l.qty_required ? (
                          <Btn size="sm" variant="secondary" onClick={() => void verifyLine(l.id)}>
                            Tick
                          </Btn>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
          <div className="warehouse-pack-print-row">
            <Link
              className="btn btn-secondary btn-sm"
              to={printUrl('packing_slip', selectedId)}
              target="_blank"
            >
              Packing slip
            </Link>
            <Link
              className="btn btn-secondary btn-sm"
              to={printUrl('picking_slip', selectedId)}
              target="_blank"
            >
              Picking slip
            </Link>
            {detail.commerce_order_id ? (
              <Link
                className="btn btn-secondary btn-sm"
                to={printUrl('courier_label', detail.commerce_order_id)}
                target="_blank"
              >
                Courier label
              </Link>
            ) : null}
          </div>
          {canWrite ? (
            <Btn className="mt-4" onClick={() => void completePack()} disabled={busy}>
              {busy ? 'Packing…' : 'Complete pack → invoice & courier label'}
            </Btn>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
