import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  copyTemplateToAll,
  duplicateTemplate,
  fetchTemplateDetail,
  renderPreview,
  saveTemplateBundle,
  TEMPLATE_CATEGORIES,
  TEMPLATE_LANGUAGES,
  TEMPLATE_VARIABLES,
  translateTemplate,
  type GroupedLanguageTemplate,
  type TemplateLanguage,
} from '../../lib/language-templates-api';
import { paths, toPath } from '../../lib/routes';
import { Alert, PageShell, ReadOnlyBanner, StaticSelect } from '../ui';

const STATUS_OPTIONS = [
  'draft',
  'in_translation',
  'under_review',
  'approved',
  'archived',
] as const;

export function LanguageTemplateEditorPage({ canWrite }: { canWrite: boolean }) {
  const { templateKey = '' } = useParams<{ templateKey: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<GroupedLanguageTemplate | null>(null);
  const [activeLang, setActiveLang] = useState<TemplateLanguage>('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState('general');
  const [status, setStatus] = useState('draft');
  const [channel, setChannel] = useState('session');
  const [metaName, setMetaName] = useState('');

  const load = useCallback(async () => {
    if (!templateKey) return;
    setLoading(true);
    setError('');
    try {
      const d = await fetchTemplateDetail(templateKey);
      setTemplate(d.template);
      setDisplayName(d.template.displayName);
      setCategory(d.template.category);
      setStatus(d.template.status);
      setChannel(d.template.channel);
      setMetaName(d.template.metaTemplateName ?? '');
      setBodyDraft(d.template.languages[activeLang]?.bodyText ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [templateKey, activeLang]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (template) {
      setBodyDraft(template.languages[activeLang]?.bodyText ?? '');
    }
  }, [activeLang, template]);

  const preview = useMemo(() => renderPreview(bodyDraft), [bodyDraft]);
  const completion = template?.completionRate ?? 0;

  async function save() {
    if (!templateKey || !canWrite) return;
    setSaving(true);
    setError('');
    try {
      const d = await saveTemplateBundle(templateKey, {
        displayName,
        category,
        channel,
        metaTemplateName: metaName || null,
        status,
        languages: {
          [activeLang]: { bodyText: bodyDraft },
        },
      });
      setTemplate(d.template);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function insertVariable(key: string) {
    setBodyDraft((b) => `${b}${b.endsWith(' ') || !b ? '' : ' '}{{${key}}}`);
  }

  async function runTranslate(target: TemplateLanguage) {
    if (!templateKey) return;
    setSaving(true);
    try {
      const d = await translateTemplate(templateKey, [target]);
      setTemplate(d.template);
      setBodyDraft(d.template.languages[target]?.bodyText ?? '');
      setActiveLang(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translate failed');
    } finally {
      setSaving(false);
    }
  }

  async function runCopyAll() {
    if (!templateKey) return;
    setSaving(true);
    try {
      const d = await copyTemplateToAll(templateKey);
      setTemplate(d.template);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Copy failed');
    } finally {
      setSaving(false);
    }
  }

  async function runDuplicate() {
    if (!templateKey) return;
    const newKey = `${templateKey}_copy_${Date.now().toString(36)}`;
    const d = await duplicateTemplate(templateKey, newKey);
    navigate(toPath(paths.operationsLanguageTemplate.replace(':templateKey', d.template.templateKey)));
  }

  const timeline = [
    { label: 'Created', at: template?.workflowJson?.created },
    { label: 'In Translation', at: template?.workflowJson?.in_translation },
    { label: 'Under Review', at: template?.workflowJson?.under_review },
    { label: 'Approved', at: template?.workflowJson?.approved },
  ];

  return (
    <div>
      <Link to={toPath(paths.operations)} className="text-sm text-emerald-700 hover:underline">
        ← Back to Operations
      </Link>
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <PageShell loading={loading} error={null}>
        {template ? (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <input
                  className="text-xl font-semibold text-slate-900 border-0 border-b border-transparent focus:border-emerald-500 bg-transparent"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  readOnly={!canWrite}
                />
                <p className="mt-1 text-sm text-slate-500">
                  {templateKey} · Category: {category} · Channel: {channel}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium capitalize text-emerald-800">
                  {status.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-semibold">{completion}% translated</span>
                {canWrite ? (
                  <>
                    <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => void runDuplicate()}>
                      Duplicate
                    </button>
                    <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white" onClick={() => void save()} disabled={saving}>
                      Save template
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
              {TEMPLATE_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setActiveLang(lang.code)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    activeLang === lang.code ? 'bg-emerald-600 text-white' : 'bg-slate-100'
                  }`}
                >
                  {lang.label}{' '}
                  {template.languageComplete?.[lang.code] ? '✓' : '✗'}
                </button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                {canWrite ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded border px-3 py-1 text-xs" onClick={() => void runCopyAll()}>
                      Copy to all languages
                    </button>
                    {TEMPLATE_LANGUAGES.filter((l) => l.code !== activeLang).map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        className="rounded border px-3 py-1 text-xs"
                        onClick={() => void runTranslate(l.code)}
                      >
                        AI Translate → {l.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <label className="block text-sm font-medium">Template message ({activeLang.toUpperCase()})</label>
                <textarea
                  className="min-h-[200px] w-full rounded-xl border border-slate-200 p-3 font-mono text-sm"
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                  readOnly={!canWrite}
                  maxLength={1024}
                />
                <p className="text-xs text-slate-500">{bodyDraft.length} / 1024 characters</p>
                <div className="flex flex-wrap gap-2">
                  {canWrite ? (
                    <>
                      <StaticSelect
                        className="rounded border px-2 py-1 text-sm"
                        value={category}
                        onChange={setCategory}
                        options={TEMPLATE_CATEGORIES.map((c) => c)}
                      />
                      <StaticSelect
                        className="rounded border px-2 py-1 text-sm"
                        value={status}
                        onChange={setStatus}
                        options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                      />
                    </>
                  ) : null}
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-medium">Available variables</h3>
                  <ul className="mt-2 space-y-1">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <li key={v.key}>
                        <button
                          type="button"
                          className="w-full rounded px-2 py-1 text-left text-xs hover:bg-emerald-50"
                          onClick={() => insertVariable(v.key)}
                          disabled={!canWrite}
                        >
                          {v.label} <code className="text-slate-500">{`{{${v.key}}}`}</code>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border bg-[#e5ddd5] p-4">
                  <p className="mb-2 text-xs font-medium text-slate-600">Preview ({activeLang.toUpperCase()})</p>
                  <div className="max-w-[280px] rounded-lg bg-white px-3 py-2 text-sm shadow whitespace-pre-wrap">
                    {preview || '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-xl border bg-white p-4">
              <h3 className="text-sm font-medium">Template status</h3>
              <ol className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
                {timeline.map((step) => (
                  <li key={step.label} className={step.at ? 'text-emerald-700' : ''}>
                    {step.at ? '✓' : '○'} {step.label}
                    {step.at ? (
                      <span className="block text-slate-400">
                        {new Date(step.at).toLocaleString('en-IN')}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : null}
      </PageShell>
    </div>
  );
}
