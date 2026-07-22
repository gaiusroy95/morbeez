import { env } from '../../config/env.js';
import { maxQuestionsForConfidence } from '../../domain/visit-ai/question-count.js';
import { isHighValueVisitQuestion, } from '../../domain/visit-ai/question-quality.js';
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
import { DEFAULT_PERCENTAGE_OPTIONS, IMAGE_UPLOAD_TARGETS, VISIT_AI_QUESTION_GENERATOR_SYSTEM, } from '../ai/prompts/visit-ai-question-generator.prompt.js';
import { cropDoctorReportContextService } from '../ai/crop-doctor-report-context.service.js';
import { visitAiPromptContextService } from './visit-ai-prompt-context.service.js';
function normalizeAnswerType(raw) {
    const v = String(raw ?? '')
        .trim()
        .toLowerCase()
        .replace(/-/g, '_');
    if (v === 'yes_no' || v === 'yes/no')
        return 'yes_no';
    if (v === 'yes_no_unknown')
        return 'yes_no_unknown';
    if (v === 'single_choice' || v === 'single' || v === 'radio')
        return 'single_choice';
    if (v === 'multiple_choice' || v === 'multi_choice' || v === 'checkbox')
        return 'multiple_choice';
    if (v === 'percentage' || v === 'percent')
        return 'percentage';
    if (v === 'numeric' || v === 'number')
        return 'number';
    if (v === 'image_upload' || v === 'image' || v === 'photo')
        return 'image_upload';
    if (v === 'text')
        return 'text';
    return 'yes_no';
}
function normalizeOptions(answerType, options, imageTarget) {
    if (answerType === 'percentage') {
        return { options: [...DEFAULT_PERCENTAGE_OPTIONS] };
    }
    if (answerType === 'image_upload') {
        const target = String(imageTarget ?? options?.[0] ?? 'whole_plant')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_');
        const allowed = IMAGE_UPLOAD_TARGETS.includes(target)
            ? target
            : 'whole_plant';
        return {
            imageTarget: allowed,
            options: [...IMAGE_UPLOAD_TARGETS],
        };
    }
    if (answerType === 'single_choice' || answerType === 'multiple_choice') {
        const cleaned = (options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 8);
        return cleaned.length >= 2 ? { options: cleaned } : { options: undefined };
    }
    return {};
}
function kindForType(answerType) {
    if (answerType === 'yes_no' || answerType === 'yes_no_unknown')
        return 'yes_no';
    if (answerType === 'multiple_choice' || answerType === 'single_choice' || answerType === 'percentage') {
        return 'multiple_choice';
    }
    if (answerType === 'image_upload')
        return 'photo';
    return undefined;
}
async function planDynamicQuestions(params) {
    if (!env.OPENAI_API_KEY || params.max <= 0)
        return [];
    const [contextBlock, reportCtx] = await Promise.all([
        visitAiPromptContextService.buildPromptBlock({
            context: params.context,
            issueCategory: params.issueCategory,
            issueName: params.selectedHypothesis,
            observation: params.observation,
            imageSignal: params.imageSignal
                ? {
                    label: params.imageSignal.label,
                    confidence: params.imageSignal.confidence,
                    source: 'vision',
                    photoCount: params.photoCount ?? 0,
                    observations: params.imageSignal.observations,
                }
                : null,
        }),
        cropDoctorReportContextService.build({
            farmerId: params.farmerId,
            blockId: params.context.blockId,
            cropType: params.cropType,
            currentIssue: params.selectedHypothesis,
        }),
    ]);
    const fieldHistoryBlock = [
        '=== FIELD HISTORY (do not re-ask if already known) ===',
        reportCtx.lastFertilizer
            ? `Last fertilizer: ${reportCtx.lastFertilizer.label} (${reportCtx.lastFertilizer.daysAgo ?? reportCtx.lastFertilizer.date ?? 'date unknown'})`
            : 'Last fertilizer: not recorded',
        reportCtx.lastFoliarSpray
            ? `Last foliar spray: ${reportCtx.lastFoliarSpray.label} (${reportCtx.lastFoliarSpray.daysAgo ?? reportCtx.lastFoliarSpray.date ?? 'date unknown'})`
            : 'Last foliar spray: not recorded',
        reportCtx.lastDrench
            ? `Last drench: ${reportCtx.lastDrench.label} (${reportCtx.lastDrench.daysAgo ?? reportCtx.lastDrench.date ?? 'date unknown'})`
            : 'Last drench: not recorded',
        `Previous diagnosis: ${reportCtx.previousDisease ?? 'not recorded'}`,
        '=== LATEST SOIL TEST ===',
        ...(reportCtx.soilReportLines?.length
            ? reportCtx.soilReportLines
            : [reportCtx.soilSummary ?? 'Not recorded']),
    ].join('\n');
    const diffLines = (params.hypotheses ?? []).slice(0, 5).map((h, i) => {
        const pct = Math.round(h.confidence * 100);
        const rationale = h.rationale ? ` — ${h.rationale.slice(0, 100)}` : '';
        return `${i + 1}. ${h.label} (${pct}%)${rationale}`;
    });
    const confidencePct = Math.round(params.topConfidence * 100);
    const userPrompt = [
        contextBlock,
        '',
        fieldHistoryBlock,
        '',
        `=== DIAGNOSTIC STATE ===`,
        `Crop: ${params.cropType}`,
        `Primary hypothesis: ${params.selectedHypothesis}`,
        `Top confidence: ${confidencePct}%`,
        `Max questions allowed: ${params.max}`,
        diffLines.length ? `Differential hypotheses:\n${diffLines.join('\n')}` : null,
        params.photoCount
            ? `Visit photos attached: ${params.photoCount} — do NOT ask to describe visible symptoms again`
            : null,
        '',
        `If confidence is already high enough that answers will not change diagnosis or treatment, return need_more_questions=false.`,
        `Otherwise generate up to ${params.max} highest-value structured question(s). Prefer yes_no and single_choice. Fewer is better.`,
    ]
        .filter(Boolean)
        .join('\n');
    try {
        const result = await openaiJsonCompletion(VISIT_AI_QUESTION_GENERATOR_SYSTEM, userPrompt, 1200, { temperature: 0 });
        if (result.need_more_questions === false)
            return [];
        const drafts = [];
        const seen = new Set();
        for (const q of result.questions ?? []) {
            const text = String(q.question ?? q.text ?? '').trim();
            const answerType = normalizeAnswerType(q.response_type ?? q.answerType);
            const normalized = normalizeOptions(answerType, q.options, q.image_target ?? q.imageTarget);
            // Choice types without usable options fall back to yes_no when possible
            let finalType = answerType;
            if ((answerType === 'single_choice' || answerType === 'multiple_choice') &&
                !normalized.options?.length) {
                finalType = 'yes_no';
            }
            if (!isHighValueVisitQuestion(text, finalType))
                continue;
            const key = text.toLowerCase();
            if (seen.has(key))
                continue;
            seen.add(key);
            drafts.push({
                questionText: text,
                answerType: finalType,
                purpose: q.purpose ? String(q.purpose) : result.reason ? String(result.reason) : undefined,
                priority: Number.isFinite(Number(q.priority)) ? Number(q.priority) : undefined,
                options: normalized.options,
                imageTarget: normalized.imageTarget,
                kind: kindForType(finalType),
            });
            if (drafts.length >= params.max)
                break;
        }
        return drafts;
    }
    catch {
        return [];
    }
}
export const visitAiQuestionsService = {
    maxQuestionsForConfidence,
    isHighValueVisitQuestion,
    normalizeAnswerType,
    async buildVisitFollowUpQuestions(params) {
        const topConfidence = params.topConfidence ?? params.hypotheses?.[0]?.confidence ?? 0.75;
        const max = params.max ?? maxQuestionsForConfidence(topConfidence);
        if (max <= 0)
            return [];
        return planDynamicQuestions({
            farmerId: params.farmerId,
            cropType: params.cropType,
            issueCategory: params.issueCategory,
            selectedHypothesis: params.selectedHypothesis,
            observation: params.observation,
            context: params.context,
            imageSignal: params.imageSignal,
            photoCount: params.photoCount,
            hypotheses: params.hypotheses,
            topConfidence,
            max,
        });
    },
};
//# sourceMappingURL=visit-ai-questions.service.js.map