/**
 * After "AI is wrong", re-assess the farmer's free-text hypothesis against the crop photos.
 * Conditions and probabilities come only from vision+LLM — never keyword/tables/fake stepped %.
 */
import { openaiJsonCompletion, openaiJsonVisionCompletion, } from '../ai/providers/openai.provider.js';
import { isFarmerSuggestionButtonId } from '../../domain/learning/farmer-nutrient-suggestions.js';
import { supabase } from '../../lib/supabase.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { diagnosisSessionEvidenceService } from '../whatsapp/pipeline/diagnosis-session-evidence.service.js';
/** Free-typed theory (not a WhatsApp chip / button id). */
export function looksLikeDescriptiveHypothesis(raw) {
    const t = raw.trim();
    if (!t || isFarmerSuggestionButtonId(t))
        return false;
    if (/^feedback\./i.test(t))
        return false;
    return t.length >= 12;
}
function clampProb(n) {
    if (!Number.isFinite(n))
        return 0;
    if (n > 1 && n <= 100)
        return Math.min(1, Math.max(0, n / 100));
    return Math.min(1, Math.max(0, n));
}
function normalizeRole(raw, index) {
    const r = (raw ?? '').toLowerCase().trim();
    if (r === 'primary' || r.includes('primary'))
        return 'primary';
    if (r === 'contributing' || r.includes('contribut'))
        return 'contributing';
    if (r === 'secondary' || r.includes('second'))
        return 'secondary';
    if (r === 'possible' || r.includes('possible') || r.includes('unlikely'))
        return 'possible';
    if (index === 0)
        return 'primary';
    return 'possible';
}
function normalizeLikelihood(raw, p) {
    const r = (raw ?? '').toLowerCase().trim();
    if (r.includes('unlikely') || r.includes('low'))
        return 'unlikely';
    if (r.includes('possible') || r.includes('less'))
        return 'possible';
    if (r.includes('moderate') || r.includes('medium'))
        return 'moderate';
    if (r.includes('high'))
        return 'high';
    if (p >= 0.7)
        return 'high';
    if (p >= 0.4)
        return 'moderate';
    if (p >= 0.2)
        return 'possible';
    return 'unlikely';
}
function formatPctBand(c) {
    const lo = c.probabilityLow != null ? clampProb(c.probabilityLow) : null;
    const hi = c.probabilityHigh != null ? clampProb(c.probabilityHigh) : null;
    if (lo != null && hi != null && hi >= lo) {
        return `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`;
    }
    return `≈${Math.round(clampProb(c.probability) * 100)}%`;
}
function likelihoodWord(c, lang) {
    const l = c.likelihood ?? normalizeLikelihood(undefined, c.probability);
    if (lang === 'ml') {
        if (l === 'high')
            return 'ഉയർന്ന സാധ്യത';
        if (l === 'moderate')
            return 'ഇടത്തരം';
        if (l === 'unlikely')
            return 'സാധ്യത കുറവ്';
        return 'സാധ്യം';
    }
    if (l === 'high')
        return 'High';
    if (l === 'moderate')
        return 'Moderate';
    if (l === 'unlikely')
        return 'Unlikely';
    return 'Possible';
}
/** WhatsApp message built from structured LLM conditions (never trust free-form step-% replies). */
function formatWhatsAppAssessment(lang, verdict, conditions, sequenceSummary, usedPhoto) {
    const lines = conditions.slice(0, 6).map((c, i) => {
        const band = formatPctBand(c);
        const like = likelihoodWord(c, lang);
        const reason = c.reason.trim();
        if (lang === 'ml') {
            return `${i + 1}) ${c.label} — ${like} (${band})${reason ? `\n   ${reason}` : ''}`;
        }
        return `${i + 1}) ${c.label} — ${like} (${band})${reason ? `\n   Reason: ${reason}` : ''}`;
    });
    if (lang === 'ml') {
        return [
            verdict.trim() ||
                (usedPhoto
                    ? 'നിങ്ങളുടെ അഭിപ്രായം സാധ്യമാണ്; ഫോട്ടോകൾ കണ്ട ശേഷം ഞങ്ങൾ ഇതിനെ ചെറുതായി ക്രമീകരിച്ചു.'
                    : 'നിങ്ങളുടെ അഭിപ്രായം രേഖപ്പെടുത്തി. ഫോട്ടോ ലഭ്യമല്ലാത്തതിനാൽ സ്കോർ കുറച്ച് ആത്മവിശ്വാസത്തോടെ നൽകുന്നു.'),
            '',
            'ഞങ്ങളുടെ വിലയിരുത്തൽ:',
            ...lines,
            sequenceSummary ? `\nക്രമം: ${sequenceSummary}` : '',
            '',
            'അഗ്രോണമിസ്റ്റ് ഇത് സ്ഥിരീകരിക്കും. കുറച്ച് ചോദ്യങ്ങൾ കൂടി…',
        ]
            .filter(Boolean)
            .join('\n');
    }
    return [
        verdict.trim() ||
            (usedPhoto
                ? 'Your hypothesis is plausible, but based on these photos I would refine it slightly.'
                : 'Your hypothesis is noted. No crop photo was available for this session, so confidence is limited.'),
        '',
        'My assessment:',
        ...lines,
        sequenceSummary ? `\nLikely sequence: ${sequenceSummary}` : '',
        '',
        'An agronomist will verify this. A few quick follow-up questions…',
    ]
        .filter(Boolean)
        .join('\n');
}
/** Reject evenly stepped high-% lists that echo farmer text without photo discrimination. */
function looksLikeSteppedEcho(probs) {
    if (probs.length < 3)
        return false;
    const pcts = probs.map((p) => Math.round(clampProb(p) * 100));
    const diffs = [];
    for (let i = 1; i < pcts.length; i++)
        diffs.push(pcts[i - 1] - pcts[i]);
    const allHigh = pcts.every((p) => p >= 55);
    const sameStep = diffs.every((d) => d === diffs[0] && d >= 8 && d <= 15);
    return allHigh && sameStep;
}
async function loadPriorAdvisory(sessionId) {
    if (!sessionId) {
        return {
            probableIssue: null,
            imageObservations: [],
            differential: [],
            cropType: null,
            cropStage: null,
            symptomsText: null,
            summaryEn: null,
        };
    }
    const [{ data: out }, { data: sess }] = await Promise.all([
        supabase
            .from('ai_advisory_outputs')
            .select('probable_issue, farmer_summary_en, raw_response')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('ai_advisory_sessions')
            .select('crop_type, crop_stage, symptoms_text, image_storage_path')
            .eq('id', sessionId)
            .maybeSingle(),
    ]);
    const raw = (out?.raw_response ?? {});
    const observations = Array.isArray(raw.imageObservations)
        ? raw.imageObservations.map((o) => String(o)).filter(Boolean).slice(0, 16)
        : [];
    const differential = Array.isArray(raw.differentialDiagnosis)
        ? raw.differentialDiagnosis
            .map((d) => ({
            label: String(d.label ?? '').trim(),
            probability: typeof d.probability === 'number' ? d.probability : undefined,
            reason: d.reason != null ? String(d.reason) : undefined,
        }))
            .filter((d) => d.label)
        : [];
    return {
        probableIssue: out?.probable_issue ? String(out.probable_issue) : null,
        imageObservations: observations,
        differential,
        cropType: sess?.crop_type ? String(sess.crop_type) : null,
        cropStage: sess?.crop_stage ? String(sess.crop_stage) : null,
        symptomsText: sess?.symptoms_text ? String(sess.symptoms_text) : null,
        summaryEn: out?.farmer_summary_en ? String(out.farmer_summary_en) : null,
    };
}
function buildSystemPrompt(hasPhotos) {
    return [
        'You are an expert field agronomist refining a farmer correction after they disagreed with a prior AI diagnosis.',
        hasPhotos
            ? 'PHOTOS ARE ATTACHED. Analyze the leaf/plant images first. Base every probability on what is visibly present (leaf age, lesion type, margins, distribution, chlorosis pattern).'
            : 'NO PHOTOS AVAILABLE. Do not invent high confidence. Keep probabilities modest and say so in reasons.',
        'The farmer hypothesis is a starting claim — not ground truth. Support, lower, or challenge each claim using photo evidence.',
        'Classic discrimination rules (apply only from photos):',
        '- Nutrient scorch on OLDER leaves → often K; Ca/B usually hit YOUNGEST emerging leaves first.',
        '- Anthracnose needs discrete lesions / dark margins / spore masses — brown edge scorch alone is not enough.',
        '- Damaged tissue may allow secondary fungal infection at moderate/low probability.',
        '- Drought/water stress can contribute even if the farmer did not name it.',
        'FORBIDDEN:',
        '- Keyword recycling: do not list farmer conditions at 85%, 75%, 65%, 60% (or any evenly stepped descending ladder) without photo discrimination.',
        '- Hardcoded disease dictionaries or default crop diagnoses.',
        '- Copying the farmer list unchanged when photos contradict it.',
        'OUTPUT JSON only:',
        '{',
        '  "verdict": "1 short sentence like ChatGPT: hypothesis plausible but refined from photos",',
        '  "photoFindings": ["2-5 concrete visual bullets"],',
        '  "conditions": [{',
        '    "label": "condition name",',
        '    "probability": 0.0-1.0 midpoint,',
        '    "probabilityLow": 0.0-1.0,',
        '    "probabilityHigh": 0.0-1.0,',
        '    "likelihood": "high|moderate|possible|unlikely",',
        '    "role": "primary|contributing|secondary|possible",',
        '    "reason": "cite photo evidence (leaf age, lesion morphology, etc.)"',
        '  }],',
        '  "sequenceSummary": "optional short causal sequence"',
        '}',
        'Include every farmer-named condition with an honest score (including low/unlikely if photos contradict).',
        'You may add photo-supported factors the farmer omitted (e.g. water stress).',
        'Probabilities must differ based on evidence strength — not arithmetic ladders.',
    ].join('\n');
}
function parseLlmResult(json, lang, usedPhoto) {
    const conditions = (json.conditions ?? [])
        .map((c, i) => {
        const label = String(c.label ?? '').trim();
        if (!label)
            return null;
        const lo = c.probabilityLow != null && Number.isFinite(Number(c.probabilityLow))
            ? clampProb(Number(c.probabilityLow))
            : undefined;
        const hi = c.probabilityHigh != null && Number.isFinite(Number(c.probabilityHigh))
            ? clampProb(Number(c.probabilityHigh))
            : undefined;
        let probability = clampProb(Number(c.probability));
        if ((!Number.isFinite(Number(c.probability)) || probability === 0) && lo != null && hi != null) {
            probability = (lo + hi) / 2;
        }
        return {
            label: label.slice(0, 160),
            probability,
            probabilityLow: lo,
            probabilityHigh: hi,
            likelihood: normalizeLikelihood(c.likelihood, probability),
            role: normalizeRole(c.role, i),
            reason: String(c.reason ?? '').slice(0, 400),
        };
    })
        .filter((c) => c != null)
        .slice(0, 6);
    if (!conditions.length) {
        throw new AppError('Refine returned no conditions', 502, 'REFINE_EMPTY');
    }
    if (looksLikeSteppedEcho(conditions.map((c) => c.probability))) {
        logger.warn({ probs: conditions.map((c) => c.probability) }, 'Refine probs look like stepped echo — rejecting');
        throw new AppError('Refine probabilities look uncalibrated', 502, 'REFINE_UNCALIBRATED');
    }
    conditions.sort((a, b) => b.probability - a.probability);
    const hasPrimary = conditions.some((c) => c.role === 'primary');
    if (!hasPrimary && conditions[0])
        conditions[0].role = 'primary';
    const sequenceSummary = String(json.sequenceSummary ?? '').trim().slice(0, 500);
    const verdict = String(json.verdict ?? '').trim().slice(0, 280);
    return {
        conditions,
        sequenceSummary,
        replyToFarmer: formatWhatsAppAssessment(lang, verdict, conditions, sequenceSummary, usedPhoto),
        source: usedPhoto ? 'llm_vision' : 'llm_text',
        usedPhoto,
    };
}
export const farmerHypothesisRefineService = {
    looksLikeDescriptiveHypothesis,
    async refine(params) {
        const prior = await loadPriorAdvisory(params.sessionId);
        const priorIssue = params.priorAiIssue ?? prior.probableIssue;
        const loaded = await diagnosisSessionEvidenceService.loadImages({
            farmerId: params.farmerId,
            sessionId: params.sessionId,
        });
        const images = loaded.map((i) => ({ imageBase64: i.imageBase64, mimeType: i.mimeType }));
        const usedPhoto = images.length > 0;
        const chatEvidence = params.farmerId
            ? await diagnosisSessionEvidenceService.formatEvidenceForPrompt({
                farmerId: params.farmerId,
                sessionId: params.sessionId,
            })
            : '';
        const user = [
            `Crop type: ${prior.cropType ?? 'unknown'}`,
            `Crop stage: ${prior.cropStage ?? 'unknown'}`,
            `Photos attached to this request: ${usedPhoto ? `YES (${images.length}) — analyze them as primary evidence` : 'NO'}`,
            `Prior AI probable issue: ${priorIssue ?? 'unknown'}`,
            chatEvidence || null,
            prior.symptomsText ? `Original symptoms text: ${prior.symptomsText.slice(0, 500)}` : null,
            prior.summaryEn ? `Prior AI farmer summary: ${prior.summaryEn.slice(0, 800)}` : null,
            prior.imageObservations.length
                ? `Prior imageObservations (may be incomplete — re-check photos):\n${prior.imageObservations
                    .map((o) => `- ${o}`)
                    .join('\n')}`
                : null,
            prior.differential.length
                ? `Prior AI differentials (for context only — re-score from photos + chat):\n${prior.differential
                    .slice(0, 6)
                    .map((d) => `- ${d.label}${d.probability != null ? ` (${Math.round(d.probability * 100)}%)` : ''}${d.reason ? `: ${d.reason}` : ''}`)
                    .join('\n')}`
                : null,
            `Farmer hypothesis (free text — evaluate against photos + prior chat, do not blindly trust):\n${params.farmerText.slice(0, 1500)}`,
            'Return photo-calibrated ranked conditions now.',
        ]
            .filter(Boolean)
            .join('\n\n');
        const system = buildSystemPrompt(usedPhoto);
        const callLlm = async (extraNudge) => {
            const prompt = extraNudge ? `${user}\n\n${extraNudge}` : user;
            if (usedPhoto) {
                return openaiJsonVisionCompletion(system, prompt, images, 1800, { temperature: 0.2 });
            }
            return openaiJsonCompletion(system, prompt, 1400, {
                temperature: 0.2,
            });
        };
        try {
            const json = await callLlm();
            return parseLlmResult(json, params.lang, usedPhoto);
        }
        catch (err) {
            const code = err instanceof AppError ? err.code : '';
            if (code === 'REFINE_UNCALIBRATED' || code === 'REFINE_EMPTY') {
                const json = await callLlm('RETRY: Your previous scores looked like an evenly spaced high-% ladder echoing the farmer text. Re-score using photo evidence + chat context only — use honest bands (e.g. high 75–85, moderate 30–40, possible 20–30) and lower claims the photos do not support.');
                return parseLlmResult(json, params.lang, usedPhoto);
            }
            throw err;
        }
    },
};
//# sourceMappingURL=farmer-hypothesis-refine.service.js.map