import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Field, Modal, inputClass } from '../Modal';
import { Alert, Badge, Btn, Loading, Panel, StaticSelect } from '../ui';

const base = '/morbeez-staff/api/v1/os/settings/translations';

const CATEGORIES = [
  { value: 'all', label: 'All categories' },
  { value: 'ui_labels', label: 'UI labels' },
  { value: 'advisory_text', label: 'Advisory text' },
  { value: 'notification_text', label: 'Notification text' },
  { value: 'error_messages', label: 'Error messages' },
  { value: 'content', label: 'Content' },
] as const;

const APP_SCOPES = [
  { value: 'all', label: 'All apps' },
  { value: 'farmer', label: 'Farmer' },
  { value: 'agronomist', label: 'Agronomist' },
  { value: 'warehouse', label: 'Warehouse' },
] as const;

const STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'archived', label: 'Archived' },
] as const;

type TranslationRow = {
  id: string;
  dictKey: string;
  category: string;
  appScope: string;
  valueEn: string;
  valueHi: string | null;
  valueMl: string | null;
  valueTa: string | null;
  valueKn: string | null;
  translate: boolean;
  status: string;
  notes: string | null;
};

function statusTone(status: string): 'active' | 'warning' | 'archived' {
  if (status === 'approved') return 'active';
  if (status === 'draft') return 'warning';
  return 'archived';
}

