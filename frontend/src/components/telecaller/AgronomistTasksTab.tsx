import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Btn } from '../ui';
import {
  AgronomistTaskDetailModal,
  type AgronomistTaskRow,
} from '../agronomist/AgronomistTaskDetailModal';

const base = '/morbeez-staff/api/v1/os/telecaller';

type AgronomistOption = { id: string; name: string; email: string };

type Props = {
  leadId: string;
  canWrite: boolean;
  refreshKey: number;
  blocks?: Array<{ id: string; name: string; cropName?: string }>;
};

const TASK_CATEGORIES = [
  { id: 'call_farmer', label: 'Call farmer' },
  { id: 'visit_request', label: 'Visit request' },
  { id: 'recommendation', label: 'Recommendation' },
  { id: 'soil_test_review', label: 'Soil test review' },
  { id: 'disease_review', label: 'Disease review' },
  { id: 'other', label: 'Other' },
] as const;

const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'critical', label: 'Critical' },
] as const;

function priorityClass(priority?: string): string {
  if (priority === 'critical' || priority === 'high') return 'tc-agro-task-priority tc-agro-task-priority--high';
  if (priority === 'low') return 'tc-agro-task-priority tc-agro-task-priority--low';
  return 'tc-agro-task-priority';
}

export function AgronomistTasksTab({ leadId, canWrite, refreshKey, blocks = [] }: Props) {
  const [tasks, setTasks] = useState<AgronomistTaskRow[]>([]);
  const [agronomists, setAgronomists] = useState<AgronomistOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [issue, setIssue] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState('medium');
  const [taskCategory, setTaskCategory] = useState('other');
  const [assignedAgronomist, setAssignedAgronomist] = useState('');
  const [blockId, setBlockId] = useState('');
  const [initialComment, setInitialComment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [taskRes, agroRes] = await Promise.all([
        api<{ ok: boolean; tasks: AgronomistTaskRow[] }>(`${base}/leads/${leadId}/agronomist-tasks`),
        api<{ ok: boolean; agronomists: AgronomistOption[] }>(`${base}/agronomists`).catch(() => ({
          ok: true,
          agronomists: [],
        })),
      ]);
      setTasks(taskRes.tasks ?? []);
      setAgronomists(agroRes.agronomists ?? []);
      if (!assignedAgronomist && agroRes.agronomists?.[0]?.email) {
        setAssignedAgronomist(agroRes.agronomists[0].email);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agronomist tasks');
    } finally {
      setLoading(false);
    }
  }, [leadId, assignedAgronomist]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function createTask() {
    if (!title.trim() || !assignedAgronomist) {
      setError('Title and assigned agronomist are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`${base}/leads/${leadId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          issueDescription: issue.trim() || undefined,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          priority,
          taskCategory,
          assignedAgronomist,
          blockId: blockId || undefined,
          taskType: taskCategory === 'visit_request' ? 'visit' : 'other',
          initialComment: initialComment.trim() || undefined,
          notes: issue.trim() || undefined,
        }),
      });
      setShowForm(false);
      setTitle('');
      setIssue('');
      setInitialComment('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create task');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="tc-bl-empty">Loading agronomist tasks…</p>;

  return (
    <div className="tc-agro-tasks-tab">
      {error ? <p className="tc-bl-error">{error}</p> : null}

      <div className="tc-bl-panel-head">
        <h4>Agronomist tasks</h4>
        {canWrite ? (
          <button type="button" className="tc-bl-btn-primary" onClick={() => setShowForm((v) => !v)}>
            + New task
          </button>
        ) : null}
      </div>

      {showForm && canWrite ? (
        <div className="tc-agro-task-form">
          <div className="tc-agro-task-form-grid">
            <label>
              Task type
              <select value={taskCategory} onChange={(e) => setTaskCategory(e.target.value)}>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </label>
            <label>
              Assign agronomist
              <select value={assignedAgronomist} onChange={(e) => setAssignedAgronomist(e.target.value)}>
                {agronomists.map((a) => (
                  <option key={a.id} value={a.email}>{a.name}</option>
                ))}
              </select>
            </label>
            {blocks.length > 0 ? (
              <label>
                Block
                <select value={blockId} onChange={(e) => setBlockId(e.target.value)}>
                  <option value="">Any block</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="tc-agro-task-form-span2">
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Yellowing leaves — Block A" />
            </label>
            <label className="tc-agro-task-form-span2">
              Issue / description
              <textarea rows={2} value={issue} onChange={(e) => setIssue(e.target.value)} />
            </label>
            <label>
              Due date
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </label>
            <label className="tc-agro-task-form-span2">
              Opening comment
              <textarea rows={2} value={initialComment} onChange={(e) => setInitialComment(e.target.value)} placeholder="Farmer reports yellowing increasing." />
            </label>
          </div>
          <div className="tc-agro-task-form-actions">
            <Btn label="Cancel" variant="secondary" onClick={() => setShowForm(false)} />
            <Btn label={saving ? 'Creating…' : 'Create task'} onClick={() => void createTask()} disabled={saving} />
          </div>
        </div>
      ) : null}

      <div className="tc-agro-task-cards">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            className="tc-agro-task-card"
            onClick={() => setSelectedTaskId(task.id)}
          >
            <div className="tc-agro-task-card-top">
              <span className={priorityClass(task.priority)}>{task.priority ?? 'medium'}</span>
              <span className="tc-agro-task-status">{task.status ?? 'pending'}</span>
            </div>
            <p className="tc-agro-task-title">{task.title}</p>
            {task.issue ? <p className="tc-agro-task-issue">{task.issue}</p> : null}
            <p className="tc-agro-task-meta">
              {[task.blockName, task.cropName].filter(Boolean).join(' · ') || '—'}
              {task.dueLabel ? ` · Due ${task.dueLabel}` : ''}
            </p>
            <p className="tc-agro-task-meta">Assigned: {task.assignedAgronomist ?? '—'}</p>
          </button>
        ))}
        {tasks.length === 0 ? <p className="tc-bl-empty">No agronomist tasks for this farmer yet.</p> : null}
      </div>

      {selectedTaskId ? (
        <AgronomistTaskDetailModal
          taskId={selectedTaskId}
          apiBase="telecaller"
          canWrite={canWrite}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={() => void load()}
        />
      ) : null}
    </div>
  );
}
