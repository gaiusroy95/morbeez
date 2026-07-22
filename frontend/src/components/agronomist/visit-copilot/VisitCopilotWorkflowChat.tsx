import { useMemo, useState } from 'react';
import {
  agronomistClient,
  emptyVisitCopilotWorkflow,
  type VisitAssistantMessage,
  type VisitCopilotWorkflowState,
} from '@morbeez/shared';
import { Btn, Field, Input, Panel } from '../ui';

type Props = {
  farmerId: string;
  blockId: string;
  sessionId?: string | null;
  cropType?: string;
};

function createMessage(role: VisitAssistantMessage['role'], content: string): VisitAssistantMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function VisitCopilotWorkflowChat({
  farmerId,
  blockId,
  sessionId,
}: Props) {
  const [messages, setMessages] = useState<VisitAssistantMessage[]>([]);
  const [workflow, setWorkflow] = useState<VisitCopilotWorkflowState>(emptyVisitCopilotWorkflow());
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const phaseLabel = useMemo(() => {
    switch (workflow.phase) {
      case 'awaiting_send_questions':
        return 'Review farmer questions';
      case 'awaiting_farmer_evidence':
        return 'Waiting for farmer evidence';
      case 'awaiting_approval':
        return 'Ready to approve';
      case 'approved':
        return 'Approved';
      default:
        return 'Start with clinical instructions';
    }
  }, [workflow.phase]);

  async function send() {
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setError('');
    const agronomistMessage = createMessage('agronomist', content);
    setMessages((prev) => [...prev, agronomistMessage]);
    setDraft('');

    try {
      const snapshot = {
        contractVersion: 'visit-assistant/v1' as const,
        revision: messages.length,
        messages: [...messages, agronomistMessage],
        history: [],
        draft: {
          assessments: {},
          measurements: {},
          issues: [],
          recommendationGroups: [],
          monitoring: [],
          followUps: [],
          safetyConfirmation: null,
        },
      };
      const result = await agronomistClient.postVisitCopilotChat({
        farmerId,
        blockId,
        sessionId: sessionId ?? undefined,
        snapshot,
        message: {
          id: agronomistMessage.id,
          content,
          createdAt: agronomistMessage.createdAt,
        },
        workflow,
      });
      setWorkflow(result.workflow);
      setMessages((prev) => [...prev, ...result.assistantMessages]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Copilot request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Agronomist Copilot">
      <p className="vw-hint">
        Paste one clinical paragraph — the copilot structures diagnosis, farmer questions, treatment,
        reminders, and visit-form fields across the 12-page wizard.
      </p>
      <p className="vw-hint">
        <strong>Status:</strong> {phaseLabel}
      </p>
      <div className="mt-3 flex flex-col gap-2 max-h-80 overflow-y-auto border rounded p-3 bg-slate-50">
        {messages.length === 0 ? (
          <p className="vw-hint">Example: suspected rhizome rot — ask farmer for cross-section photo…</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={message.role === 'agronomist' ? 'text-right' : 'text-left'}
            >
              <div
                className={`inline-block rounded px-3 py-2 text-sm whitespace-pre-wrap ${
                  message.role === 'agronomist' ? 'bg-emerald-100' : 'bg-white border'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
      </div>
      <Field label="Instruction or reply" className="mt-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Clinical instruction, Yes, farmer evidence, or Approve"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
      </Field>
      <div className="flex gap-2 flex-wrap mt-2">
        <Btn label={busy ? 'Working…' : 'Send'} onClick={() => void send()} disabled={busy || !draft.trim()} />
        {workflow.phase === 'awaiting_send_questions' ? (
          <Btn label="Send questions (Yes)" variant="secondary" onClick={() => { setDraft('Yes'); }} />
        ) : null}
        {workflow.phase === 'awaiting_approval' ? (
          <Btn label="Approve" variant="secondary" onClick={() => { setDraft('Approve'); }} />
        ) : null}
      </div>
      {error ? <p className="text-red-600 mt-2">{error}</p> : null}
    </Panel>
  );
}
