import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSyncConsoleSearch } from '../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../lib/console-page-search';
import { matchesSearch } from '../lib/search-filter';
import { Alert, HubTabs, Loading, ReadOnlyBanner } from '../components/ui';
import { FarmerFeedbackPanel } from '../components/agronomist/FarmerFeedbackPanel';
import { CaseReviewPanel } from '../components/agronomist/CaseReviewPanel';
import { ImageReviewPanel } from '../components/agronomist/ImageReviewPanel';
import { OutcomeReviewPanel } from '../components/agronomist/OutcomeReviewPanel';
import { TrainingExportPanel } from '../components/agronomist/TrainingExportPanel';
import { RecommendationApprovalsWorkspace } from '../components/approvals/RecommendationApprovalsWorkspace';
import '../styles/approvals-workspace.css';
import { AgronomistIntelligenceBar } from '../components/agronomist/AgronomistIntelligenceBar';

const base = '/morbeez-staff/api/v1/os/agronomist';

type AgronomistHubTab =
  | 'case_review'
  | 'image_review'
  | 'outcome_review'
  | 'training_export'
  | 'queue'
  | 'approvals'
  | 'farmer_feedback';

const AGRONOMIST_HUB_TABS: Array<{ id: AgronomistHubTab; label: string }> = [
  { id: 'case_review', label: 'Case review' },
  { id: 'image_review', label: 'Image review' },
  { id: 'outcome_review', label: 'Outcome review' },
  { id: 'training_export', label: 'Training export' },
  { id: 'queue', label: 'Field findings' },
  { id: 'farmer_feedback', label: 'Farmer feedback' },
  { id: 'approvals', label: 'Approvals' },
];

type QueueItem = {
  finding: {
    id: string;
    farmerId: string;
    blockId: string | null;
    blockName: string;
    cropType: string;
    observations: string | null;
    diseasePest: string | null;
    diseaseTone: string;
    visitedAt: string;
    photoUrls?: string[];
  };
  farmer: { name: string | null; phone: string | null; preferredLanguage: string } | null;
  block: {
    id: string;
    name: string;
    cropType: string;
    plotLabel: string | null;
    dap: number | null;
  } | null;
  existingRecommendation: { id: string; status: string } | null;
};

type AiSuggestion = {
  sessionId: string;
  escalated: boolean;
  suggested: {
    issueDetected: string;
    recommendationText: string;
    dosage?: string;
    weatherWarning?: string;
    language: string;
    products: unknown[];
  };
  existingRecommendationId: string | null;
  advisory: { confidence: number; probableIssue: string };
};

