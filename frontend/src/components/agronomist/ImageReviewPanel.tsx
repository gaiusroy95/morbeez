import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Alert, Loading } from '../ui';
import { DiagnosisLabelPicker } from './DiagnosisLabelPicker';
import { REVIEW_SEVERITIES, REVIEW_SEVERITY_LABELS } from '../../lib/ai-training-enums';
import type { ReviewSeverity } from '../../lib/ai-training-enums';
import '../../styles/image-review.css';

const base = '/morbeez-staff/api/v1/os/agronomist';

type CropImageItem = {
  id: string;
  farmerId: string;
  crop: string | null;
  dap: number | null;
  aiPrediction: string | null;
  aiConfidence: number | null;
  reviewStatus: string;
  imageUrl: string | null;
  createdAt: string;
  farmer: { name: string | null; phone: string | null; district: string | null } | null;
  block: { name: string; cropType: string } | null;
  symptoms: string[];
};

type CropImageDetail = {
  image: CropImageItem & {
    agronomistLabel: string | null;
    severity: ReviewSeverity | null;
    gpsRegion: string | null;
    source: string;
  };
  weather: {
    rainfallMm: number | null;
    humidityPct: number | null;
    temperatureC: number | null;
    locationLabel: string | null;
  } | null;
};

type ReviewAction = 'confirm_ai' | 'correct_ai' | 'skip' | 'exclude';

