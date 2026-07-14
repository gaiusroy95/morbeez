import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { MiniStatCard } from '../employees/employee-ui';
import {
  Alert,
  Btn,
  DataTable,
  EmptyState,
  Field,
  Input,
  Loading,
  Panel,
  StaticSelect,
  TBody,
  Td,
  Th,
  THead,
  TableWrap,
} from '../ui';

type RoiEntry = {
  id: string;
  entryDate: string;
  category: string;
  comments: string | null;
  debitInr: number | null;
  creditInr: number | null;
  staffEditUsed: boolean;
  staffEditedBy: string | null;
};

type Props = {
  leadId: string;
  canWrite: boolean;
};

const CATEGORIES = ['labour', 'purchase', 'misc', 'harvest', 'income'] as const;

export function RoiTrackerTab({ leadId, canWrite }: Props) {
  const base = '/morbeez-staff/api/v1/os/telecaller';
  const [entries, setEntries] = useState<RoiEntry[]>([]);
  const [summary, setSummary] = useState({ debits: 0, credits: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [category, setCategory] = useState<string>('labour');
  const [comments, setComments] = useState('');
  const [debitInr, setDebitInr] = useState('');
  const [creditInr, setCreditInr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api<{
        ok: boolean;
        entries: RoiEntry[];
        summary: { debits: number; credits: number; balance: number };
      }>(`${base}/leads/${leadId}/roi-entries`);
      setEntries(res.entries ?? []);
      setSummary(res.summary ?? { debits: 0, credits: 0, balance: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load ROI entries');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(row: RoiEntry) {
    if (row.staffEditUsed) {
      setError('This entry was already edited once.');
      return;
    }
    setEditId(row.id);
    setEntryDate(row.entryDate);
    setCategory(row.category);
    setComments(row.comments ?? '');
    setDebitInr(row.debitInr != null ? String(row.debitInr) : '');
    setCreditInr(row.creditInr != null ? String(row.creditInr) : '');
    setPassword('');
    setError('');
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId || !password.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api(`${base}/leads/${leadId}/roi-entries/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          password: password.trim(),
          entryDate: entryDate || undefined,
          category,
          comments: comments.trim() || null,
          debitInr: debitInr.trim() ? Number(debitInr) : null,
          creditInr: creditInr.trim() ? Number(creditInr) : null,
        }),
      });
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Loading ROI tracker…" />;

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStatCard label="Expense" value={`₹${summary.debits.toFixed(0)}`} />
        <MiniStatCard label="Income" value={`₹${summary.credits.toFixed(0)}`} />
        <MiniStatCard
          label="Profit"
          value={<span className="text-brand-700">₹{summary.balance.toFixed(0)}</span>}
        />
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <p className="text-sm text-ink-secondary">
        Farmers add entries via WhatsApp. Telecallers may correct each row once using their login
        password.
      </p>

      <Panel bodyClassName="p-0">
        {entries.length === 0 ? (
          <EmptyState>No ROI entries yet. Farmer can log via WhatsApp ROI Tracker.</EmptyState>
        ) : (
          <TableWrap>
            <DataTable>
              <THead>
                <tr>
                  <Th>Date</Th>
                  <Th>Category</Th>
                  <Th>Comments</Th>
                  <Th>Expense</Th>
                  <Th>Income</Th>
                  <Th>Edited</Th>
                  {canWrite ? <Th /> : null}
                </tr>
              </THead>
              <TBody>
                {entries.map((row) => (
                  <tr key={row.id}>
                    <Td>{row.entryDate}</Td>
                    <Td className="capitalize">{row.category}</Td>
                    <Td className="max-w-[200px] truncate">{row.comments ?? '—'}</Td>
                    <Td>{row.debitInr != null ? `₹${row.debitInr}` : '—'}</Td>
                    <Td>{row.creditInr != null ? `₹${row.creditInr}` : '—'}</Td>
                    <Td className="text-xs">
                      {row.staffEditUsed ? `Yes (${row.staffEditedBy ?? 'staff'})` : '—'}
                    </Td>
                    {canWrite ? (
                      <Td>
                        <Btn
                          size="sm"
                          variant="ghost"
                          className="text-brand-700 hover:text-brand-800"
                          disabled={row.staffEditUsed}
                          onClick={() => startEdit(row)}
                        >
                          Edit once
                        </Btn>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </TBody>
            </DataTable>
          </TableWrap>
        )}
      </Panel>

      {editId && canWrite ? (
        <Panel
          title="One-time correction"
          description="Previous value is stored in audit."
          bodyClassName="space-y-3"
          className="border-amber-200 bg-amber-50/40"
        >
          <form onSubmit={saveEdit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date">
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </Field>
              <Field label="Category">
                <StaticSelect
                  value={category}
                  onChange={setCategory}
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field label="Comments" className="sm:col-span-2">
                <Input value={comments} onChange={(e) => setComments(e.target.value)} />
              </Field>
              <Field label="Expense ₹">
                <Input value={debitInr} onChange={(e) => setDebitInr(e.target.value)} />
              </Field>
              <Field label="Income ₹">
                <Input value={creditInr} onChange={(e) => setCreditInr(e.target.value)} />
              </Field>
              <Field label="Your staff password (required)" className="sm:col-span-2">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save correction'}
              </Btn>
              <Btn type="button" variant="secondary" onClick={() => setEditId(null)}>
                Cancel
              </Btn>
            </div>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