export function AgronomistHubPage({ canWrite }: { canWrite: boolean }) {
  const { canSelfApprove } = useAuth();
  const [tab, setTab] = useState<AgronomistHubTab>('case_review');
  const [search, setSearch] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const searchDefaults = defaultsForPage('agronomist');
  useSyncConsoleSearch(
    search,
    setSearch,
    searchDefaults.placeholder ?? 'Search farmer, crop, issue…'
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiMeta, setAiMeta] = useState<{ sessionId?: string; confidence?: number } | null>(null);

  const [form, setForm] = useState({
    recommendationId: '',
    findingId: '',
    farmerId: '',
    blockId: '',
    issueDetected: '',
    recommendationText: '',
    dosage: '',
    weatherWarning: '',
    language: 'en',
  });

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; items: QueueItem[] }>(`${base}/queue`);
      setQueue(d.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'queue') loadQueue();
  }, [tab, loadQueue]);

  function selectItem(item: QueueItem) {
    setSelectedId(item.finding.id);
    setAiMeta(null);
    setForm({
      recommendationId: item.existingRecommendation?.id ?? '',
      findingId: item.finding.id,
      farmerId: item.finding.farmerId,
      blockId: item.block?.id ?? item.finding.blockId ?? '',
      issueDetected: item.finding.diseasePest ?? '',
      recommendationText: '',
      dosage: '',
      weatherWarning: '',
      language: item.farmer?.preferredLanguage?.slice(0, 2) ?? 'en',
    });
  }

  async function runAiSuggest() {
    if (!selectedId || !canWrite) return;
    setAiLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean } & AiSuggestion>(
        `${base}/findings/${selectedId}/ai-suggest`,
        { method: 'POST', body: '{}' }
      );
      setAiMeta({ sessionId: d.sessionId, confidence: d.advisory.confidence });
      setForm((f) => ({
        ...f,
        recommendationId: d.existingRecommendationId ?? f.recommendationId,
        issueDetected: d.suggested.issueDetected,
        recommendationText: d.suggested.recommendationText,
        dosage: d.suggested.dosage ?? '',
        weatherWarning: d.suggested.weatherWarning ?? '',
        language: d.suggested.language,
      }));
      if (d.escalated) {
        setError('AI flagged for escalation — review carefully before submitting.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI suggestion failed');
    } finally {
      setAiLoading(false);
    }
  }

  async function saveDraft() {
    if (!canWrite || !form.findingId) return;
    setSaving(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; recommendation: { id: string } }>(`${base}/drafts`, {
        method: 'POST',
        body: JSON.stringify({
          findingId: form.findingId,
          farmerId: form.farmerId,
          blockId: form.blockId || undefined,
          recommendationId: form.recommendationId || undefined,
          aiSessionId: aiMeta?.sessionId,
          issueDetected: form.issueDetected || undefined,
          recommendationText: form.recommendationText,
          dosage: form.dosage || undefined,
          weatherWarning: form.weatherWarning || undefined,
          language: form.language,
        }),
      });
      setForm((f) => ({ ...f, recommendationId: d.recommendation.id }));
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function submitForApproval() {
    if (!canWrite || !form.recommendationId) {
      setError('Save draft first');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`${base}/recommendations/${form.recommendationId}/submit`, {
        method: 'POST',
        body: '{}',
      });
      setSelectedId(null);
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  }

  const filteredQueue = useMemo(
    () =>
      queue.filter((item) =>
        matchesSearch(
          search,
          item.farmer?.name,
          item.farmer?.phone,
          item.finding.cropType,
          item.finding.blockName,
          item.block?.plotLabel,
          item.finding.diseasePest,
          item.finding.observations
        )
      ),
    [queue, search]
  );

  const selected = filteredQueue.find((q) => q.finding.id === selectedId) ?? queue.find((q) => q.finding.id === selectedId);

  return (
    <div className="agronomist-hub">
      <p className="muted" style={{ marginBottom: 12 }}>
        Field findings → AI draft → review → Super Admin approval → WhatsApp
      </p>
      <AgronomistIntelligenceBar />
      {!canWrite ? <ReadOnlyBanner /> : null}
      {error ? (
        <Alert tone="error">
          <p>{error}</p>
          {error.includes('schema') || error.includes('migration') ? (
            <p className="mt-2 text-xs opacity-90">
              Run <code className="rounded bg-red-100/80 px-1">supabase db push</code> and restart the API.
            </p>
          ) : null}
        </Alert>
      ) : null}
      <HubTabs<AgronomistHubTab>
        tabs={AGRONOMIST_HUB_TABS}
        active={tab}
        onChange={(id) => setTab(id)}
      />
      {loading && tab === 'queue' ? <Loading /> : null}

      {tab === 'case_review' ? <CaseReviewPanel canWrite={canWrite} /> : null}

      {tab === 'image_review' ? <ImageReviewPanel canWrite={canWrite} /> : null}

      {tab === 'outcome_review' ? <OutcomeReviewPanel canWrite={canWrite} /> : null}
      {tab === 'training_export' ? <TrainingExportPanel canWrite={canWrite} /> : null}

      {tab === 'queue' && !loading ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            {queue.length === 0 ? (
              <p className="text-sm text-slate-500">No field findings awaiting review.</p>
            ) : null}
            {queue.length > 0 && filteredQueue.length === 0 ? (
              <p className="text-sm text-slate-500">No findings match your search.</p>
            ) : null}
            {filteredQueue.map((item) => (
              <button
                key={item.finding.id}
                type="button"
                onClick={() => selectItem(item)}
                className={`w-full rounded-xl border p-3 text-left text-sm ${
                  selectedId === item.finding.id
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="font-medium text-slate-900">
                  {item.farmer?.name ?? item.farmer?.phone ?? 'Farmer'}
                </p>
                <p className="text-xs text-slate-500">
                  {item.finding.cropType} · {item.block?.plotLabel ?? item.finding.blockName} ·{' '}
                  {new Date(item.finding.visitedAt).toLocaleDateString('en-IN')}
                </p>
                {item.finding.diseasePest ? (
                  <p className="mt-1 text-xs text-amber-800">{item.finding.diseasePest}</p>
                ) : null}
                {item.existingRecommendation ? (
                  <span className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    Draft in progress
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {!selected ? (
              <p className="text-sm text-slate-500">Select a field finding to review.</p>
            ) : (
              <>
                <h2 className="font-medium text-slate-900">Finding detail</h2>
                {Array.isArray(selected.finding.photoUrls) && selected.finding.photoUrls.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.finding.photoUrls.map((url, i) =>
                      typeof url === 'string' && url.startsWith('http') ? (
                        <a
                          key={`${url}-${i}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-lg border border-slate-200"
                        >
                          <img
                            src={url}
                            alt={`Field photo ${i + 1}`}
                            className="h-28 w-28 object-cover"
                          />
                        </a>
                      ) : null
                    )}
                  </div>
                ) : null}
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                  {selected.finding.observations ?? 'No observations recorded.'}
                </p>
                {canWrite ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={runAiSuggest}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {aiLoading ? 'Running AI…' : 'Generate AI suggestion'}
                    </button>
                    {aiMeta?.confidence != null ? (
                      <span className="self-center text-xs text-slate-500">
                        Confidence: {Math.round(aiMeta.confidence * 100)}%
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-6 space-y-3">
                  <label className="block text-sm">
                    <span className="text-slate-600">Issue detected</span>
                    <input
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                      value={form.issueDetected}
                      onChange={(e) => setForm((f) => ({ ...f, issueDetected: e.target.value }))}
                      disabled={!canWrite}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Recommendation (farmer-facing)</span>
                    <textarea
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                      rows={5}
                      value={form.recommendationText}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, recommendationText: e.target.value }))
                      }
                      disabled={!canWrite}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Dosage</span>
                    <textarea
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                      rows={2}
                      value={form.dosage}
                      onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
                      disabled={!canWrite}
                    />
                  </label>
                  {canWrite ? (
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        disabled={saving || !form.recommendationText.trim()}
                        onClick={saveDraft}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        Save draft
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={submitForApproval}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Submit for approval
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'farmer_feedback' ? <FarmerFeedbackPanel canWrite={canWrite} /> : null}

      {tab === 'approvals' ? (
        <div className="mt-4">
          <p className="muted" style={{ marginBottom: 12 }}>
            Your submitted recommendations — edit while pending, track who approved and when.
          </p>
          <RecommendationApprovalsWorkspace
            canWrite={canWrite}
            canApprove={canSelfApprove}
            mineOnly
          />
        </div>
      ) : null}
    </div>
  );
}
