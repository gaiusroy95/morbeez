import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  BROADCAST_API,
  CAMPAIGN_CATEGORIES,
  VARIABLE_CHIPS,
  previewAudience,
  type BroadcastAudience,
  type BroadcastCampaign,
} from '../../lib/broadcast-api';
import { paths, toPath } from '../../lib/routes';
import { BroadcastSubNav } from '../../components/broadcasts/BroadcastSubNav';
import { Alert, PageShell, ReadOnlyBanner, StaticSelect } from '../../components/ui';

const STEPS = [
  'Audience',
  'Category',
  'Message',
  'Variables',
  'Media',
  'Schedule',
  'Review',
] as const;

export function BroadcastCreatePage({ canWrite }: { canWrite: boolean }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reachCount, setReachCount] = useState<number | null>(null);
  const [messagePreview, setMessagePreview] = useState<{ title: string | null; body: string } | null>(
    null
  );

  const [name, setName] = useState('');
  const [category, setCategory] = useState('custom_message');
  const [audience, setAudience] = useState<BroadcastAudience>({
    cropTypes: ['ginger'],
    districts: [],
    languages: [],
    broadcastTags: [],
  });
  const [messageTitle, setMessageTitle] = useState('');
  const [messageBody, setMessageBody] = useState(
    'Hello {{FarmerName}}, your {{Crop}} crop at {{DAP}} DAP in {{Village}} needs your attention. — Morbeez'
  );
  const [mediaUrls, setMediaUrls] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  const ensureCampaign = useCallback(async () => {
    if (campaignId) return campaignId;
    const d = await api<{ ok: boolean; campaign: BroadcastCampaign }>(`${BROADCAST_API}/campaigns`, {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim() || 'Untitled campaign',
        category,
        audienceJson: audience,
        messageTitle: messageTitle || undefined,
        messageBody,
        mediaUrls: mediaUrls
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean),
      }),
    });
    setCampaignId(d.campaign.id);
    return d.campaign.id;
  }, [audience, campaignId, category, messageBody, messageTitle, mediaUrls, name]);

  useEffect(() => {
    if (step !== 0) return;
    const t = setTimeout(() => {
      previewAudience(audience)
        .then((d) => setReachCount(d.count))
        .catch(() => setReachCount(null));
    }, 400);
    return () => clearTimeout(t);
  }, [audience, step]);

  async function saveDraft() {
    setSaving(true);
    setError('');
    try {
      const id = await ensureCampaign();
      await api(`${BROADCAST_API}/campaigns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim() || 'Untitled campaign',
          category,
          audienceJson: audience,
          messageTitle,
          messageBody,
          mediaUrls: mediaUrls
            .split('\n')
            .map((u) => u.trim())
            .filter(Boolean),
        }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function loadMessagePreview() {
    const id = await ensureCampaign();
    const d = await api<{ ok: boolean; preview: { title: string | null; body: string } }>(
      `${BROADCAST_API}/campaigns/${id}/preview-message`,
      { method: 'POST', body: JSON.stringify({}) }
    );
    setMessagePreview(d.preview);
  }

  async function finishSend() {
    if (!canWrite) return;
    setSaving(true);
    setError('');
    try {
      const id = await ensureCampaign();
      await saveDraft();
      if (scheduleMode === 'later' && scheduledAt) {
        await api(`${BROADCAST_API}/campaigns/${id}/schedule`, {
          method: 'POST',
          body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString() }),
        });
      } else {
        await api(`${BROADCAST_API}/campaigns/${id}/send`, {
          method: 'POST',
          body: JSON.stringify({ dryRun: false }),
        });
      }
      navigate(toPath(paths.broadcastsSent));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSaving(false);
    }
  }

  function insertVariable(v: string) {
    setMessageBody((b) => `${b}${b.endsWith(' ') || !b ? '' : ' '}${v}`);
  }

  if (!canWrite) {
    return (
      <div>
        <BroadcastSubNav />
        <ReadOnlyBanner />
      </div>
    );
  }

  return (
    <div>
      <BroadcastSubNav />
      <h1 className="text-lg font-semibold text-slate-900">Create broadcast</h1>
      <ol className="my-4 flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${
              i === step ? 'bg-emerald-600 text-white' : i < step ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100'
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <PageShell loading={false} error={null}>
        {step === 0 ? (
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-sm">
              Campaign name
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Crop types (comma-separated)
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={(audience.cropTypes ?? []).join(', ')}
                onChange={(e) =>
                  setAudience((a) => ({
                    ...a,
                    cropTypes: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </label>
            <label className="block text-sm">
              Districts (comma-separated, optional)
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={(audience.districts ?? []).join(', ')}
                onChange={(e) =>
                  setAudience((a) => ({
                    ...a,
                    districts: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </label>
            <label className="block text-sm">
              Broadcast tags (comma-separated, optional)
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={(audience.broadcastTags ?? []).join(', ')}
                onChange={(e) =>
                  setAudience((a) => ({
                    ...a,
                    broadcastTags: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </label>
            <p className="text-sm font-medium text-emerald-700">
              Estimated reach: {reachCount != null ? reachCount.toLocaleString('en-IN') : '…'} farmers
            </p>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-sm">
              Category
              <StaticSelect
                className="mt-1 w-full max-w-md rounded border border-slate-200 px-2 py-1.5"
                value={category}
                onChange={setCategory}
                options={CAMPAIGN_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              />
            </label>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-sm">
              Title (optional)
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                value={messageTitle}
                onChange={(e) => setMessageTitle(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Message body
              <textarea
                className="mt-1 min-h-[160px] w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-sm"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
              />
            </label>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Insert dynamic variables:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {VARIABLE_CHIPS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono hover:bg-emerald-100"
                  onClick={() => insertVariable(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              onClick={() => void loadMessagePreview()}
            >
              Preview for sample farmer
            </button>
            {messagePreview ? (
              <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm">
                {messagePreview.title ? `*${messagePreview.title}*\n\n` : ''}
                {messagePreview.body}
              </pre>
            ) : null}
          </section>
        ) : null}

        {step === 4 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-sm">
              Media URLs (one per line — image/PDF in Supabase storage)
              <textarea
                className="mt-1 min-h-[100px] w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={mediaUrls}
                onChange={(e) => setMediaUrls(e.target.value)}
                placeholder="https://…"
              />
            </label>
          </section>
        ) : null}

        {step === 5 ? (
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={scheduleMode === 'now'}
                onChange={() => setScheduleMode('now')}
              />
              Send now
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={scheduleMode === 'later'}
                onChange={() => setScheduleMode('later')}
              />
              Schedule (IST)
            </label>
            {scheduleMode === 'later' ? (
              <input
                type="datetime-local"
                className="rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            ) : null}
          </section>
        ) : null}

        {step === 6 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p>
              <strong>Name:</strong> {name || 'Untitled'}
            </p>
            <p>
              <strong>Category:</strong> {category}
            </p>
            <p>
              <strong>Reach:</strong> {reachCount ?? '—'} farmers
            </p>
            <p>
              <strong>Schedule:</strong>{' '}
              {scheduleMode === 'now' ? 'Send immediately' : scheduledAt || 'Not set'}
            </p>
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-slate-50 p-3 whitespace-pre-wrap">
              {messageTitle ? `*${messageTitle}*\n\n` : ''}
              {messageBody}
            </pre>
          </section>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {step > 0 ? (
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white"
              onClick={async () => {
                await saveDraft();
                setStep((s) => s + 1);
              }}
              disabled={saving}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white"
              onClick={() => void finishSend()}
              disabled={saving}
            >
              {scheduleMode === 'later' ? 'Schedule broadcast' : 'Send broadcast'}
            </button>
          )}
        </div>
      </PageShell>
    </div>
  );
}
