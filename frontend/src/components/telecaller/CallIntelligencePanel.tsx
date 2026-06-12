import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { api } from '../../lib/api';
import { Alert, Btn, StaticSelect } from '../ui';

const base = '/morbeez-staff/api/v1/os/telecaller';

type CallRow = {
  id: string;
  processing_status: string;
  transcript_status: string;
  ai_summary: string | null;
  ai_summary_json: Record<string, unknown> | null;
  qc_score: number | null;
  qc_flagged: boolean;
  qc_flag_reason: string | null;
  suggested_whatsapp_reply: string | null;
  suggested_stage: string | null;
  processing_error: string | null;
  diagnosis_session_id: string | null;
};

const OUTCOMES = [
  { value: 'connected', label: 'Connected' },
  { value: 'answered', label: 'Answered' },
  { value: 'callback', label: 'Callback' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Busy' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CallIntelligencePanel({
  leadId,
  farmerPhone,
  canWrite,
  onConfirmed,
}: {
  leadId: string;
  farmerPhone: string | null;
  canWrite: boolean;
  onConfirmed?: () => void;
}) {
  const [outcome, setOutcome] = useState('connected');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [call, setCall] = useState<CallRow | null>(null);
  const [diagnosis, setDiagnosis] = useState<Record<string, unknown> | null>(null);
  const [exotelBusy, setExotelBusy] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollCall = useCallback(
    (callId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await api<{ ok: boolean; call: CallRow }>(`${base}/calls/${callId}`);
          setCall(res.call);
          const status = res.call.processing_status;
          if (status === 'completed' || status === 'confirmed' || status === 'failed') {
            stopPolling();
          }
        } catch {
          stopPolling();
        }
      }, 2500);
    },
    [stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  async function uploadAudio(base64: string, mimeType: string, filename: string, provider: 'app_upload' | 'voice_note') {
    if (!canWrite) return;
    setUploading(true);
    setError('');
    setDiagnosis(null);
    try {
      const res = await api<{ ok: boolean; call: CallRow }>(`${base}/leads/${leadId}/calls/upload`, {
        method: 'POST',
        body: JSON.stringify({
          audioBase64: base64,
          mimeType,
          filename,
          outcome,
          durationSeconds,
          recordingProvider: provider,
        }),
      });
      setCall(res.call);
      pollCall(String(res.call.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    await uploadAudio(base64, file.type || 'audio/m4a', file.name, 'app_upload');
    e.target.value = '';
  }

  async function toggleVoiceNote() {
    if (!canWrite) return;
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const base64 = await fileToBase64(new File([blob], 'voice-note.webm', { type: blob.type }));
        await uploadAudio(base64, blob.type, 'voice-note.webm', 'voice_note');
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone access denied');
    }
  }

  async function confirmSummary() {
    if (!call?.id) return;
    try {
      await api(`${base}/calls/${call.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ acceptStage: true, stage: call.suggested_stage ?? undefined }),
      });
      setCall((prev) => (prev ? { ...prev, processing_status: 'confirmed' } : prev));
      onConfirmed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed');
    }
  }

  async function runDiagnosis() {
    if (!call?.id) return;
    try {
      const res = await api<{ ok: boolean; diagnosis: Record<string, unknown> }>(
        `${base}/calls/${call.id}/diagnosis`,
        { method: 'POST', body: '{}' }
      );
      setDiagnosis(res.diagnosis);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Diagnosis failed');
    }
  }

  async function clickToCall() {
    if (!canWrite || !farmerPhone) return;
    setExotelBusy(true);
    setError('');
    try {
      const res = await api<{ ok: boolean; callLogId: string }>(`${base}/exotel/click-to-call`, {
        method: 'POST',
        body: JSON.stringify({ leadId, farmerPhone }),
      });
      pollCall(res.callLogId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Exotel call failed');
    } finally {
      setExotelBusy(false);
    }
  }

  const summaryJson = call?.ai_summary_json as {
    bullets?: string[];
    nextAction?: string;
    interestedInSoilTest?: boolean;
  } | null;
  const processing = call?.processing_status === 'processing' || call?.processing_status === 'pending';

  return (
    <article className="tc-sidebar-card">
      <h3>Call intelligence</h3>
      {error ? <Alert tone="error">{error}</Alert> : null}

      {canWrite ? (
        <div className="tc-call-intel-actions">
          <StaticSelect
            className="tc-stage-select"
            value={outcome}
            onChange={setOutcome}
            options={OUTCOMES}
          />
          <label className="tc-call-duration">
            Duration (sec)
            <input
              type="number"
              min={0}
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value) || 0)}
            />
          </label>
          <div className="tc-call-upload-row">
            <label className="tc-note-save-btn tc-call-upload-label">
              Upload recording
              <input type="file" accept="audio/*" hidden onChange={(e) => void onFileChange(e)} />
            </label>
            <Btn type="button" variant="secondary" onClick={() => void toggleVoiceNote()} disabled={uploading}>
              {recording ? 'Stop & upload' : 'Record voice note'}
            </Btn>
            {farmerPhone ? (
              <Btn type="button" variant="secondary" onClick={() => void clickToCall()} disabled={exotelBusy}>
                {exotelBusy ? 'Calling…' : 'Exotel call'}
              </Btn>
            ) : null}
          </div>
        </div>
      ) : null}

      {uploading || processing ? (
        <p className="tc-empty-row">Processing call — transcribing and summarizing…</p>
      ) : null}

      {call?.processing_status === 'failed' ? (
        <Alert tone="error">{call.processing_error ?? 'Processing failed'}</Alert>
      ) : null}

      {call?.ai_summary ? (
        <div className="tc-call-summary">
          <p className="tc-call-summary-label">AI summary</p>
          {summaryJson?.bullets?.length ? (
            <ul className="tc-action-list">
              {summaryJson.bullets.map((b) => (
                <li key={b}>
                  <strong>{b}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>{call.ai_summary}</p>
          )}
          {call.qc_score != null ? (
            <p className="tc-call-qc">
              QC score: <strong>{call.qc_score}</strong>
              {call.qc_flagged ? ` — flagged: ${call.qc_flag_reason ?? 'review needed'}` : null}
            </p>
          ) : null}
          {call.suggested_whatsapp_reply ? (
            <div className="tc-call-wa-suggest">
              <span>Suggested WhatsApp follow-up</span>
              <p>{call.suggested_whatsapp_reply}</p>
              <button
                type="button"
                className="tc-inline-link"
                onClick={() => void navigator.clipboard.writeText(call.suggested_whatsapp_reply ?? '')}
              >
                Copy
              </button>
            </div>
          ) : null}
          {summaryJson?.interestedInSoilTest ? (
            <p className="tc-call-soil-hint">Soil test interest detected — task may have been created.</p>
          ) : null}
          {canWrite && call.processing_status === 'completed' ? (
            <div className="tc-call-confirm-row">
              <Btn type="button" variant="primary" onClick={() => void confirmSummary()}>
                Confirm summary
              </Btn>
              <Btn type="button" variant="secondary" onClick={() => void runDiagnosis()}>
                Run diagnosis
              </Btn>
            </div>
          ) : null}
        </div>
      ) : null}

      {diagnosis ? (
        <div className="tc-call-diagnosis">
          <p className="tc-call-summary-label">Diagnosis</p>
          <p>
            <strong>{String(diagnosis.diagnosis ?? diagnosis.primaryDiagnosis ?? '—')}</strong>
          </p>
          {diagnosis.confidence != null ? (
            <p>Confidence: {Math.round(Number(diagnosis.confidence) * 100)}%</p>
          ) : null}
          {diagnosis.recommendation ? <p>{String(diagnosis.recommendation)}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
