import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { expertFollowUpLearningService } from './expert-follow-up-learning.service.js';
import { issueFollowUpQuestionsService } from './issue-follow-up-questions.service.js';
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
function kindToAnswerType(kind) {
    if (kind === 'multiple_choice')
        return 'yes_no_unknown';
    return 'yes_no_unknown';
}
async function getFarmerDistrict(farmerId) {
    const { data } = await supabase.from('farmers').select('district').eq('id', farmerId).maybeSingle();
    return data?.district ? String(data.district).trim().toLowerCase() : null;
}
export const visitAiQuestionsService = {
    async buildVisitFollowUpQuestions(params) {
        const max = params.max ?? 5;
        const symptoms = [params.selectedHypothesis, params.observation ?? ''].filter(Boolean).join(' ');
        const district = await getFarmerDistrict(params.farmerId);
        const library = await expertFollowUpLearningService.findForFarmer({
            cropType: params.cropType,
            district,
            symptomsText: symptoms,
            issueLabelHint: params.selectedHypothesis,
            language: 'en',
            max,
        });
        const drafts = library.map((q) => ({
            questionText: q.textEn,
            answerType: kindToAnswerType(q.kind),
            sourceLibraryId: q.libraryId,
            kind: q.kind,
        }));
        if (drafts.length >= max)
            return drafts.slice(0, max);
        const fallbackTexts = await issueFollowUpQuestionsService.suggest({
            issueCategory: params.issueCategory,
            issueName: params.selectedHypothesis,
            cropType: params.cropType,
            dap: params.context.dap,
            observation: params.observation,
            photoCount: 0,
            selectedHypothesis: params.selectedHypothesis,
            contextPack: params.context,
        });
        const seen = new Set(drafts.map((d) => d.questionText.toLowerCase()));
        for (const text of fallbackTexts) {
            const t = text.trim();
            if (!t || seen.has(t.toLowerCase()))
                continue;
            seen.add(t.toLowerCase());
            drafts.push({ questionText: t, answerType: 'yes_no_unknown', kind: 'yes_no' });
            if (drafts.length >= max)
                break;
        }
        if (drafts.length < 3 && env.OPENAI_API_KEY) {
            try {
                const extra = await openaiJsonCompletion('Return JSON {"questions":[{"text":"...","answerType":"yes_no_unknown|number"}]} with 2-3 short agronomy follow-up questions.', `Crop: ${params.cropType}, DAP: ${params.context.dap}, Diagnosis: ${params.selectedHypothesis}, Observation: ${params.observation ?? 'none'}`, 512);
                for (const q of extra.questions ?? []) {
                    const t = String(q.text ?? '').trim();
                    if (!t || seen.has(t.toLowerCase()))
                        continue;
                    seen.add(t.toLowerCase());
                    drafts.push({
                        questionText: t,
                        answerType: q.answerType === 'number' ? 'number' : 'yes_no_unknown',
                        kind: 'yes_no',
                    });
                    if (drafts.length >= max)
                        break;
                }
            }
            catch {
                // ignore
            }
        }
        return drafts.slice(0, max);
    },
};
//# sourceMappingURL=visit-ai-questions.service.js.map