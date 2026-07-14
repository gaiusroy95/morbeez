import { useCallback, useEffect, useState } from 'react';
import {
  telecallerClient,
  type TelecallerFollowUpSections,
  type TelecallerTaskRow,
} from '@morbeez/shared';
import { Alert, Btn, Loading } from '../ui';

const EMPTY: TelecallerFollowUpSections = {
  today: [],
  overdue: [],
  upcoming: [],
  recommendationReviews: [],
  visitFollowUps: [],
  orderFollowUps: [],
  general: [],
};

type Props = {
  canWrite: boolean;
  onOpenLead: (leadId: string) => void;
};

function TaskSection({
  title,
  tasks,
  canWrite,
  onComplete,
  onSnooze,
  onOpen,
}: {
  title: string;
  tasks: TelecallerTaskRow[];
  canWrite: boolean;
  onComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  onOpen: (task: TelecallerTaskRow) => void;
}) {
  if (!tasks.length) return null;
  return (
    <section className="tc-followups-section">
      <h3>{title}</h3>
      <ul className="tc-followups-list">
        {tasks.map((task) => (
          <li key={task.id} className="tc-followups-card">
            <button type="button" className="tc-followups-title" onClick={() => onOpen(task)}>
              <strong>{task.title}</strong>
              {task.farmerName ? <span className="text-ink-muted"> — {task.farmerName}</span> : null}
              {task.dueLabel ? <div className="tc-followups-due">{task.dueLabel}</div> : null}
            </button>
            {canWrite ? (
              <div className="tc-followups-actions">
                <Btn size="sm" variant="secondary" label="Complete" onClick={() => onComplete(task.id)} />
                <Btn size="sm" variant="secondary" label="Snooze 1d" onClick={() => onSnooze(task.id)} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TelecallerFollowUpsPanel({ canWrite, onOpenLead }: Props) {
  const [sections, setSections] = useState<TelecallerFollowUpSections>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSections(await telecallerClient.listFollowUpSections());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load follow-ups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function completeTask(taskId: string) {
    await telecallerClient.completeTask(taskId);
    void load();
  }

  async function snoozeTask(taskId: string) {
    const due = new Date(Date.now() + 86400000).toISOString();
    await telecallerClient.snoozeTask(taskId, due);
    void load();
  }

  function openTask(task: TelecallerTaskRow) {
    if (task.leadId) onOpenLead(String(task.leadId));
  }

  if (loading) return <Loading label="Loading follow-ups…" />;
  const total =
    sections.today.length +
    sections.overdue.length +
    sections.upcoming.length +
    sections.recommendationReviews.length +
    sections.visitFollowUps.length +
    sections.orderFollowUps.length +
    sections.general.length;

  return (
    <div className="tc-followups-panel">
      {error ? <Alert>{error}</Alert> : null}
      <div className="tc-followups-head">
        <p className="text-ink-muted">{total} follow-up items</p>
        <Btn label="Refresh" variant="secondary" size="sm" onClick={() => void load()} />
      </div>
      <TaskSection title="Today" tasks={sections.today} canWrite={canWrite} onComplete={(id) => void completeTask(id)} onSnooze={(id) => void snoozeTask(id)} onOpen={openTask} />
      <TaskSection title="Overdue" tasks={sections.overdue} canWrite={canWrite} onComplete={(id) => void completeTask(id)} onSnooze={(id) => void snoozeTask(id)} onOpen={openTask} />
      <TaskSection title="Upcoming" tasks={sections.upcoming} canWrite={canWrite} onComplete={(id) => void completeTask(id)} onSnooze={(id) => void snoozeTask(id)} onOpen={openTask} />
      <TaskSection title="Recommendation reviews" tasks={sections.recommendationReviews} canWrite={canWrite} onComplete={(id) => void completeTask(id)} onSnooze={(id) => void snoozeTask(id)} onOpen={openTask} />
      <TaskSection title="Visit follow-ups" tasks={sections.visitFollowUps} canWrite={canWrite} onComplete={(id) => void completeTask(id)} onSnooze={(id) => void snoozeTask(id)} onOpen={openTask} />
      <TaskSection title="Order follow-ups" tasks={sections.orderFollowUps} canWrite={canWrite} onComplete={(id) => void completeTask(id)} onSnooze={(id) => void snoozeTask(id)} onOpen={openTask} />
      <TaskSection title="General" tasks={sections.general} canWrite={canWrite} onComplete={(id) => void completeTask(id)} onSnooze={(id) => void snoozeTask(id)} onOpen={openTask} />
      {!total ? <p className="text-ink-muted">No follow-ups in queue.</p> : null}
    </div>
  );
}
