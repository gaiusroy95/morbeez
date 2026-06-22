import { useState } from 'react';
import { agronomistClient } from '@morbeez/shared';
import { Btn, Field, Input, Panel } from '../ui';

type Props = {
  farmerId: string;
  blockId: string;
  cropType: string;
  issueName?: string;
  aiCaseId?: string;
};

export function VisitCopilotPanel({ farmerId, blockId, cropType, issueName, aiCaseId }: Props) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const r = await agronomistClient.copilotAsk({
        question: question.trim(),
        farmerId,
        blockId,
        cropType,
        issueName,
        aiCaseId,
      });
      setAnswer(r.answer);
      setCitations(r.citations);
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : 'Copilot failed');
      setCitations([]);
    } finally {
      setLoading(false);
    }
  }

  async function whyDiagnosis() {
    if (!aiCaseId) return;
    setLoading(true);
    try {
      const r = await agronomistClient.whyDiagnosis(aiCaseId);
      setAnswer(r.answer);
      setCitations(r.citations);
      setQuestion('Why this diagnosis?');
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : 'Could not explain diagnosis');
      setCitations([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Agronomist copilot">
      <p className="vw-hint">Ask about this visit with full farmer, plot, and case context.</p>
      <Field label="Question">
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Why might K be low here?" />
      </Field>
      <div className="flex gap-2 flex-wrap mt-2">
        <Btn label={loading ? 'Thinking…' : 'Ask copilot'} onClick={() => void ask()} disabled={loading || !question.trim()} />
        {aiCaseId ? (
          <Btn label="Why diagnosis?" variant="secondary" onClick={() => void whyDiagnosis()} disabled={loading} />
        ) : null}
      </div>
      {answer ? (
        <div className="mt-3">
          <p>{answer}</p>
          {citations.length ? <p className="vw-hint">Sources: {citations.join(' · ')}</p> : null}
        </div>
      ) : null}
    </Panel>
  );
}
