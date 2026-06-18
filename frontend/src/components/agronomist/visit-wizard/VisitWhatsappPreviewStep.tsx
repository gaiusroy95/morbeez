import { useEffect, useState } from 'react';
import { agronomistClient, type WhatsappPreviewMessage } from '@morbeez/shared';
import { Alert, Btn, Loading } from '../../ui';
import type { VisitIssueDraft } from './types';

type Props = {
  farmerId: string;
  issues: VisitIssueDraft[];
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
};

export function VisitWhatsappPreviewStep({ farmerId, issues, confirmed, onConfirmedChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<WhatsappPreviewMessage[]>([]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const rows = await agronomistClient.previewWhatsappMessages({
        farmerId,
        issues: issues.map((i) => ({
          issueName: i.issueName,
          finalDiagnosis: i.finalDiagnosis,
          finalRecommendation: i.finalRecommendation,
          initialRecommendation: i.initialRecommendation,
        })),
      });
      setMessages(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load WhatsApp preview');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loading label="Loading WhatsApp preview…" />;

  return (
    <div className="vw-stack">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <p className="vw-hint">Preview messages that will be sent to the farmer after submit.</p>
      {messages.map((msg) => (
        <div key={msg.issueLabel} className="vw-issue-card">
          <div className="vw-issue-title">{msg.issueLabel}</div>
          <pre className="vw-hint" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
            {msg.message}
          </pre>
          {msg.compliancePrompt ? <div className="vw-hint">{msg.compliancePrompt}</div> : null}
        </div>
      ))}
      <Btn variant={confirmed ? 'primary' : 'secondary'} onClick={() => onConfirmedChange(!confirmed)}>
        {confirmed ? 'Confirmed — will send on submit' : 'Confirm WhatsApp messages'}
      </Btn>
    </div>
  );
}
