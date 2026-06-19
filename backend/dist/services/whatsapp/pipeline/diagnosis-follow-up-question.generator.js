import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import { openaiJsonCompletion } from '../../ai/providers/openai.provider.js';
import { normalizeChoiceOptions, normalizeFollowUpKind, } from './follow-up-question.types.js';
const SYSTEM_PROMPT = `You are Morbeez follow-up question planner for Indian crop farmers on WhatsApp.

Your job: decide the SINGLE best next follow-up question OR mark intake complete.

RULES:
- ONLY structured response types: yes_no (2 choices), multiple_choice (2–8 options), or photo (image request).
- NEVER use open text / free typing questions.
- Learn from verified investigation patterns; after expert-saved questions are used, add NEW questions only if needed.
- Do NOT repeat what the farmer already stated in initial symptoms or prior answers.
- multiple_choice: provide 2–8 clear tap options (e.g. spray timing, severity bands, symptom patterns).
- yes_no: omit choices array (system adds Yes/No).
- photo: omit choices array (farmer sends image or skip).
- Write question text in English and Malayalam.
- questionId: short snake_case slug (unique within session).

Output JSON only:
{
  "intakeComplete": boolean,
  "rationale": "why this question or why done",
  "question": {
    "questionId": "snake_case",
    "kind": "yes_no" | "multiple_choice" | "photo",
    "textEn": "English question",
    "textMl": "Malayalam question",
    "purpose": "what diagnosis gap this fills",
    "choices": [
      { "id": "option_slug", "labelEn": "...", "labelMl": "..." }
    ]
  }
}
When intakeComplete is true, omit question or set null.`;
function sanitizeQuestionId(raw) {
    const slug = raw
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48);
    return slug || `q_${Date.now()}`;
}
function localizeQuestion(row, lang) {
    if (lang === 'ml' && row.textMl?.trim())
        return row.textMl.trim();
    return (row.textEn ?? row.textMl ?? '').trim();
}
function formatAnswerHuman(ans) {
    if (ans === 'yes')
        return 'Yes';
    if (ans === 'no')
        return 'No';
    if (ans === 'skip')
        return 'Skipped';
    if (ans === 'within_7d')
        return 'Within last 7 days';
    if (ans === 'over_14d')
        return '14+ days ago';
    if (ans === 'never')
        return 'Not yet / no spray';
    return ans;
}
function buildUserPrompt(input) {
    const { ctx, priorAnswers, questionTexts, questionsAsked, maxQuestions, learnedPatterns } = input;
    const priorLines = Object.entries(priorAnswers).map(([id, ans]) => {
        const q = questionTexts[id] ?? id;
        return `- Q: ${q}\n  A: ${formatAnswerHuman(ans)}`;
    });
    const patternLines = learnedPatterns.slice(0, 8).map((p, i) => {
        const qa = p.qa.map((x) => `    • "${x.question}" → ${formatAnswerHuman(x.answer)}`).join('\n');
        return `${i + 1}. Issue: ${p.issueLabel}\n   Initial: ${p.initialSymptoms.slice(0, 180)}\n${qa}`;
    });
    return [
        `Crop: ${ctx.cropType}`,
        `Language: ${ctx.language}`,
        `Has photo: ${ctx.hasPhoto}`,
        ctx.dap != null ? `Crop stage: ${ctx.dap} DAP` : null,
        `Match confidence: ${(ctx.matchConfidence * 100).toFixed(0)}%`,
        ctx.bestIssueLabel ? `Closest learned issue: ${ctx.bestIssueLabel}` : null,
        ctx.heavyRainLikely ? 'Weather: heavy rain likely' : null,
        ctx.highHumidityLikely ? 'Weather: high humidity' : null,
        `Initial farmer message:\n${ctx.symptomsText.trim().slice(0, 600)}`,
        '',
        priorLines.length
            ? `Already asked (${questionsAsked}/${maxQuestions}):\n${priorLines.join('\n')}`
            : `No follow-ups asked yet (${questionsAsked}/${maxQuestions} max).`,
        '',
        patternLines.length
            ? `Verified patterns from similar cases:\n${patternLines.join('\n\n')}`
            : 'No prior patterns — ask the most diagnostic structured question.',
        input.evidenceGaps?.length
            ? `MAIOS evidence gaps (prioritize closing these): ${input.evidenceGaps.join(', ')}`
            : null,
        '',
        questionsAsked >= maxQuestions
            ? 'Question budget exhausted — set intakeComplete true.'
            : 'Plan the next single structured question (yes/no, multiple choice, or photo).',
    ]
        .filter(Boolean)
        .join('\n');
}
export const diagnosisFollowUpQuestionGenerator = {
    async planNextQuestion(input) {
        if (!env.OPENAI_API_KEY) {
            logger.warn('Follow-up planner: OpenAI not configured — skipping intake');
            return { intakeComplete: true, rationale: 'openai_unavailable' };
        }
        if (input.questionsAsked >= input.maxQuestions) {
            return { intakeComplete: true, rationale: 'max_questions_reached' };
        }
        try {
            const raw = await openaiJsonCompletion(SYSTEM_PROMPT, buildUserPrompt(input), 900);
            if (Boolean(raw.intakeComplete)) {
                return {
                    intakeComplete: true,
                    rationale: String(raw.rationale ?? 'model_complete'),
                };
            }
            const q = raw.question;
            if (!q || typeof q !== 'object') {
                return { intakeComplete: true, rationale: 'no_question_generated' };
            }
            const id = sanitizeQuestionId(String(q.questionId ?? q.id ?? ''));
            if (input.priorAnswers[id] !== undefined) {
                return { intakeComplete: true, rationale: 'duplicate_question_id' };
            }
            const kind = normalizeFollowUpKind(q.kind);
            const choices = normalizeChoiceOptions(q.choices, kind);
            const text = localizeQuestion({ textEn: String(q.textEn ?? ''), textMl: String(q.textMl ?? '') }, input.ctx.language);
            if (!text || text.length < 8) {
                return { intakeComplete: true, rationale: 'empty_question_text' };
            }
            return {
                intakeComplete: false,
                rationale: String(raw.rationale ?? ''),
                question: {
                    id,
                    kind,
                    text,
                    choices,
                    purpose: q.purpose ? String(q.purpose) : undefined,
                },
            };
        }
        catch (err) {
            logger.warn({ err }, 'Follow-up question generation failed — proceeding to diagnosis');
            return { intakeComplete: true, rationale: 'generation_error' };
        }
    },
    buildInvestigationPattern(params) {
        const qa = Object.entries(params.answers)
            .filter(([, ans]) => ans !== 'skip')
            .map(([id, answer]) => ({
            question: params.questionTexts[id] ?? id,
            answer,
            kind: params.questionKinds[id],
        }));
        return {
            initialSymptoms: params.initialSymptoms.trim().slice(0, 400),
            issueLabel: params.issueLabel.trim().slice(0, 200),
            qa,
        };
    },
};
//# sourceMappingURL=diagnosis-follow-up-question.generator.js.map