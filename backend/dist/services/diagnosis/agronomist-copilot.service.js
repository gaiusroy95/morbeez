import { env } from '../../config/env.js';
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
import { visitAiOrchestratorService } from '../core/visit-ai-orchestrator.service.js';
import { plotDigitalTwinService } from '../intelligence/plot-digital-twin.service.js';
import { outcomeIntelligenceService } from '../intelligence/outcome-intelligence.service.js';
import { regionalThreatRadarService } from '../intelligence/regional-threat-radar.service.js';
import { supabase } from '../../lib/supabase.js';
export const agronomistCopilotService = {
    async ask(input) {
        const citations = [];
        let contextBlock = '';
        if (input.aiCaseId) {
            const detail = await visitAiOrchestratorService.getCaseDetail(input.aiCaseId);
            const top = detail.hypotheses?.[0];
            if (top) {
                contextBlock += `Current diagnosis: ${top.label} (${Math.round((top.confidence ?? 0) * 100)}%)\n`;
                contextBlock += `Rationale: ${top.rationale ?? 'n/a'}\n`;
                citations.push(`Visit AI case ${input.aiCaseId.slice(0, 8)}`);
            }
        }
        if (input.farmerId && input.blockId) {
            const twin = await plotDigitalTwinService.getLatest(input.blockId);
            if (twin) {
                contextBlock += plotDigitalTwinService.formatForPrompt(twin) + '\n';
                citations.push('Plot digital twin memory');
            }
            const flags = await regionalThreatRadarService.riskFlagsForFarmer(input.farmerId, input.cropType ?? 'ginger');
            if (flags.length) {
                contextBlock += flags.join('\n') + '\n';
                citations.push('Regional threat context');
            }
        }
        if (input.issueName) {
            const stats = await outcomeIntelligenceService.aggregateByIssue(input.issueName, 3);
            if (stats.length) {
                contextBlock +=
                    'Protocol outcomes:\n' +
                        stats.map((s) => `${s.protocolLabel}: ${s.recoveryPct}% recovery (${s.sampleCount} cases)`).join('\n') +
                        '\n';
                citations.push('Outcome intelligence');
            }
            const similar = input.farmerId
                ? await visitAiOrchestratorService.similarCases(input.farmerId, input.cropType ?? 'ginger', input.issueName)
                : [];
            if (similar.length) {
                contextBlock +=
                    'Similar cases:\n' +
                        similar
                            .slice(0, 3)
                            .map((s) => `${s.issueLabel} (conf ${Math.round(s.confidence * 100)}%)`)
                            .join('; ') +
                        '\n';
                citations.push('Similar verified cases');
            }
        }
        if (!env.OPENAI_API_KEY) {
            return {
                answer: contextBlock.trim() ||
                    'Copilot requires OPENAI_API_KEY. Escalate to senior agronomist for manual review.',
                citations,
            };
        }
        const result = await openaiJsonCompletion('You are Morbeez Agronomist Copilot. Answer ONLY from provided evidence. Never invent diagnosis labels. Cite what evidence supports the answer. If evidence is insufficient, say so and recommend escalation.', `Question: ${input.question}\n\nEvidence:\n${contextBlock || 'No case context loaded.'}\n\nReturn JSON {"answer":"..."}`, 600);
        return {
            answer: result.answer?.trim() || 'Insufficient evidence to answer — please review field photos and measurements.',
            citations,
        };
    },
    async whyDiagnosis(aiCaseId) {
        const { data } = await supabase
            .from('visit_ai_cases')
            .select('issue_name, final_diagnosis, metadata')
            .eq('id', aiCaseId)
            .maybeSingle();
        const issue = String(data?.final_diagnosis ?? data?.issue_name ?? 'this issue');
        return this.ask({
            question: `Why did AI predict ${issue}? Explain evidence chain.`,
            aiCaseId,
        });
    },
};
//# sourceMappingURL=agronomist-copilot.service.js.map