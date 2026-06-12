import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  createTemplateDefinition,
  fetchGroupedTemplates,
  TEMPLATE_CATEGORIES,
  TEMPLATE_LANGUAGES,
  type GroupedLanguageTemplate,
} from '../../lib/language-templates-api';
import { paths, toPath } from '../../lib/routes';
import { Field, Modal, inputClass } from '../Modal';
import { StaticSelect } from '../ui';

const base = '/morbeez-staff/api/v1/os/operations';

const LANGS = ['en', 'ml', 'ta', 'kn', 'hi'] as const;
const CATEGORIES = ['general', 'telecaller', 'advisory', 'orders', 'broadcast'] as const;
const JOB_TYPES = [
  'follow_up_reminder',
  'callback_reminder',
  'whatsapp_follow_up',
  'seasonal_alert',
  'cultivation_application_prompt',
  'cultivation_result_validation',
];

type QuickReply = {
  id: string;
  shortcut_key: string;
  category: string;
  label_en: string;
  body_en: string;
  body_ml: string | null;
  active: boolean;
  sort_order: number;
};

type LangTemplate = {
  id: string;
  template_key: string;
  language: string;
  channel: string;
  body_text: string;
  meta_template_name: string | null;
  status: string;
  active: boolean;
};

type AutoJob = {
  id: string;
  job_type: string;
  status: string;
  scheduled_at: string;
  attempts: number;
  last_error: string | null;
  farmerName: string;
  farmerPhone: string | null;
  payload: Record<string, unknown>;
};

