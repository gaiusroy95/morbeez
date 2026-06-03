import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import { supabase } from '../../../lib/supabase.js';
import { aiReuseService, buildDapBucket } from '../../ai/ai-reuse.service.js';
import { blockService } from '../../core/block.service.js';
import { inputClassifierService } from './input-classifier.service.js';
import { conversationSessionService } from '../conversation-session.service.js';
import { whatsappService } from '../whatsapp.service.js';
const MAX_QUESTIONS = () => Number(process.env.DIAGNOSIS_FOLLOW_UP_MAX_QUESTIONS ?? 2);
const MIN_SIMILAR_CASES = () => Number(process.env.DIAGNOSIS_FOLLOW_UP_MIN_CASES ?? 3);
const STRONG_MATCH_SCORE = () => Number(process.env.DIAGNOSIS_FOLLOW_UP_STRONG_MATCH ?? 0.88);
function tokenSet(text) {
    return new Set(text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3));
}
function overlapScore(a, b) {
    const sa = tokenSet(a);
    const sb = tokenSet(b);
    if (!sa.size || !sb.size)
        return 0;
    let inter = 0;
    for (const t of sa) {
        if (sb.has(t))
            inter += 1;
    }
    return inter / Math.max(sa.size, sb.size);
}
function issueSlug(issueLabel) {
    const t = issueLabel.toLowerCase();
    if (/thrip|streak|silver/i.test(t))
        return 'thrips';
    if (/leaf spot|phyllosticta|spot|blotch/i.test(t))
        return 'leaf_spot';
    if (/blast|pyricularia/i.test(t))
        return 'blast';
    if (/rot|wilt|soft/i.test(t))
        return 'root_rot';
    if (/yellow|chlorosis/i.test(t))
        return 'nutrient';
    return 'general';
}
const DISCRIMINATORS = {
    thrips: [
        {
            id: 'silver_streaks',
            en: 'Do you see silvery-white streaks or scraping marks on the leaves?',
            ml: 'ഇലയിൽ വെള്ള/വെള്ളിമിശ്രിത പട്ടയോ scrape ചിഹ്നങ്ങളും കാണുന്നുണ്ടോ?',
            hint: /silver|streak|scrape|white line|വെള്ള പട്ട/i,
        },
        {
            id: 'widespread',
            en: 'Is this on many plants in the field, not just one plant?',
            ml: 'ഒരു ചെടിയിൽ മാത്രമല്ല, നിലത്ത് പല ചെടികളിലും ഉണ്ടോ?',
        },
    ],
    leaf_spot: [
        {
            id: 'round_spots',
            en: 'Are the spots round with yellow-brown edges?',
            ml: 'പുള്ളികൾ വൃത്താകാരവും മഞ്ഞ-തവിട്ട അരികുകളുമാണോ?',
            hint: /round|circle|പുള്ളി|spot/i,
        },
        {
            id: 'after_rain',
            en: 'Did spots increase after recent rain?',
            ml: 'അടുത്തിടെ മഴ കഴിഞ്ഞ് പുള്ളി കൂടിയോ?',
        },
    ],
    blast: [
        {
            id: 'water_soaked',
            en: 'Do leaves have water-soaked or burnt-looking patches?',
            ml: 'ഇലയിൽ വെള്ളം പിടിച്ച അല്ലെങ്കിൽ കരിച്ച പോലെയുള്ള ഭാഗങ്ങളുണ്ടോ?',
        },
    ],
    root_rot: [
        {
            id: 'soft_rhizome',
            en: 'Is the rhizome/underground part soft or smelly?',
            ml: 'രൈസോം/അടിവേര് മൃദുവോ ദുർഗന്ധമോ?',
        },
    ],
    general: [
        {
            id: 'spread_fast',
            en: 'Is the problem spreading quickly across the field?',
            ml: 'പ്രശ്നം വേഗത്തിൽ നിലം മുഴുവൻ പടരുന്നുണ്ടോ?',
        },
        {
            id: 'new_growth',
            en: 'Are new young leaves more affected than old leaves?',
            ml: 'പുതിയ ഇലകളാണ് കൂടുതൽ ബാധിച്ചതോ?',
        },
    ],
};
function localizeQuestion(q, lang) {
    if (lang === 'ml')
        return q.ml;
    if (lang === 'hi')
        return q.en;
    if (lang === 'ta')
        return q.en;
    if (lang === 'kn')
        return q.en;
    return q.en;
}
export const diagnosisFollowUpService = {
    enabled() {
        return env.ENABLE_DIAGNOSIS_FOLLOW_UP !== false && env.ENABLE_AI_REUSE_CACHE !== false;
    },
    async findSimilarLearnedCases(params) {
        const crop = params.cropType.toLowerCase();
        const district = params.district?.toLowerCase() ?? '';
        const limit = params.limit ?? 25;
        const { data: rows } = await supabase
            .from('advisory_reuse_cases')
            .select('id, issue_label, symptom_key, confidence_score, hit_count, advisory_snapshot')
            .eq('crop_type', crop)
            .eq('outcome_ok', true)
            .gte('confidence_score', 0.65)
            .order('hit_count', { ascending: false })
            .limit(80);
        const scored = [];
        for (const row of rows ?? []) {
            const issueLabel = String(row.issue_label ?? '').trim();
            const symptomKey = String(row.symptom_key ?? '');
            const snap = row.advisory_snapshot;
            const textBlob = `${issueLabel} ${symptomKey}`;
            const score = overlapScore(params.symptomsText, textBlob);
            const districtBoost = district && String(row.district ?? '') === district ? 0.08 : 0;
            const finalScore = Math.min(1, score + districtBoost + Math.min(0.12, (row.hit_count ?? 0) / 200));
            if (finalScore < 0.12)
                continue;
            scored.push({
                reuseCaseId: String(row.id),
                issueLabel,
                symptomKey,
                score: finalScore,
                hitCount: Number(row.hit_count ?? 0),
                confidence: Number(row.confidence_score ?? 0.7),
                staffVerified: Boolean(snap?.staffVerified),
            });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit);
    },
    buildQuestions(params) {
        const questions = [];
        if (params.needsPhoto) {
            questions.push({
                id: 'photo',
                kind: 'photo',
                text: params.language === 'ml'
                    ? 'കൃത്യമായ നിർണയത്തിന് ഇലയുടെ അടുത്ത ഫോട്ടോ അയയ്ക്കൂ (അല്ലെങ്കിൽ "skip" എന്ന് ടൈപ്പ് ചെയ്യൂ).'
                    : 'For a better match with similar cases, please send a close leaf photo (or type skip).',
            });
        }
        const best = params.similarCases[0];
        const slug = best ? issueSlug(best.issueLabel) : 'general';
        const pool = DISCRIMINATORS[slug] ?? DISCRIMINATORS.general;
        for (const def of pool) {
            if (questions.length >= MAX_QUESTIONS() + (params.needsPhoto ? 1 : 0))
                break;
            if (def.hint && def.hint.test(params.symptomsText))
                continue;
            if (questions.some((q) => q.id === def.id))
                continue;
            questions.push({
                id: def.id,
                kind: 'yes_no',
                text: localizeQuestion(def, params.language),
            });
        }
        return questions.slice(0, MAX_QUESTIONS() + (params.needsPhoto ? 1 : 0));
    },
    enrichedSymptoms(intake) {
        const parts = [intake.initialSymptoms.trim()];
        for (const [qid, ans] of Object.entries(intake.answers)) {
            if (ans === 'skip')
                continue;
            parts.push(`${qid}: ${ans}`);
        }
        if (intake.bestIssueLabel) {
            parts.push(`Similar cases suggest: ${intake.bestIssueLabel}`);
        }
        return parts.filter(Boolean).join('. ');
    },
    async startIntake(params) {
        if (!this.enabled())
            return { started: false };
        const { data: farmer } = await supabase
            .from('farmers')
            .select('district')
            .eq('id', params.farmerId)
            .maybeSingle();
        const district = farmer?.district ? String(farmer.district).trim().toLowerCase() : null;
        const similar = await this.findSimilarLearnedCases({
            cropType: params.cropType,
            district,
            symptomsText: params.symptomsText,
        });
        if (similar.length < MIN_SIMILAR_CASES()) {
            return { started: false };
        }
        const classified = inputClassifierService.classifyText(params.symptomsText);
        const best = similar[0];
        const needsPhoto = !params.hasPhoto &&
            (classified.category === 'disease_stress' ||
                classified.category === 'insect' ||
                classified.category === 'unknown_low_conf');
        const questions = this.buildQuestions({
            language: params.language,
            symptomsText: params.symptomsText,
            similarCases: similar,
            needsPhoto,
            category: classified.category,
        });
        if (!questions.length)
            return { started: false };
        if (best && best.score >= STRONG_MATCH_SCORE() && !needsPhoto && questions.length <= 1) {
            return { started: false };
        }
        const intake = {
            initialSymptoms: params.symptomsText,
            questions,
            currentIndex: 0,
            answers: {},
            similarCases: similar.slice(0, 5).map((c) => ({
                issueLabel: c.issueLabel,
                score: c.score,
                reuseCaseId: c.reuseCaseId,
            })),
            bestIssueLabel: best?.issueLabel,
            matchConfidence: best?.score,
            pendingPhoto: needsPhoto,
        };
        await conversationSessionService.patchContext(params.farmerId, { diagnosisIntake: intake });
        await conversationSessionService.setState(params.farmerId, 'diagnosis_intake');
        const intro = params.language === 'ml'
            ? `നിങ്ങളുടെ പ്രശ്നം പരിശോധിക്കുന്നു. മോർബീസിൽ സമാനമായ ${similar.length}+ കേസുകൾ ഉണ്ട്.\n\n${best ? `ഏറ്റവും അടുത്തത്: ${best.issueLabel}.\n\n` : ''}ചില ചെറിയ ചോദ്യങ്ങൾ — ശരിയായ ഉത്തരം കിട്ടാൻ:`
            : `Checking your problem against ${similar.length}+ similar ${params.cropType} cases Morbeez has learned.\n\n${best ? `Closest match: ${best.issueLabel}.\n\n` : ''}A few quick questions for the most accurate advice:`;
        await this.sendCurrentQuestion(params.phone, params.language, intake, intro);
        return { started: true };
    },
    async sendCurrentQuestion(phone, language, intake, prefix) {
        const q = intake.questions[intake.currentIndex];
        if (!q)
            return;
        const body = prefix ? `${prefix}\n\n${q.text}` : q.text;
        if (q.kind === 'yes_no') {
            try {
                await whatsappService.sendButtons({
                    to: phone,
                    body,
                    buttons: [
                        { id: `dfq.yes.${q.id}`, title: language === 'ml' ? 'അതെ' : 'Yes' },
                        { id: `dfq.no.${q.id}`, title: language === 'ml' ? 'ഇല്ല' : 'No' },
                    ],
                });
                return;
            }
            catch {
                /* fall through */
            }
        }
        await whatsappService.sendText(phone, body);
    },
    parseButtonReply(text) {
        const m = text.match(/^dfq\.(yes|no)\.(.+)$/);
        if (!m)
            return null;
        return { questionId: m[2], answer: m[1] === 'yes' ? 'yes' : 'no' };
    },
    parseTextAnswer(text) {
        const t = text.trim().toLowerCase();
        if (/^(skip|പിന്നീട്|നാളെ)$/i.test(t))
            return 'skip';
        if (/^(yes|y|അതെ|ഉണ്ട|haan|हाँ|हां|ஆம்|ಹೌದು|1)$/i.test(t))
            return 'yes';
        if (/^(no|n|ഇല്ല|illa|नहीं|இல்லை|ಇಲ್ಲ|2)$/i.test(t))
            return 'no';
        return null;
    },
    async handleIntakeMessage(params) {
        const ctx = await conversationSessionService.getContext(params.farmerId);
        const intake = ctx.diagnosisIntake;
        if (!intake?.questions?.length)
            return { handled: false };
        const current = intake.questions[intake.currentIndex];
        if (!current) {
            return { handled: true, ready: true, enrichedSymptoms: this.enrichedSymptoms(intake) };
        }
        if (current.kind === 'photo' && params.hasPhoto) {
            intake.answers[current.id] = 'yes';
            intake.currentIndex += 1;
            intake.pendingPhoto = false;
        }
        else if (current.kind === 'photo') {
            const skip = /skip/i.test(params.text);
            if (!skip && !params.hasPhoto) {
                await whatsappService.sendText(params.phone, params.language === 'ml'
                    ? 'ദയവായി ഇലയുടെ ഫോട്ടോ അയയ്ക്കൂ, അല്ലെങ്കിൽ "skip" എന്ന് ടൈപ്പ് ചെയ്യൂ.'
                    : 'Please send a leaf photo, or type skip.');
                return { handled: true, ready: false };
            }
            intake.answers[current.id] = skip ? 'skip' : 'yes';
            intake.currentIndex += 1;
        }
        else {
            const btn = this.parseButtonReply(params.text);
            const ans = btn?.answer ?? this.parseTextAnswer(params.text);
            if (!ans || (ans !== 'yes' && ans !== 'no' && ans !== 'skip')) {
                await whatsappService.sendText(params.phone, params.language === 'ml' ? 'അതെ / ഇല്ല എന്ന് മാത്രം അയയ്ക്കൂ.' : 'Please reply Yes or No.');
                return { handled: true, ready: false };
            }
            intake.answers[current.id] = btn?.answer ?? ans;
            intake.currentIndex += 1;
        }
        await conversationSessionService.patchContext(params.farmerId, { diagnosisIntake: intake });
        if (intake.currentIndex >= intake.questions.length) {
            await conversationSessionService.patchContext(params.farmerId, { diagnosisIntake: undefined });
            await conversationSessionService.setState(params.farmerId, 'diagnosis');
            const enriched = this.enrichedSymptoms(intake);
            logger.info({
                farmerId: params.farmerId,
                bestIssue: intake.bestIssueLabel,
                matchConfidence: intake.matchConfidence,
                answerCount: Object.keys(intake.answers).length,
            }, 'Diagnosis intake complete');
            return { handled: true, ready: true, enrichedSymptoms: enriched };
        }
        await this.sendCurrentQuestion(params.phone, params.language, intake);
        return { handled: true, ready: false };
    },
    /** After intake, try exact reuse; else return enriched text for Crop Doctor. */
    async resolveAfterIntake(params) {
        const district = await supabase
            .from('farmers')
            .select('district')
            .eq('id', params.farmerId)
            .maybeSingle()
            .then((r) => r.data?.district ? String(r.data.district).trim().toLowerCase() : null);
        let dap = 0;
        if (params.activePlotId) {
            const block = await blockService.getById(params.activePlotId, params.farmerId);
            if (block)
                dap = block.dap;
        }
        else {
            const primary = await blockService.getPrimaryBlock(params.farmerId);
            dap = primary?.dap ?? 0;
        }
        const match = await aiReuseService.findReusableForFarmerMessage({
            cropType: params.cropType,
            district,
            dapBucket: buildDapBucket(dap),
            text: params.enrichedSymptoms,
            compactHistory: params.compactHistory,
        });
        return {
            reused: Boolean(match),
            matchIssue: match?.issueLabel,
        };
    },
};
//# sourceMappingURL=diagnosis-follow-up.service.js.map