export function LanguageDictionaryPanel({ canWrite }: { canWrite?: boolean }) {
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('all');
  const [appScope, setAppScope] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<TranslationRow | null | 'new'>(null);
  const [publishing, setPublishing] = useState(false);

  async function reload() {
    setError('');
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (appScope !== 'all') params.set('appScope', appScope);
    if (status !== 'all') params.set('status', status);
    if (search.trim()) params.set('q', search.trim());
    const d = await api<{ ok: boolean; rows: TranslationRow[] }>(`${base}?${params.toString()}`);
    setRows(d.rows ?? []);
  }

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load translations'))
      .finally(() => setLoading(false));
  }, [category, appScope, status]);

  async function publishPacks() {
    setPublishing(true);
    setError('');
    setMessage('');
    try {
      const d = await api<{ ok: boolean; version: number }>(`${base}/publish`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage(`Language packs published (version ${d.version}). Apps will download on next open.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  async function approveRow(row: TranslationRow) {
    await api(`${base}/${row.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    });
    await reload();
  }

  return (
    <Panel title="Language dictionary">
      <p className="muted mb-4">
        Manage UI labels, advisory text, notifications, and error messages for mobile apps.
        Only <strong>Approved</strong> entries are sent to apps. Technical terms (pH, NPK, ROI)
        can be marked as non-translatable.
      </p>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StaticSelect className={inputClass} value={category} onChange={setCategory} options={[...CATEGORIES]} />
        <StaticSelect className={inputClass} value={appScope} onChange={setAppScope} options={[...APP_SCOPES]} />
        <StaticSelect className={inputClass} value={status} onChange={setStatus} options={[...STATUSES]} />
        <input
          className={inputClass}
          placeholder="Search key or English…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void reload();
          }}
        />
        <Btn variant="secondary" onClick={() => void reload()}>
          Search
        </Btn>
        {canWrite ? (
          <>
            <Btn onClick={() => setModal('new')}>+ Add key</Btn>
            <Btn variant="secondary" disabled={publishing} onClick={() => void publishPacks()}>
              {publishing ? 'Publishing…' : 'Publish packs'}
            </Btn>
          </>
        ) : null}
      </div>

      {loading ? <Loading /> : null}

      {!loading ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Key</th>
                <th className="px-3 py-3">English</th>
                <th className="px-3 py-3">Hindi</th>
                <th className="px-3 py-3">Tamil</th>
                <th className="px-3 py-3">Kannada</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Translate?</th>
                <th className="px-3 py-3">Status</th>
                {canWrite ? <th className="px-3 py-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-mono text-xs">{row.dictKey}</td>
                  <td className="max-w-[140px] truncate px-3 py-3">{row.valueEn}</td>
                  <td className="max-w-[120px] truncate px-3 py-3">{row.valueHi ?? '—'}</td>
                  <td className="max-w-[120px] truncate px-3 py-3">{row.valueTa ?? '—'}</td>
                  <td className="max-w-[120px] truncate px-3 py-3">{row.valueKn ?? '—'}</td>
                  <td className="px-3 py-3 text-xs">{row.category.replace('_', ' ')}</td>
                  <td className="px-3 py-3">{row.translate ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-3">
                    <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                  </td>
                  {canWrite ? (
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs text-emerald-700 hover:underline"
                          onClick={() => setModal(row)}
                        >
                          Edit
                        </button>
                        {row.status !== 'approved' ? (
                          <button
                            type="button"
                            className="text-xs text-emerald-700 hover:underline"
                            onClick={() => void approveRow(row)}
                          >
                            Approve
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="p-4 text-sm text-slate-500">No translations match filters.</p> : null}
        </div>
      ) : null}

      {modal ? (
        <TranslationModal
          row={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void reload();
          }}
        />
      ) : null}
    </Panel>
  );
}

function TranslationModal({
  row,
  onClose,
  onSaved,
}: {
  row: TranslationRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dictKey, setDictKey] = useState(row?.dictKey ?? '');
  const [category, setCategory] = useState(row?.category ?? 'ui_labels');
  const [appScope, setAppScope] = useState(row?.appScope ?? 'all');
  const [valueEn, setValueEn] = useState(row?.valueEn ?? '');
  const [valueHi, setValueHi] = useState(row?.valueHi ?? '');
  const [valueMl, setValueMl] = useState(row?.valueMl ?? '');
  const [valueTa, setValueTa] = useState(row?.valueTa ?? '');
  const [valueKn, setValueKn] = useState(row?.valueKn ?? '');
  const [translate, setTranslate] = useState(row?.translate ?? true);
  const [status, setStatus] = useState(row?.status ?? 'draft');
  const [notes, setNotes] = useState(row?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(base, {
        method: 'POST',
        body: JSON.stringify({
          id: row?.id,
          dictKey,
          category,
          appScope,
          valueEn,
          valueHi: valueHi || null,
          valueMl: valueMl || null,
          valueTa: valueTa || null,
          valueKn: valueKn || null,
          translate,
          status,
          notes: notes || null,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={row ? 'Edit translation' : 'Add translation'}
      onClose={onClose}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" disabled={busy || !dictKey.trim() || !valueEn.trim()} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </Btn>
        </>
      }
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field label="Key (matches app t() key)">
        <input className={inputClass} value={dictKey} onChange={(e) => setDictKey(e.target.value)} disabled={!!row} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <StaticSelect
            className={inputClass}
            value={category}
            onChange={setCategory}
            options={CATEGORIES.filter((c) => c.value !== 'all')}
          />
        </Field>
        <Field label="App scope">
          <StaticSelect
            className={inputClass}
            value={appScope}
            onChange={setAppScope}
            options={APP_SCOPES.filter((c) => c.value !== 'all')}
          />
        </Field>
      </div>
      <Field label="English">
        <input className={inputClass} value={valueEn} onChange={(e) => setValueEn(e.target.value)} />
      </Field>
      <Field label="Hindi">
        <input className={inputClass} value={valueHi} onChange={(e) => setValueHi(e.target.value)} />
      </Field>
      <Field label="Malayalam">
        <input className={inputClass} value={valueMl} onChange={(e) => setValueMl(e.target.value)} />
      </Field>
      <Field label="Tamil">
        <input className={inputClass} value={valueTa} onChange={(e) => setValueTa(e.target.value)} />
      </Field>
      <Field label="Kannada">
        <input className={inputClass} value={valueKn} onChange={(e) => setValueKn(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={translate} onChange={(e) => setTranslate(e.target.checked)} />
        Translate this key (uncheck for pH, NPK, ROI, WhatsApp, etc.)
      </label>
      <Field label="Status">
        <StaticSelect
          className={inputClass}
          value={status}
          onChange={setStatus}
          options={STATUSES.filter((s) => s.value !== 'all')}
        />
      </Field>
      <Field label="Notes (internal)">
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Modal>
  );
}
