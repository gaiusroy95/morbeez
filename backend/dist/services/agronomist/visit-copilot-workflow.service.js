import { randomUUID } from 'node:crypto';
import { detectVisitCopilotIntent, emptyVisitCopilotWorkflow, looksLikeFarmerEvidenceMessage, } from '@morbeez/shared/visit-copilot';
import { visitCopilotExtractionService } from './visit-copilot-extraction.service.js';
function assistantMessage(content) {
    return {
        id: randomUUID(),
        role: 'assistant',
        content,
        createdAt: new Date().toISOString(),
    };
}
function formatStructuredPreview(workflow) {
    const lines = ['### Structured Preview', ''];
    if (workflow.preview.workingDiagnosis) {
        lines.push('**Working Diagnosis**', `* ${workflow.preview.workingDiagnosis}`, '');
    }
    lines.push('**Diagnosis Status**', `* ${workflow.preview.diagnosisStatus === 'confirmed' ? 'Confirmed' : workflow.preview.diagnosisStatus === 'suspected' ? 'Suspected' : 'Pending confirmation'}`, '');
    if (workflow.preview.confidence != null) {
        const pct = workflow.preview.confidence <= 1
            ? Math.round(workflow.preview.confidence * 100)
            : Math.round(workflow.preview.confidence);
        lines.push('**Confidence**', `* ${pct}%`, '');
    }
    if (workflow.preview.evidenceRequired.length) {
        lines.push('**Evidence**');
        for (const item of workflow.preview.evidenceRequired) {
            const icon = item.status === 'received' ? '✅' : item.status === 'not_observed' ? '❌' : '⏳';
            lines.push(`* ${icon} ${item.label}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function formatFarmerQuestions(questions) {
    const lines = ['### Farmer Questions', '', 'Please complete the following:', ''];
    questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push('', '**Send these questions?**');
    return lines.join('\n');
}
function formatTreatmentDraft(workflow) {
    const lines = ['### Treatment Draft', ''];
    if (workflow.treatment?.activities.length) {
        lines.push('**Activities**');
        for (const act of workflow.treatment.activities) {
            lines.push(`* ${act.method}: ${act.product} — ${act.dose}`);
            if (act.intervalDays)
                lines.push(`  Repeat every ${act.intervalDays} days${act.repeatCount ? ` × ${act.repeatCount}` : ''}`);
        }
        lines.push('');
    }
    if (workflow.treatment?.farmerAdvice.length) {
        lines.push('**Farmer Advice**');
        for (const advice of workflow.treatment.farmerAdvice)
            lines.push(`* ${advice}`);
        lines.push('');
    }
    if (workflow.treatment?.weatherAdvisory.length) {
        lines.push('**Weather Advisory**');
        for (const note of workflow.treatment.weatherAdvisory)
            lines.push(`* ${note}`);
        lines.push('');
    }
    return lines.join('\n');
}
function formatValidation(workflow) {
    if (!workflow.validation)
        return '';
    const lines = ['### Automatic Validation', ''];
    const section = (title, items) => {
        if (!items.length)
            return;
        lines.push(`**${title}**`);
        for (const item of items) {
            lines.push(`* ${item.status === 'warning' ? '⚠' : '✅'} ${item.text}`);
        }
        lines.push('');
    };
    section('Compatibility', workflow.validation.compatibility);
    section('Weather', workflow.validation.weather);
    section('Follow-up', workflow.validation.followUp);
    return lines.join('\n');
}
function formatReminders(reminders) {
    if (!reminders.length)
        return '';
    const lines = ['### Reminders Created', ''];
    for (const item of reminders) {
        lines.push(`**Day ${item.dayOffset}**`, `* ${item.label}`, '');
    }
    return lines.join('\n');
}
export const visitCopilotWorkflowService = {
    async chat(input) {
        const prior = input.workflow ?? emptyVisitCopilotWorkflow();
        const intent = detectVisitCopilotIntent(input.message.content, prior.phase);
        const messages = [];
        if (intent.kind === 'confirm_send_questions' && prior.farmerQuestions.length) {
            const workflow = {
                ...prior,
                phase: 'awaiting_farmer_evidence',
                farmerQuestionsSent: true,
            };
            messages.push(assistantMessage('Questions sent to the farmer.'));
            return {
                assistantMessages: messages,
                proposal: {
                    contractVersion: 'visit-assistant/v1',
                    proposalId: randomUUID(),
                    baseRevision: input.snapshot.revision,
                    messages: [],
                    operations: [],
                    clarifications: [],
                    unresolvedFields: [],
                },
                workflow,
            };
        }
        if (intent.kind === 'approve' && prior.phase === 'awaiting_approval') {
            const workflow = {
                ...prior,
                phase: 'approved',
                approvedAt: new Date().toISOString(),
            };
            messages.push(assistantMessage([
                '✅ Case Approved',
                '',
                'Completed automatically:',
                '* Structured diagnosis saved to visit form',
                '* Treatment schedule created',
                '* Monitoring reminders scheduled',
                '* Farmer advice and weather advisory attached',
                '* Ready to open the next pending case',
            ].join('\n')));
            return {
                assistantMessages: messages,
                proposal: {
                    contractVersion: 'visit-assistant/v1',
                    proposalId: randomUUID(),
                    baseRevision: input.snapshot.revision,
                    messages: [],
                    operations: [],
                    clarifications: [],
                    unresolvedFields: [],
                },
                workflow,
            };
        }
        const isFarmerEvidence = intent.kind === 'farmer_evidence' || looksLikeFarmerEvidenceMessage(input.message.content);
        const extracted = await visitCopilotExtractionService.extract({
            farmerId: input.farmerId,
            blockId: input.blockId,
            snapshot: input.snapshot,
            message: input.message,
            priorEvidenceReceived: isFarmerEvidence ? prior.preview.evidenceReceived : undefined,
        });
        const workflow = {
            ...prior,
            preview: extracted.preview,
            farmerQuestions: extracted.farmerQuestions.length
                ? extracted.farmerQuestions
                : prior.farmerQuestions,
            treatment: extracted.treatment,
            reminders: extracted.reminders.length ? extracted.reminders : prior.reminders,
            validation: extracted.validation,
        };
        if (intent.kind === 'clinical_instruction' || prior.phase === 'idle') {
            workflow.phase = extracted.farmerQuestions.length ? 'awaiting_send_questions' : 'awaiting_approval';
            workflow.farmerQuestionsSent = false;
            messages.push(assistantMessage(extracted.assistantMessage || 'Understood. I have extracted your instructions.'));
            messages.push(assistantMessage(formatStructuredPreview(workflow)));
            if (workflow.farmerQuestions.length) {
                messages.push(assistantMessage(formatFarmerQuestions(workflow.farmerQuestions)));
            }
            else {
                messages.push(assistantMessage(formatTreatmentDraft(workflow)));
                messages.push(assistantMessage(formatValidation(workflow)));
                messages.push(assistantMessage(formatReminders(workflow.reminders)));
                workflow.phase = 'awaiting_approval';
            }
        }
        else if (isFarmerEvidence) {
            workflow.phase = 'awaiting_approval';
            if (workflow.preview.diagnosisStatus === 'pending_confirmation' && workflow.preview.confidence) {
                workflow.preview.diagnosisStatus = 'confirmed';
            }
            messages.push(assistantMessage('Evidence received.'));
            messages.push(assistantMessage(formatStructuredPreview(workflow)));
            messages.push(assistantMessage(formatTreatmentDraft(workflow)));
            messages.push(assistantMessage(formatValidation(workflow)));
            messages.push(assistantMessage(formatReminders(workflow.reminders)));
            messages.push(assistantMessage('Reply **Approve** to save this case to the visit form.'));
        }
        else {
            messages.push(assistantMessage(extracted.assistantMessage || 'Updated structured preview.'));
            messages.push(assistantMessage(formatStructuredPreview(workflow)));
        }
        const proposalMessages = extracted.proposal.messages.filter((m) => !messages.some((existing) => existing.id === m.id));
        return {
            assistantMessages: [...messages, ...proposalMessages],
            proposal: extracted.proposal,
            workflow,
        };
    },
};
//# sourceMappingURL=visit-copilot-workflow.service.js.map