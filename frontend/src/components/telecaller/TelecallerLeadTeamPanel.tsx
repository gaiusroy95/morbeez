import { useCallback, useEffect, useState } from 'react';
import { formatDate, telecallerClient } from '@morbeez/shared';
import { Alert, Btn, Loading } from '../ui';

type Props = {
  leadId: string;
  canWrite: boolean;
};

export function TelecallerLeadTeamPanel({ leadId, canWrite }: Props) {
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEntries(await telecallerClient.getLeadTeamTimeline(leadId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load team timeline');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postComment() {
    if (!draft.trim()) return;
    setSaving(true);
    setError('');
    try {
      await telecallerClient.addLeadTeamComment(leadId, draft.trim());
      setDraft('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post comment');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Loading team discussion…" />;

  return (
    <div className="tc-team-panel">
      {error ? <Alert>{error}</Alert> : null}
      <p className="tc-team-hint">
        Internal discussion visible to telecaller, partner, expert, and admin — not the farmer.
      </p>

      {canWrite ? (
        <div className="tc-team-compose">
          <textarea
            className="tc-note-input"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add internal note for the team…"
          />
          <Btn
            label={saving ? 'Posting…' : 'Post comment'}
            size="sm"
            onClick={() => void postComment()}
            disabled={saving || !draft.trim()}
          />
        </div>
      ) : null}

      <ul className="tc-team-feed">
        {entries.map((entry) => {
          const id = String(entry.id);
          const authorType = String(entry.authorType ?? entry.author_type ?? 'system');
          const title = String(entry.title ?? entry.source ?? 'Update');
          const body = String(entry.body ?? '');
          const at = entry.at ? formatDate(String(entry.at)) : '';
          return (
            <li key={id} className="tc-team-entry">
              <div className="tc-team-entry-head">
                <strong>
                  {authorType} · {title}
                </strong>
                {at ? <span className="muted">{at}</span> : null}
              </div>
              {body ? <p>{body}</p> : null}
            </li>
          );
        })}
      </ul>
      {!entries.length ? <p className="muted">No team activity yet.</p> : null}
    </div>
  );
}
