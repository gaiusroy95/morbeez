import { useEffect, useRef, useState } from 'react';
import {
  agronomistClient,
  resolveComplianceQuestion,
  type RecommendationGroupDraft,
  type WhatsappComplianceNoAction,
  type WhatsappPreviewMessage,
} from '@morbeez/shared';
import { Alert, Btn, Loading } from '../../ui';
import type { VisitIssueDraft } from './types';

type Props = {
  farmerId: string;
  blockName?: string;
  issues: VisitIssueDraft[];
  recommendationGroups?: RecommendationGroupDraft[];
  reviewDate?: string;
  monitoringInterval?: string;
  messages: WhatsappPreviewMessage[];
  onMessagesChange: (messages: WhatsappPreviewMessage[]) => void;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
};

function ExplainSnippet({ issue }: { issue: VisitIssueDraft }) {
  const [farmerText, setFarmerText] = useState('');
  useEffect(() => {
    void agronomistClient
      .explainDiagnosis({
        issueName: issue.issueName,
        finalDiagnosis: issue.finalDiagnosis,
        observation: issue.observation,
        severity: issue.severity,
        rootCause: issue.rootCause?.conclusion
          ? { rootCause: issue.rootCause.conclusion, symptoms: issue.rootCause.symptoms }
          : undefined,
      })
      .then((r) => setFarmerText(r.farmerText))
      .catch(() => setFarmerText(''));
  }, [issue.issueName, issue.finalDiagnosis]);
  if (!farmerText) return null;
  return (
    <p className="vw-hint mb-2">
      <strong>Farmer explanation:</strong> {farmerText}
    </p>
  );
}

export function VisitWhatsappPreviewStep({
  farmerId,
  blockName,
  issues,
  recommendationGroups,
  reviewDate,
  monitoringInterval,
  messages,
  onMessagesChange,
  confirmed,
  onConfirmedChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [staleHint, setStaleHint] = useState(false);
  const loadedKeyRef = useRef('');
  const generatedRef = useRef<WhatsappPreviewMessage[]>([]);

  const previewKey = JSON.stringify({
    farmerId,
    blockName,
    reviewDate,
    monitoringInterval,
    issues: issues.map((i) => ({
      issueName: i.issueName,
      finalDiagnosis: i.finalDiagnosis,
      finalRecommendation: i.finalRecommendation,
    })),
    groups: recommendationGroups,
  });

  useEffect(() => {
    if (loadedKeyRef.current && loadedKeyRef.current !== previewKey && messages.length) {
      setStaleHint(true);
      return;
    }
    if (loadedKeyRef.current === previewKey && messages.length) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const rows = await agronomistClient.previewWhatsappMessages({
        farmerId,
        blockName,
        recommendationGroups: recommendationGroups?.length ? recommendationGroups : undefined,
        reviewDate,
        monitoringInterval,
        issues: issues.map((i) => ({
          issueName: i.issueName,
          finalDiagnosis: i.finalDiagnosis,
          finalRecommendation: i.finalRecommendation,
          initialRecommendation: i.initialRecommendation,
        })),
      });
      onMessagesChange(rows);
      generatedRef.current = rows;
      onConfirmedChange(false);
      loadedKeyRef.current = previewKey;
      setStaleHint(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load WhatsApp preview');
    } finally {
      setLoading(false);
    }
  }

  function updateMessage(issueIndex: number, patch: Partial<WhatsappPreviewMessage>) {
    onMessagesChange(
      messages.map((msg) => (msg.issueIndex === issueIndex ? { ...msg, ...patch } : msg))
    );
    onConfirmedChange(false);
  }

  function resetMessage(issueIndex: number) {
    const original = generatedRef.current.find((m) => m.issueIndex === issueIndex);
    if (!original) return;
    updateMessage(issueIndex, {
      message: original.message,
      complianceQuestion: original.complianceQuestion,
      complianceNoAction: original.complianceNoAction,
      compliancePrompt: original.compliancePrompt,
    });
  }

  if (loading && !messages.length) return <Loading label="Loading WhatsApp preview…" />;

  return (
    <div className="vw-stack">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <p className="vw-hint">
        Edit each message before confirming. Farmers receive <strong>Yes</strong> / <strong>No</strong>{' '}
        buttons on the follow-up question.
      </p>
      {staleHint ? (
        <div className="vw-banner vw-banner--warn">
          Recommendations changed since this preview was generated.{' '}
          <button type="button" className="vw-qa-remove" onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Regenerate preview'}
          </button>
        </div>
      ) : null}
      {messages.map((msg) => {
        const question = resolveComplianceQuestion(msg);
        const noAction = msg.complianceNoAction ?? 'escalate';
        return (
          <div key={`${msg.issueIndex}-${msg.issueLabel}`} className="vw-issue-card">
            <div className="vw-issue-title">{msg.issueLabel}</div>
            {issues[msg.issueIndex] ? (
              <ExplainSnippet issue={issues[msg.issueIndex]!} />
            ) : null}
            <span className="vw-field-label">WhatsApp message</span>
            <textarea
              className="vw-textarea"
              rows={10}
              value={msg.message}
              onChange={(e) => updateMessage(msg.issueIndex, { message: e.target.value })}
            />
            <span className="vw-field-label">Follow-up question</span>
            <textarea
              className="vw-textarea"
              rows={2}
              value={question}
              onChange={(e) =>
                updateMessage(msg.issueIndex, {
                  complianceQuestion: e.target.value,
                  compliancePrompt: `${e.target.value} Reply Yes or No.`,
                })
              }
            />
            <span className="vw-field-label">Farmer reply buttons</span>
            <div className="vw-chip-row">
              <span className="vw-chip vw-chip--captured">Yes</span>
              <span className="vw-chip vw-chip--warn">No</span>
            </div>
            <p className="vw-hint">
              If farmer taps <strong>No</strong> →{' '}
              {noAction === 'review' ? 'telecaller review task' : 'agronomist escalation'}
            </p>
            <div className="vw-chip-row">
              {(['escalate', 'review'] as WhatsappComplianceNoAction[]).map((action) => (
                <button
                  key={action}
                  type="button"
                  className={['vw-chip', noAction === action ? 'vw-chip--active' : ''].filter(Boolean).join(' ')}
                  onClick={() => updateMessage(msg.issueIndex, { complianceNoAction: action })}
                >
                  {action === 'escalate' ? 'Escalate on No' : 'Review on No'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="vw-qa-remove"
              onClick={() => resetMessage(msg.issueIndex)}
              disabled={loading}
            >
              Reset to generated text
            </button>
          </div>
        );
      })}
      <Btn
        variant={confirmed ? 'primary' : 'secondary'}
        onClick={() => onConfirmedChange(!confirmed)}
        disabled={!messages.length || messages.some((m) => !m.message.trim())}
      >
        {confirmed ? 'Confirmed — will send on submit' : 'Confirm WhatsApp messages'}
      </Btn>
    </div>
  );
}