export function ImageReviewPanel({ canWrite }: { canWrite: boolean }) {
  const [items, setItems] = useState<CropImageItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CropImageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [label, setLabel] = useState('');
  const [severity, setSeverity] = useState<ReviewSeverity>('moderate');
  const [notes, setNotes] = useState('');
  const [showCorrect, setShowCorrect] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api<{ ok: boolean; items: CropImageItem[]; pendingCount: number }>(
        `${base}/crop-images?status=pending&limit=40`
      );
      setItems(r.items ?? []);
      setPendingCount(r.pendingCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load image queue');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const r = await api<{ ok: boolean } & CropImageDetail>(`${base}/crop-images/${id}`);
      setDetail({ image: r.image, weather: r.weather });
      setLabel(r.image.aiPrediction ?? '');
      setSeverity(r.image.severity ?? 'moderate');
      setNotes('');
      setShowCorrect(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load image');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!selectedId && items.length > 0) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const selectedIndex = useMemo(
    () => items.findIndex((i) => i.id === selectedId),
    [items, selectedId]
  );

  async function submitReview(action: ReviewAction, reviewNext = false) {
    if (!selectedId || !canWrite) return;
    setSaving(true);
    setError('');
    try {
      await api(`${base}/crop-images/${selectedId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          agronomistLabel:
            action === 'confirm_ai'
              ? detail?.image.aiPrediction ?? label
              : action === 'correct_ai'
                ? label
                : undefined,
          severity: action === 'skip' || action === 'exclude' ? undefined : severity,
          reviewNotes: notes || undefined,
        }),
      });

      const remaining = items.filter((i) => i.id !== selectedId);
      setItems(remaining);
      setPendingCount((c) => Math.max(0, c - 1));

      if (reviewNext && remaining.length > 0) {
        const nextIdx = Math.min(selectedIndex, remaining.length - 1);
        setSelectedId(remaining[nextIdx]?.id ?? null);
      } else if (remaining.length > 0) {
        setSelectedId(remaining[0]?.id ?? null);
      } else {
        setSelectedId(null);
        setDetail(null);
        await loadQueue();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setSaving(false);
    }
  }

  const img = detail?.image;
  const confPct =
    img?.aiConfidence != null ? Math.round(Number(img.aiConfidence) * 100) : null;

  return (
    <div className="ir-page mt-4">
      {error ? (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      ) : null}

      <div className="ir-shell">
        <aside className="ir-queue">
          <div className="ir-queue-head">
            <h3>
              Pending images
              {pendingCount > 0 ? (
                <span className="ir-pending-badge">{pendingCount}</span>
              ) : null}
            </h3>
          </div>
          <div className="ir-queue-list">
            {loading ? <Loading /> : null}
            {!loading && items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-ink-muted">No images awaiting review.</p>
            ) : null}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ir-queue-item${selectedId === item.id ? ' is-active' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="ir-queue-item-title">
                  {item.farmer?.name ?? item.farmer?.phone ?? 'Farmer'}
                </div>
                <div className="ir-queue-item-meta">
                  {item.crop ?? item.block?.cropType ?? 'Crop'} · DAP {item.dap ?? '—'} ·{' '}
                  {new Date(item.createdAt).toLocaleDateString('en-IN')}
                </div>
                {item.aiPrediction ? (
                  <div className="ir-queue-item-ai">
                    AI: {item.aiPrediction}
                    {item.aiConfidence != null
                      ? ` (${Math.round(item.aiConfidence * 100)}%)`
                      : ''}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <main className="ir-workspace">
          {!selectedId ? (
            <div className="ir-workspace-empty">
              Select an image from the queue to begin labeling.
            </div>
          ) : detailLoading ? (
            <div className="ir-workspace-empty">
              <Loading />
            </div>
          ) : img ? (
            <div className="ir-viewer-row">
              <div className="ir-image-panel">
                {img.imageUrl ? (
                  <img src={img.imageUrl} alt="Crop sample for review" />
                ) : (
                  <p className="text-sm text-ink-muted">Image unavailable</p>
                )}
                <div className="ir-image-meta">
                  {img.farmer?.district ? `${img.farmer.district} · ` : ''}
                  {img.gpsRegion ?? img.block?.name ?? ''}
                  {img.symptoms?.length ? ` · ${img.symptoms[0]}` : ''}
                </div>
              </div>

              <div className="ir-review-panel">
                <h4>Train visual disease AI</h4>

                <div className="ir-context-grid">
                  <div className="ir-context-item">
                    <span>Crop</span>
                    {img.crop ?? img.block?.cropType ?? '—'}
                  </div>
                  <div className="ir-context-item">
                    <span>DAP</span>
                    {img.dap ?? '—'}
                  </div>
                  {detail.weather ? (
                    <>
                      <div className="ir-context-item">
                        <span>Rainfall</span>
                        {detail.weather.rainfallMm ?? '—'} mm
                      </div>
                      <div className="ir-context-item">
                        <span>Humidity</span>
                        {detail.weather.humidityPct ?? '—'}%
                      </div>
                    </>
                  ) : null}
                </div>

                {img.aiPrediction ? (
                  <div className="ir-ai-prediction">
                    <div className="ir-ai-prediction-label">AI prediction</div>
                    <div className="ir-ai-prediction-value">{img.aiPrediction}</div>
                    {confPct != null ? (
                      <div className="ir-ai-confidence">{confPct}% confidence</div>
                    ) : null}
                  </div>
                ) : null}

                {(showCorrect || !img.aiPrediction) && canWrite ? (
                  <DiagnosisLabelPicker
                    label="Agronomist final label"
                    value={label}
                    cropType={img.crop ?? img.block?.cropType}
                    apiBase={base}
                    required={showCorrect}
                    onChange={setLabel}
                  />
                ) : null}

                {canWrite ? (
                  <>
                    <div className="ir-severity-row">
                      {REVIEW_SEVERITIES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`ir-severity-btn${severity === s ? ' is-active' : ''}`}
                          onClick={() => setSeverity(s)}
                        >
                          {REVIEW_SEVERITY_LABELS[s]}
                        </button>
                      ))}
                    </div>

                    <textarea
                      className="ir-notes"
                      placeholder="Notes for learning (optional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />

                    <div className="ir-action-row">
                      {img.aiPrediction ? (
                        <button
                          type="button"
                          className="ir-btn ir-btn-primary"
                          disabled={saving}
                          onClick={() => void submitReview('confirm_ai', true)}
                        >
                          Confirm AI &amp; next
                        </button>
                      ) : null}
                      {!showCorrect && img.aiPrediction ? (
                        <button
                          type="button"
                          className="ir-btn ir-btn-warn"
                          disabled={saving}
                          onClick={() => setShowCorrect(true)}
                        >
                          Correct AI
                        </button>
                      ) : null}
                      {showCorrect || !img.aiPrediction ? (
                        <button
                          type="button"
                          className="ir-btn ir-btn-primary"
                          disabled={saving || !label.trim()}
                          onClick={() => void submitReview('correct_ai', true)}
                        >
                          Save label &amp; next
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="ir-btn"
                        disabled={saving}
                        onClick={() => void submitReview('skip', true)}
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        className="ir-btn"
                        disabled={saving}
                        onClick={() => void submitReview('exclude', true)}
                      >
                        Exclude
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">Read-only — agronomist write access required.</p>
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