export function QuickRepliesPanel({
  replies,
  canWrite,
  category,
  onCategoryChange,
  onRefresh,
}: {
  replies: QuickReply[];
  canWrite: boolean;
  category: string;
  onCategoryChange: (c: string) => void;
  onRefresh: () => void;
}) {
  const [modal, setModal] = useState<QuickReply | null | 'new'>(null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StaticSelect
          className="rounded border border-slate-200 px-2 py-1 text-sm"
          value={category}
          onChange={onCategoryChange}
          options={[
            { value: 'all', label: 'All categories' },
            ...CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
        />
        {canWrite ? (
          <button
            type="button"
            onClick={() => setModal('new')}
            className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            + Quick reply
          </button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">EN preview</th>
              <th className="px-4 py-3">Category</th>
              {canWrite ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {replies.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{r.shortcut_key}</td>
                <td className="px-4 py-3">{r.label_en}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">{r.body_en}</td>
                <td className="px-4 py-3 capitalize">{r.category}</td>
                {canWrite ? (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-xs text-emerald-700 hover:underline"
                      onClick={() => setModal(r)}
                    >
                      Edit
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {replies.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No quick replies — apply migration 20260611000000_operations_messaging_masters.sql
          </p>
        ) : null}
      </div>
      {modal ? (
        <QuickReplyModal
          row={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function QuickReplyModal({
  row,
  onClose,
  onSaved,
}: {
  row: QuickReply | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({
    shortcutKey: row?.shortcut_key ?? '',
    category: row?.category ?? 'general',
    labelEn: row?.label_en ?? '',
    bodyEn: row?.body_en ?? '',
    bodyMl: row?.body_ml ?? '',
    sortOrder: String(row?.sort_order ?? 0),
  });

  async function save() {
    setSaving(true);
    setErr('');
    try {
      await api(`${base}/quick-replies`, {
        method: 'POST',
        body: JSON.stringify({
          id: row?.id,
          shortcutKey: f.shortcutKey,
          category: f.category,
          labelEn: f.labelEn,
          bodyEn: f.bodyEn,
          bodyMl: f.bodyMl || undefined,
          sortOrder: Number(f.sortOrder) || 0,
        }),
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={row ? 'Edit quick reply' : 'Add quick reply'} onClose={onClose} onSave={save} saving={saving}>
      {err ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
      <div className="space-y-3">
        <Field label="Shortcut key (unique)">
          <input className={inputClass} value={f.shortcutKey} onChange={(e) => setF({ ...f, shortcutKey: e.target.value })} />
        </Field>
        <Field label="Category">
          <StaticSelect
            className={inputClass}
            value={f.category}
            onChange={(value) => setF({ ...f, category: value })}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </Field>
        <Field label="Label (EN)">
          <input className={inputClass} value={f.labelEn} onChange={(e) => setF({ ...f, labelEn: e.target.value })} />
        </Field>
        <Field label="Message body (EN)">
          <textarea className={inputClass} rows={3} value={f.bodyEn} onChange={(e) => setF({ ...f, bodyEn: e.target.value })} />
        </Field>
        <Field label="Message body (ML)">
          <textarea className={inputClass} rows={2} value={f.bodyMl} onChange={(e) => setF({ ...f, bodyMl: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function LanguageTemplatesPanel({
  canWrite,
  statusFilter,
  categoryFilter,
  search = '',
  onStatusChange,
  onCategoryChange,
}: {
  canWrite: boolean;
  statusFilter: string;
  categoryFilter: string;
  search?: string;
  onStatusChange: (s: string) => void;
  onCategoryChange: (s: string) => void;
}) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<GroupedLanguageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ templateKey: '', displayName: '', category: 'general' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await fetchGroupedTemplates({
        status: statusFilter,
        category: categoryFilter,
        search: search || undefined,
      });
      setTemplates(d.templates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => templates, [templates]);

  async function createNew() {
    const d = await createTemplateDefinition({
      templateKey: newForm.templateKey,
      displayName: newForm.displayName || undefined,
      category: newForm.category,
    });
    setShowNew(false);
    navigate(toPath(paths.operationsLanguageTemplate.replace(':templateKey', d.template.templateKey)));
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        Manage multilingual message templates from a single record per template key.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StaticSelect
          className="rounded border border-slate-200 px-2 py-1 text-sm"
          value={statusFilter}
          onChange={onStatusChange}
          options={['all', 'draft', 'in_translation', 'under_review', 'approved', 'archived'].map((s) => ({
            value: s,
            label: s.replace(/_/g, ' '),
          }))}
        />
        <StaticSelect
          className="rounded border border-slate-200 px-2 py-1 text-sm"
          value={categoryFilter}
          onChange={onCategoryChange}
          options={[{ value: 'all', label: 'All categories' }, ...TEMPLATE_CATEGORIES.map((c) => c)]}
        />
        {canWrite ? (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            + Template
          </button>
        ) : null}
      </div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading templates…</p> : null}
      <div className="space-y-3">
        {visible.map((t) => (
          <div
            key={t.templateKey}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-slate-900">{t.displayName}</h3>
                <p className="text-xs text-slate-500">
                  {t.templateKey} · {t.category} · {t.channel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">
                  {t.status.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-semibold text-emerald-700">{t.completionRate}%</span>
                <button
                  type="button"
                  className="text-sm text-emerald-700 hover:underline"
                  onClick={() =>
                    navigate(
                      toPath(paths.operationsLanguageTemplate.replace(':templateKey', t.templateKey))
                    )
                  }
                >
                  Edit
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TEMPLATE_LANGUAGES.map((lang) => (
                <span
                  key={lang.code}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    t.languageComplete?.[lang.code]
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {lang.label} {t.languageComplete?.[lang.code] ? '✓' : '✗'}
                </span>
              ))}
            </div>
          </div>
        ))}
        {!loading && visible.length === 0 ? (
          <p className="text-center text-sm text-slate-500">No templates yet.</p>
        ) : null}
      </div>
      {showNew ? (
        <Modal
          title="New template"
          onClose={() => setShowNew(false)}
          onSave={() => void createNew()}
          saveLabel="Create"
        >
          <div className="space-y-3">
            <Field label="Template key">
              <input
                className={inputClass}
                placeholder="welcome_farmer"
                value={newForm.templateKey}
                onChange={(e) => setNewForm((f) => ({ ...f, templateKey: e.target.value }))}
              />
            </Field>
            <Field label="Display name">
              <input
                className={inputClass}
                placeholder="Welcome Farmer"
                value={newForm.displayName}
                onChange={(e) => setNewForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </Field>
            <Field label="Category">
              <StaticSelect
                className={inputClass}
                value={newForm.category}
                onChange={(v) => setNewForm((f) => ({ ...f, category: v }))}
                options={TEMPLATE_CATEGORIES.map((c) => c)}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function AutomationJobsPanel({
  jobs,
  stats,
  canWrite,
  statusFilter,
  jobTypeFilter,
  onStatusChange,
  onJobTypeChange,
  onRefresh,
}: {
  jobs: AutoJob[];
  stats: Record<string, number> | null;
  canWrite: boolean;
  statusFilter: string;
  jobTypeFilter: string;
  onStatusChange: (s: string) => void;
  onJobTypeChange: (t: string) => void;
  onRefresh: () => void;
}) {
  const [error, setError] = useState('');

  async function cancel(id: string) {
    if (!canWrite) return;
    try {
      await api(`${base}/automation-jobs/${id}/cancel`, { method: 'POST', body: '{}' });
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    }
  }

  async function retry(id: string) {
    if (!canWrite) return;
    try {
      await api(`${base}/automation-jobs/${id}/retry`, { method: 'POST', body: '{}' });
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retry failed');
    }
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold text-slate-900">Job monitor</h2>
      <p className="mb-4 text-sm text-slate-600">
        Background follow-up and reminder jobs (WhatsApp, cultivation prompts). For campaign automation, use
        Campaign rules under Automation.
      </p>
      {stats ? (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <StatChip label="Due now" value={stats.dueNow ?? 0} tone="amber" />
          <StatChip label="Pending" value={stats.pending ?? 0} />
          <StatChip label="Processing" value={stats.processing ?? 0} />
          <StatChip label="Failed" value={stats.failed ?? 0} tone="red" />
          <StatChip label="Completed" value={stats.completed ?? 0} tone="emerald" />
        </div>
      ) : null}
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <StaticSelect
          className="rounded border border-slate-200 px-2 py-1 text-sm"
          value={statusFilter}
          onChange={onStatusChange}
          options={['active', 'pending', 'processing', 'failed', 'completed', 'cancelled', 'all'].map((s) => ({
            value: s,
            label: s,
          }))}
        />
        <StaticSelect
          className="rounded border border-slate-200 px-2 py-1 text-sm"
          value={jobTypeFilter}
          onChange={onJobTypeChange}
          options={[
            { value: 'all', label: 'All job types' },
            ...JOB_TYPES.map((t) => ({ value: t, label: t })),
          ]}
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Scheduled</th>
              <th className="px-4 py-3">Farmer</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attempts</th>
              {canWrite ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-xs whitespace-nowrap">
                  {new Date(j.scheduled_at).toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{j.farmerName}</p>
                  <p className="text-xs text-slate-500">{j.farmerPhone}</p>
                </td>
                <td className="px-4 py-3 text-xs">{j.job_type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs capitalize ${statusClass(j.status)}`}>
                    {j.status}
                  </span>
                  {j.last_error ? (
                    <p className="mt-1 max-w-xs truncate text-xs text-red-600" title={j.last_error}>
                      {j.last_error}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">{j.attempts}</td>
                {canWrite ? (
                  <td className="px-4 py-3">
                    {j.status === 'pending' || j.status === 'processing' ? (
                      <button
                        type="button"
                        className="mr-2 text-xs text-red-600 hover:underline"
                        onClick={() => cancel(j.id)}
                      >
                        Cancel
                      </button>
                    ) : null}
                    {j.status === 'failed' || j.status === 'cancelled' || j.status === 'completed' ? (
                      <button
                        type="button"
                        className="text-xs text-emerald-700 hover:underline"
                        onClick={() => retry(j.id)}
                      >
                        Retry
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No jobs in this filter.</p>
        ) : null}
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'amber' | 'red' | 'emerald';
}) {
  const cls =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-900'
      : tone === 'red'
        ? 'bg-red-50 text-red-800'
        : tone === 'emerald'
          ? 'bg-emerald-50 text-emerald-800'
          : 'bg-slate-100 text-slate-700';
  return (
    <span className={`rounded-lg px-2 py-1 ${cls}`}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

function statusClass(s: string) {
  if (s === 'failed') return 'bg-red-100 text-red-800';
  if (s === 'completed') return 'bg-emerald-100 text-emerald-800';
  if (s === 'pending') return 'bg-amber-100 text-amber-900';
  if (s === 'processing') return 'bg-blue-100 text-blue-800';
  return 'bg-slate-100 text-slate-700';
}
