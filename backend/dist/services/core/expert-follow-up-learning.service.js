import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
import { buildQuestionReuseKeys, buildSymptomKey } from '../ai/question-reuse-keys.util.js';
import { buildCrossLanguageIntentSlug } from '../whatsapp/pipeline/crop-message-intent.service.js';
import { normalizeRegionalFarmerQuery } from '../ai/regional-query-normalize.util.js';
import { normalizeChoiceOptions, normalizeFollowUpKind, } from '../whatsapp/pipeline/follow-up-question.types.js';
const EXPERT_REVIEW_SYSTEM = `You are Morbeez agronomy knowledge curator for Indian crop farmers.

When an agricultural expert approves a diagnosis case, generate 1–3 follow-up questions to STORE for future farmers with SIMILAR initial complaints.

These exact questions will be sent again on WhatsApp — write them clearly for farmers.

RULES:
- Target information gaps that would improve diagnosis accuracy for this crop + symptom + final issue
- Do NOT repeat questions the farmer already answered (see existingIntakeQa)
- Do NOT repeat questions already in the library (see existingLibrary)
- ONLY structured types: yes_no (2 choices), multiple_choice (2–8 tap options), photo (image request)
- NEVER open_text / free typing
- Provide both English and Malayalam for question and each choice label
- questionId: unique snake_case slug within this batch

Output JSON only:
{
  "questions": [
    {
      "questionId": "snake_case",
      "kind": "yes_no" | "multiple_choice" | "photo",
      "textEn": "...",
      "textMl": "...",
      "purpose": "why this helps diagnosis",
      "choices": [{ "id": "slug", "labelEn": "...", "labelMl": "..." }]
    }
  ]
}`;
function normalizeTextKey(text) {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
}
function parseKind(raw) {
    return normalizeFollowUpKind(raw);
}
function mapRow(row) {
    const kind = parseKind(row.kind);
    return {
        libraryId: String(row.id),
        id: String(row.question_id),
        kind,
        textEn: String(row.text_en),
        textMl: String(row.text_ml),
        choices: normalizeChoiceOptions(row.choices, kind),
        purpose: row.purpose ? String(row.purpose) : undefined,
        sequenceOrder: Number(row.sequence_order ?? 0),
        issueLabel: String(row.issue_label ?? ''),
        symptomKey: String(row.symptom_key),
    };
}
function symptomKeysForText(cropType, symptomsText, issueLabel) {
    const normalized = normalizeRegionalFarmerQuery(symptomsText);
    const slug = buildCrossLanguageIntentSlug(cropType, normalized, issueLabel);
    const keys = buildQuestionReuseKeys({ text: symptomsText, intentSlug: slug });
    const set = new Set(keys);
    set.add(buildSymptomKey(symptomsText));
    if (issueLabel?.trim())
        set.add(buildSymptomKey(`${symptomsText} ${issueLabel}`));
    return [...set].filter(Boolean);
}
function questionAlreadyImplied(questionText, symptomsText) {
    const q = normalizeTextKey(questionText);
    const s = normalizeTextKey(symptomsText);
    if (!q || !s)
        return false;
    const tokens = q.split(' ').filter((w) => w.length >= 4);
    if (tokens.length < 2)
        return false;
    const matched = tokens.filter((t) => s.includes(t)).length;
    return matched / tokens.length >= 0.6;
}
export const expertFollowUpLearningService = {
    symptomKeysForText,
    localize(q, lang) {
        if (lang === 'ml' && q.textMl.trim())
            return q.textMl.trim();
        return q.textEn.trim() || q.textMl.trim();
    },
    async findForFarmer(params) {
        const crop = params.cropType.toLowerCase();
        const district = params.district?.toLowerCase() ?? '';
        const keys = symptomKeysForText(crop, params.symptomsText, params.issueLabelHint);
        const limit = params.max ?? 5;
        const seen = new Set();
        const out = [];
        for (const symptomKey of keys) {
            const { data: rows } = await supabase
                .from('learned_follow_up_questions')
                .select('*')
                .eq('crop_type', crop)
                .eq('symptom_key', symptomKey)
                .eq('active', true)
                .in('district', district ? [district, ''] : [''])
                .order('sequence_order', { ascending: true })
                .order('hit_count', { ascending: false })
                .order('created_at', { ascending: true })
                .limit(limit);
            for (const row of rows ?? []) {
                const mapped = mapRow(row);
                const dedupe = normalizeTextKey(mapped.textEn);
                if (seen.has(dedupe))
                    continue;
                if (questionAlreadyImplied(mapped.textEn, params.symptomsText))
                    continue;
                seen.add(dedupe);
                out.push(mapped);
                if (out.length >= limit)
                    return out;
            }
        }
        return out;
    },
    async recordHit(libraryId) {
        const { data } = await supabase
            .from('learned_follow_up_questions')
            .select('hit_count')
            .eq('id', libraryId)
            .maybeSingle();
        if (!data)
            return;
        await supabase
            .from('learned_follow_up_questions')
            .update({ hit_count: Number(data.hit_count ?? 0) + 1 })
            .eq('id', libraryId);
    },
    async persistQuestions(params) {
        let inserted = 0;
        const crop = params.cropType.toLowerCase();
        const district = params.district?.toLowerCase() ?? '';
        for (const q of params.questions) {
            const textKey = normalizeTextKey(q.textEn);
            if (!textKey || textKey.length < 8)
                continue;
            const { data: existing } = await supabase
                .from('learned_follow_up_questions')
                .select('id')
                .eq('crop_type', crop)
                .eq('symptom_key', params.symptomKey)
                .eq('text_en', q.textEn.trim())
                .eq('active', true)
                .maybeSingle();
            if (existing?.id)
                continue;
            const { error } = await supabase.from('learned_follow_up_questions').insert({
                crop_type: crop,
                district,
                symptom_key: params.symptomKey,
                issue_label: params.issueLabel.slice(0, 200),
                question_id: q.questionId.slice(0, 48),
                kind: q.kind,
                text_en: q.textEn.trim(),
                text_ml: q.textMl.trim() || q.textEn.trim(),
                choices: q.choices,
                purpose: q.purpose?.slice(0, 400) ?? null,
                sequence_order: q.sequenceOrder,
                source_session_id: params.sourceSessionId ?? null,
                source_recommendation_id: params.sourceRecommendationId ?? null,
                verified_by: params.verifiedBy,
            });
            if (!error)
                inserted += 1;
        }
        return inserted;
    },
    async generateQuestionsForCase(input) {
        if (!env.OPENAI_API_KEY)
            return [];
        const keys = symptomKeysForText(input.cropType, input.symptomsText, input.issueLabel);
        const primaryKey = keys[0] ?? buildSymptomKey(input.symptomsText);
        const { data: libraryRows } = await supabase
            .from('learned_follow_up_questions')
            .select('text_en, purpose')
            .eq('crop_type', input.cropType.toLowerCase())
            .eq('symptom_key', primaryKey)
            .eq('active', true)
            .limit(20);
        const existingLibrary = (libraryRows ?? []).map((r) => String(r.text_en));
        const existingIntake = (input.intakeQa ?? []).map((q) => q.question);
        const userPrompt = [
            `Crop: ${input.cropType}`,
            `Final expert-verified issue: ${input.issueLabel}`,
            `Farmer initial complaint:\n${input.symptomsText.trim().slice(0, 800)}`,
            input.expertNotes?.trim()
                ? `Expert notes for learning:\n${input.expertNotes.trim().slice(0, 500)}`
                : null,
            existingIntake.length
                ? `Already asked this case (do not duplicate):\n${existingIntake.map((q) => `- ${q}`).join('\n')}`
                : null,
            existingLibrary.length
                ? `Already in library for similar cases (do not duplicate):\n${existingLibrary.map((q) => `- ${q}`).join('\n')}`
                : null,
            'Generate 1–3 NEW follow-up questions to save for future similar farmers.',
        ]
            .filter(Boolean)
            .join('\n\n');
        try {
            const raw = await openaiJsonCompletion(EXPERT_REVIEW_SYSTEM, userPrompt, 1200);
            const rows = Array.isArray(raw.questions) ? raw.questions : [];
            const out = [];
            for (const row of rows.slice(0, 3)) {
                if (!row || typeof row !== 'object')
                    continue;
                const r = row;
                const textEn = String(r.textEn ?? '').trim();
                const textMl = String(r.textMl ?? textEn).trim();
                if (textEn.length < 8)
                    continue;
                if (existingLibrary.some((e) => normalizeTextKey(e) === normalizeTextKey(textEn)))
                    continue;
                if (existingIntake.some((e) => normalizeTextKey(e) === normalizeTextKey(textEn)))
                    continue;
                const kind = parseKind(r.kind);
                out.push({
                    questionId: String(r.questionId ?? r.id ?? `expert_${out.length + 1}`)
                        .toLowerCase()
                        .replace(/[^a-z0-9_]+/g, '_')
                        .slice(0, 48),
                    kind,
                    textEn,
                    textMl,
                    choices: normalizeChoiceOptions(r.choices, kind),
                    purpose: r.purpose ? String(r.purpose) : undefined,
                });
            }
            return out;
        }
        catch (err) {
            logger.warn({ err, sessionId: input.sessionId }, 'Expert follow-up generation failed');
            return [];
        }
    },
    async onCaseReviewApproved(input) {
        const keys = symptomKeysForText(input.cropType, input.symptomsText, input.issueLabel);
        const primaryKey = keys[0] ?? buildSymptomKey(input.symptomsText);
        let saved = 0;
        let order = 0;
        if (input.intakeQa?.length) {
            const fromIntake = input.intakeQa
                .filter((q) => q.question.trim().length >= 8 && q.answer !== 'skip')
                .map((q, i) => {
                const kind = parseKind(q.kind);
                return {
                    questionId: `intake_${i + 1}_${normalizeTextKey(q.question).slice(0, 20).replace(/\s/g, '_')}`,
                    kind,
                    textEn: q.question.trim(),
                    textMl: q.question.trim(),
                    choices: normalizeChoiceOptions(undefined, kind),
                    purpose: 'Verified from farmer WhatsApp intake',
                    sequenceOrder: order++,
                };
            });
            saved += await this.persistQuestions({
                cropType: input.cropType,
                district: input.district,
                symptomKey: primaryKey,
                issueLabel: input.issueLabel,
                questions: fromIntake,
                sourceSessionId: input.sessionId,
                sourceRecommendationId: input.recommendationId ?? undefined,
                verifiedBy: input.verifiedBy,
            });
        }
        const generated = await this.generateQuestionsForCase(input);
        if (generated.length) {
            saved += await this.persistQuestions({
                cropType: input.cropType,
                district: input.district,
                symptomKey: primaryKey,
                issueLabel: input.issueLabel,
                questions: generated.map((q, i) => ({
                    ...q,
                    sequenceOrder: order + i,
                })),
                sourceSessionId: input.sessionId,
                sourceRecommendationId: input.recommendationId ?? undefined,
                verifiedBy: input.verifiedBy,
            });
        }
        for (const extraKey of keys.slice(1, 4)) {
            if (extraKey === primaryKey || !generated.length)
                continue;
            saved += await this.persistQuestions({
                cropType: input.cropType,
                district: input.district,
                symptomKey: extraKey,
                issueLabel: input.issueLabel,
                questions: generated.map((q, i) => ({ ...q, sequenceOrder: i })),
                sourceSessionId: input.sessionId,
                sourceRecommendationId: input.recommendationId ?? undefined,
                verifiedBy: input.verifiedBy,
            });
        }
        logger.info({
            sessionId: input.sessionId,
            issue: input.issueLabel.slice(0, 80),
            saved,
            verifiedBy: input.verifiedBy,
        }, 'Expert follow-up questions saved from case review');
        return { saved };
    },
    async loadIntakeQaFromSession(sessionId) {
        const { data } = await supabase
            .from('ai_advisory_sessions')
            .select('metadata')
            .eq('id', sessionId)
            .maybeSingle();
        const meta = data?.metadata;
        return meta?.investigationPattern?.qa ?? [];
    },
};
//# sourceMappingURL=expert-follow-up-learning.service.js.map