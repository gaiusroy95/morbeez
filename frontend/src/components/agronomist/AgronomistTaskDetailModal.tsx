import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../Modal';
import { Alert, Btn, Loading } from '../ui';

export type AgronomistTaskRow = {
  id: string;
  title: string;
  issue?: string | null;
  priority?: string;
  status?: string;
  dueLabel?: string;
  farmerName?: string;
  blockName?: string | null;
  cropName?: string | null;
  assignedAgronomist?: string | null;
  createdBy?: string | null;
};

type TaskComment = {
  id: string;
  authorRole: string;
  authorName: string | null;
  authorEmail: string;
  body: string;
  atLabel: string;
};

type TaskDetail = AgronomistTaskRow & {
  notes?: string | null;
  taskCategory?: string;
  taskType?: string;
  dueAt?: string | null;
  farmerPhone?: string | null;
  leadId?: string | null;
  farmerId?: string | null;
};

type Props = {
  taskId: string | null;
  apiBase: 'telecaller' | 'agronomist';
  canWrite: boolean;
  onClose: () => void;
  onUpdated?: () => void;
};

const telecallerBase = '/morbeez-staff/api/v1/os/telecaller';
const agronomistBase = '/morbeez-staff/api/v1/os/agronomist';

function roleLabel(role: string): string {
  if (role === 'agronomist') return 'Agronomist';
  if (role === 'telecaller') return 'Telecaller';
  return role;
}

export function AgronomistTaskDetailModal({ taskId, apiBase, canWrite, onClose, onUpdated }: Props) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError('');
    try {
      const base = apiBase === 'agronomist' ? agronomistBase : telecallerBase;
      const path =
        apiBase === 'agronomist' ? `${base}/operations/tasks/${taskId}` : `${base}/tasks/${taskId}`;
      const data = await api<{ ok: boolean; task: TaskDetail; comments: TaskComment[] }>(path);
      setTask(data.task);
      setComments(data.comments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [taskId, apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postComment() {
    if (!taskId || !comment.trim() || !canWrite) return;
    setSaving(true);
    setError('');
    try {
      const base = apiBase === 'agronomist' ? agronomistBase : telecallerBase;
      const path =
        apiBase === 'agronomist'
          ? `${base}/operations/tasks/${taskId}/comments`
          : `${base}/tasks/${taskId}/comments`;
      await api(path, {
        method: 'POST',
        body: JSON.stringify({
          body: comment.trim(),
          authorRole: apiBase === 'agronomist' ? 'agronomist' : 'telecaller',
        }),
      });
      setComment('');
      await load();
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post comment');
    } finally {
      setSaving(false);
    }
  }

  async function completeTask() {
    if (!taskId || !canWrite) return;
    setSaving(true);
    try {
      const base = apiBase === 'agronomist' ? agronomistBase : telecallerBase;
      const path =
        apiBase === 'agronomist'
          ? `${base}/operations/tasks/${taskId}/complete`
          : `${telecallerBase}/tasks/${taskId}/complete`;
      await api(path, { method: 'PATCH', body: '{}' });
      onUpdated?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete task');
    } finally {
      setSaving(false);
    }
  }

  if (!taskId) return null;

  return (
    <Modal title={task?.title ?? 'Task details'} onClose={onClose} wide>
      {error ? <Alert tone="error" className="mb-3">{error}</Alert> : null}
      {loading ? <Loading label="Loading task…" /> : null}
      {!loading && task ? (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <div><span className="text-ink-muted">Farmer</span><div className="font-medium">{task.farmerName ?? '—'}</div></div>
            <div><span className="text-ink-muted">Priority</span><div className="font-medium capitalize">{task.priority ?? 'medium'}</div></div>
            <div><span className="text-ink-muted">Block</span><div>{task.blockName ?? '—'}{task.cropName ? ` (${task.cropName})` : ''}</div></div>
            <div><span className="text-ink-muted">Due</span><div>{task.dueLabel ?? '—'}</div></div>
            <div><span className="text-ink-muted">Status</span><div className="capitalize">{task.status ?? 'pending'}</div></div>
            <div><span className="text-ink-muted">Assigned agronomist</span><div>{task.assignedAgronomist ?? '—'}</div></div>
          </div>
          {task.issue ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Issue</p>
              <p className="text-sm">{task.issue}</p>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Discussion</p>
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border bg-surface-subtle p-3">
              {comments.length === 0 ? (
                <p className="text-sm text-ink-muted">No comments yet — start the thread.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-md bg-surface-elevated p-2 shadow-sm">
                    <p className="text-xs font-semibold text-green-800">
                      {c.authorName ?? c.authorEmail}{' '}
                      <span className="font-normal text-ink-muted">· {roleLabel(c.authorRole)} · {c.atLabel}</span>
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))
              )}
            </div>
            {canWrite && task.status === 'pending' ? (
              <div className="mt-3 space-y-2">
                <textarea
                  className="w-full rounded-md border border-border-strong px-3 py-2 text-sm"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Reply to telecaller or agronomist…"
                />
                <div className="flex flex-wrap gap-2">
                  <Btn label={saving ? 'Sending…' : 'Send comment'} onClick={() => void postComment()} disabled={saving || !comment.trim()} />
                  <Btn label="Mark complete" variant="secondary" onClick={() => void completeTask()} disabled={saving} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
