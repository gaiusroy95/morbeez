import { draftHasTreatment, draftNeedsDilutionClarification, draftValidationChecklist, emptyExpertCaseDraft, mergeExpertCaseDraft, } from '@morbeez/shared/expert-case';
import { supplementTreatmentDraft } from './expert-case-treatment-extraction.service.js';
import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { copilotMsg, defaultFarmerQuestions, normalizeCopilotLocale, } from './expert-case-copilot-i18n.js';
const IMAGE_OPEN_RE = /\b(open|show|view|load)\b.*\b(image|photo|picture)s?\b|\b(image|photo|picture)s?\b.*\b(open|show|view|load)\b|\ball images\b/i;
const YES_RE = /^(yes|y|ok|okay|sure|do it|send|apply|proceed|approve)\b/i;
const ANNOTATE_AFFIRM_RE = /\b(annotat|overlay|highlight|yes)\b/i;
const FARMER_Q_AFFIRM_RE = /\b(send|yes|ask farmer|farmer)\b/i;
const LABEL_DOSE_AFFIRM_RE = /\b(yes|label|registered|use label)\b/i;
const NEXT_CASE_RE = /^(next case|next\s+case|open next case|अगला केस|अगला\s+केस|അടുത്ത കേസ്|அடுத்த கேஸ்|ಮುಂದಿನ ಕೇಸ್)\.?$/i;
const PREV_CASE_RE = /^(previous case|prev case|prior case|पिछला केस|पिछला\s+केस|മുമ്പത്തെ കേസ്|முந்தைய கேஸ்|ಹಿಂದಿನ ಕೇಸ್)\.?$/i;
const LIST_CASE_RE = /^(list cases|list case|case list|show cases|केस सूची|केस\s+सूची|കേസ് ലിസ്റ്റ്|கேஸ் பட்டியல்|ಕೇಸ್ ಪಟ್ಟಿ)\.?$/i;
export function detectCaseNavIntent(message) {
    const text = message.trim();
    if (NEXT_CASE_RE.test(text))
        return 'next';
    if (PREV_CASE_RE.test(text))
        return 'previous';
    if (LIST_CASE_RE.test(text))
        return 'list';
    return null;
}
export function detectCopilotIntent(message, draft) {
    const text = message.trim();
    const nav = detectCaseNavIntent(text);
    if (nav === 'next')
        return 'nav_next_case';
    if (nav === 'previous')
        return 'nav_previous_case';
    if (nav === 'list')
        return 'nav_list_cases';
    if (IMAGE_OPEN_RE.test(text))
        return 'open_images';
    const isAffirm = YES_RE.test(text) || /^(y|ok|okay|sure)\.?$/i.test(text);
    const pendingLabelDose = Boolean(draft?.validations?.dosage?.askLabelDose) && draft?.dosageSource !== 'label';
    const pendingFarmerQs = (draft?.farmerQuestions?.length ?? 0) > 0 && !draft?.farmerQuestionsSent;
    const pendingAnnotate = Boolean(draft?.imageAnalysis?.offerAnnotate) && !draft?.imageAnalysis?.annotated;
    if (isAffirm || LABEL_DOSE_AFFIRM_RE.test(text) || FARMER_Q_AFFIRM_RE.test(text)) {
        // Prefer the latest operational ask over earlier image-overlay prompts.
        if (pendingLabelDose && (isAffirm || LABEL_DOSE_AFFIRM_RE.test(text))) {
            return 'apply_label_dose';
        }
        if (pendingFarmerQs && (isAffirm || FARMER_Q_AFFIRM_RE.test(text))) {
            return 'send_farmer_questions';
        }
        if (pendingAnnotate && (isAffirm || ANNOTATE_AFFIRM_RE.test(text))) {
            return 'enable_annotations';
        }
        if (/^approve\.?$/i.test(text))
            return 'approve';
    }
    if (pendingLabelDose && LABEL_DOSE_AFFIRM_RE.test(text))
        return 'apply_label_dose';
    if (pendingFarmerQs && FARMER_Q_AFFIRM_RE.test(text))
        return 'send_farmer_questions';
    return 'free_text';
}
function confidenceBand(value) {
    if (value == null || Number.isNaN(Number(value)))
        return null;
    const n = Number(value);
    const pct = n <= 1 ? n * 100 : n;
    if (pct >= 75)
        return 'High';
    if (pct >= 45)
        return 'Moderate';
    return 'Low';
}
export async function loadExpertCaseBriefing(params) {
    const farmerId = String(params.expertCase.farmer_id ?? '');
    const cropType = params.expertCase.crop_type ?? null;
    const meta = params.expertCase.metadata ?? {};
    const briefing = {
        caseCode: String(params.expertCase.id ?? '').slice(0, 8).toUpperCase(),
        cropType,
        growthStage: typeof meta.growthStage === 'string'
            ? meta.growthStage
            : typeof meta.dap === 'number'
                ? `${meta.dap} DAP`
                : null,
        imageCount: 0,
        images: [],
        previousActivities: [],
        primaryDiagnosis: params.expertCase.primary_issue_label ?? null,
        primaryConfidence: typeof meta.confidence === 'number'
            ? meta.confidence
            : typeof meta.primaryConfidence === 'number'
                ? meta.primaryConfidence
                : null,
        alternativeDiagnosis: typeof meta.alternativeDiagnosis === 'string' ? meta.alternativeDiagnosis : null,
        alternativeConfidence: typeof meta.alternativeConfidence === 'number' ? meta.alternativeConfidence : null,
        confidenceBand: null,
        weather: null,
        soil: { ph: 'Pending', ec: 'Pending', status: 'pending' },
    };
    briefing.confidenceBand = confidenceBand(briefing.primaryConfidence);
    if (farmerId) {
        const { data: farmer } = await supabase
            .from('farmers')
            .select('name, phone')
            .eq('id', farmerId)
            .maybeSingle();
        briefing.farmerName = farmer?.name || farmer?.phone || null;
    }
    const linkedIds = params.links
        .filter((link) => ['escalation', 'ai_case', 'advisory_session', 'case', 'visit_ai_case'].includes(String(link.link_type ?? '')))
        .map((link) => String(link.entity_id ?? ''))
        .filter(Boolean);
    for (const entityId of linkedIds) {
        try {
            const { data: esc } = await supabase
                .from('escalations')
                .select('id, context, images, weather_summary, rainfall_note')
                .eq('id', entityId)
                .maybeSingle();
            if (esc) {
                const images = Array.isArray(esc.images)
                    ? esc.images
                        .map((img, i) => img.url?.startsWith('http')
                        ? { url: img.url, label: img.photoType || `Photo ${i + 1}` }
                        : null)
                        .filter((img) => Boolean(img))
                    : [];
                if (images.length) {
                    briefing.images = images;
                    briefing.imageCount = images.length;
                }
                const soil = esc.context?.soil;
                if (soil) {
                    briefing.soil = {
                        ph: soil.ph != null && soil.ph !== '' ? String(soil.ph) : 'Pending',
                        ec: soil.ec != null && soil.ec !== '' ? String(soil.ec) : 'Pending',
                        status: soil.ph != null && soil.ph !== '' && soil.ec != null && soil.ec !== ''
                            ? 'available'
                            : 'pending',
                    };
                }
                if (esc.weather_summary || esc.rainfall_note) {
                    briefing.weather = {
                        summary: String(esc.weather_summary ?? esc.rainfall_note ?? ''),
                        rainfall7dMm: null,
                        humidityPct: null,
                        temperatureC: null,
                    };
                }
            }
        }
        catch (err) {
            logger.warn({ err, entityId }, 'Expert briefing escalation load failed');
        }
        try {
            const { data: aiCase } = await supabase
                .from('ai_cases')
                .select('id, images, context, ai_summary, probable_issue, confidence')
                .eq('id', entityId)
                .maybeSingle();
            if (aiCase) {
                const images = Array.isArray(aiCase.images)
                    ? aiCase.images
                        .map((img, i) => img.url?.startsWith('http')
                        ? { url: img.url, label: img.photoType || `Photo ${i + 1}` }
                        : null)
                        .filter((img) => Boolean(img))
                    : [];
                if (images.length && !briefing.images?.length) {
                    briefing.images = images;
                    briefing.imageCount = images.length;
                }
                const soil = aiCase.context?.soil;
                if (soil) {
                    briefing.soil = {
                        ph: soil.ph != null && soil.ph !== '' ? String(soil.ph) : 'Pending',
                        ec: soil.ec != null && soil.ec !== '' ? String(soil.ec) : 'Pending',
                        status: soil.ph != null && soil.ph !== '' && soil.ec != null && soil.ec !== ''
                            ? 'available'
                            : 'pending',
                    };
                }
                if (!briefing.primaryDiagnosis && aiCase.probable_issue) {
                    briefing.primaryDiagnosis = String(aiCase.probable_issue);
                }
                if (briefing.primaryConfidence == null && aiCase.confidence != null) {
                    briefing.primaryConfidence = Number(aiCase.confidence);
                    briefing.confidenceBand = confidenceBand(briefing.primaryConfidence);
                }
            }
        }
        catch {
            /* optional */
        }
    }
    if (farmerId) {
        try {
            const { data: activities } = await supabase
                .from('cultivation_activities')
                .select('activity_type, product_name, quantity, unit, notes, activity_date')
                .eq('farmer_id', farmerId)
                .order('activity_date', { ascending: false })
                .limit(5);
            briefing.previousActivities = (activities ?? []).map((row) => {
                const product = String(row.product_name ?? row.activity_type ?? 'Activity');
                const qty = row.quantity != null
                    ? `@${row.quantity}${row.unit ? ` ${row.unit}` : ''}`
                    : '';
                return [product, qty].filter(Boolean).join(' ').trim();
            });
        }
        catch {
            /* optional table */
        }
    }
    if (typeof meta.rainfall7dMm === 'number' || typeof meta.humidityPct === 'number') {
        briefing.weather = {
            ...(briefing.weather ?? {}),
            rainfall7dMm: typeof meta.rainfall7dMm === 'number' ? meta.rainfall7dMm : null,
            humidityPct: typeof meta.humidityPct === 'number' ? meta.humidityPct : null,
            temperatureC: typeof meta.temperatureC === 'number' ? meta.temperatureC : null,
            summary: briefing.weather?.summary ?? null,
        };
    }
    return briefing;
}
const DEFAULT_FINDINGS = [
    'Older leaves affected',
    'Brown elongated lesions',
    'Yellow halos',
    'Marginal scorching',
    'Patchy field distribution',
    'Moderate severity',
];
export function applyOpenImagesIntent(draft, briefing, locale = 'en') {
    const findings = draft.imageAnalysis?.findings?.length
        ? draft.imageAnalysis.findings
        : DEFAULT_FINDINGS;
    const images = briefing?.images?.length ? briefing.images : [];
    const next = mergeExpertCaseDraft(draft, {
        imageAnalysis: {
            findings,
            annotated: false,
            offerAnnotate: true,
            images,
            imagesOpened: true,
        },
        evidence: draft.evidence?.length ? draft.evidence : findings.slice(0, 5),
    });
    const lines = [
        copilotMsg(locale, 'imagesLoaded'),
        '',
        copilotMsg(locale, 'imageAnalysisTitle'),
        copilotMsg(locale, 'detected'),
        ...findings.map((f) => `✓ ${f}`),
        '',
        copilotMsg(locale, 'wantAnnotated'),
    ];
    if (briefing?.imageCount) {
        lines.splice(1, 0, copilotMsg(locale, 'photosAvailable', { n: briefing.imageCount }));
    }
    return { draft: next, assistantMessage: lines.join('\n') };
}
export function applyAnnotationIntent(draft, locale = 'en') {
    const next = mergeExpertCaseDraft(draft, {
        imageAnalysis: {
            ...(draft.imageAnalysis ?? {}),
            findings: draft.imageAnalysis?.findings ?? DEFAULT_FINDINGS,
            annotated: true,
            offerAnnotate: false,
        },
    });
    return {
        draft: next,
        assistantMessage: copilotMsg(locale, 'overlayEnabled'),
    };
}
export function applyLabelDoseIntent(draft, locale = 'en') {
    const product = draft.treatmentProduct || draft.recommendationText || 'Recommended product';
    const labelDose = draft.dosage?.toLowerCase().includes('label')
        ? 'As per registered label dose for foliar spray'
        : draft.dosage || 'As per registered label dose for foliar spray';
    const next = mergeExpertCaseDraft(draft, {
        dosage: labelDose,
        dosageSource: 'label',
        validations: {
            ...(draft.validations ?? {}),
            dosage: {
                status: 'validated',
                message: copilotMsg(locale, 'registeredDoseApplied', { product }),
                labelDoseApplied: true,
                askLabelDose: false,
            },
        },
    });
    next.unresolvedFields = (next.unresolvedFields ?? []).filter((f) => f !== 'dosage');
    return {
        draft: next,
        assistantMessage: copilotMsg(locale, 'registeredDoseApplied', { product }),
    };
}
export async function applySendFarmerQuestionsIntent(params) {
    const farmerLang = normalizeCopilotLocale(params.farmerLocale ?? params.uiLocale ?? 'en');
    const uiLang = normalizeCopilotLocale(params.uiLocale ?? 'en');
    const questions = params.draft.farmerQuestions?.length
        ? params.draft.farmerQuestions
        : defaultFarmerQuestions(farmerLang);
    let intentId = null;
    try {
        const { data: farmer } = await supabase
            .from('farmers')
            .select('phone, preferred_language')
            .eq('id', params.farmerId)
            .maybeSingle();
        const text = [
            copilotMsg(farmer?.preferred_language ?? farmerLang, 'farmerQIntro'),
            ...questions.map((q, i) => `${i + 1}. ${q}`),
        ].join('\n');
        const { data: intent } = await supabase
            .from('communication_intents')
            .insert({
            aggregate_type: 'expert_case',
            aggregate_id: params.caseId,
            case_id: params.caseId,
            channel: 'whatsapp',
            purpose: 'clarification',
            content_version: Date.now(),
            content_hash: `farmer-q:${params.caseId}:${questions.join('|').slice(0, 80)}`,
            recipient_snapshot: {
                farmerId: params.farmerId,
                phone: farmer?.phone ?? null,
                language: farmer?.preferred_language ?? farmerLang,
            },
            payload: {
                questions,
                text,
                recommendationText: text,
                language: farmer?.preferred_language ?? farmerLang,
            },
            status: 'queued',
            updated_at: new Date().toISOString(),
        })
            .select('id')
            .maybeSingle();
        intentId = intent?.id ? String(intent.id) : null;
    }
    catch (err) {
        logger.warn({ err, caseId: params.caseId }, 'Failed to queue farmer clarification');
    }
    const next = mergeExpertCaseDraft(params.draft, {
        farmerQuestions: questions,
        farmerQuestionsSent: true,
    });
    return {
        draft: next,
        assistantMessage: copilotMsg(uiLang, 'questionsSent'),
        intentId,
    };
}
/** Deterministic validation suite once treatment is present. */
export function buildCopilotValidations(draft, briefing) {
    const product = draft.treatmentProduct ||
        (draft.recommendationText?.includes('+')
            ? draft.recommendationText.split(/[.\n]/)[0]?.trim()
            : draft.recommendationText) ||
        'Treatment';
    const nutrition = draft.nutritionProduct || 'SOP';
    const askLabel = !draft.dosage ||
        /label|manufacturer/i.test(String(draft.dosage)) ||
        draft.dosageSource === 'pending';
    const askDilution = draftNeedsDilutionClarification(draft);
    const compatibility = [
        {
            product: String(product).slice(0, 80),
            status: 'pass',
            note: 'Primary fungicide',
        },
        {
            product: String(nutrition).slice(0, 80),
            status: 'separate',
            note: 'Separate application · Compatible',
        },
        {
            product: 'Copper Fungicide',
            status: (draft.precautions ?? []).some((p) => /copper/i.test(p))
                ? 'fail'
                : 'fail',
            note: 'Tank mix not recommended',
        },
        { product: 'Sticker', status: 'pass', note: 'Compatible' },
        { product: 'Micronutrients', status: 'pass', note: 'Compatible' },
    ];
    const rainfall = briefing?.weather?.rainfall7dMm;
    const humidity = briefing?.weather?.humidityPct;
    const weather = {
        forecast: rainfall != null && rainfall > 50
            ? 'Light rain possible; disease pressure elevated after recent rainfall'
            : briefing?.weather?.summary || 'Check local forecast before spray',
        recommendation: draft.applicationTiming || 'Spray tomorrow before 10 AM',
        wind: 'Safe',
        humidity: humidity != null ? `High (${humidity}%)` : 'High',
        status: 'checked',
    };
    const validations = {
        compatibility,
        weather,
        dosage: {
            status: askLabel && draft.dosageSource !== 'label'
                ? 'needs_label'
                : askDilution
                    ? 'needs_dilution'
                    : 'validated',
            message: askLabel && draft.dosageSource !== 'label'
                ? 'Manufacturer label dose detected. Use registered label dosage?'
                : askDilution
                    ? 'Spray dilution volume (liters of water) not recorded.'
                    : 'Dosage validated',
            labelDoseApplied: draft.dosageSource === 'label',
            askLabelDose: askLabel && draft.dosageSource !== 'label',
            askDilution,
            dilutionMessage: askDilution
                ? 'Spray dilution volume (liters of water) not recorded.'
                : null,
        },
        frac: {
            previousSpray: 'Mancozeb',
            daysAgo: 12,
            rotationOk: true,
            risk: 'LOW',
        },
        phytotoxicity: { risk: 'LOW' },
        safety: {
            ppe: true,
            reiHours: 24,
            phiRecorded: true,
        },
        summary: [],
    };
    validations.summary = draftValidationChecklist({ ...draft, validations });
    return validations;
}
export function ensureMissingFarmerQuestions(draft, briefing, locale = 'en') {
    if (draft.farmerQuestionsSent && draft.farmerAnswers)
        return draft;
    const missing = [...(draft.farmerQuestions ?? [])];
    const soilPending = !briefing?.soil ||
        briefing.soil.status === 'pending' ||
        briefing.soil.ph === 'Pending' ||
        briefing.soil.ec === 'Pending';
    if (soilPending) {
        if (!missing.some((q) => /pH/i.test(q)))
            missing.push(copilotMsg(locale, 'farmerQPh'));
        if (!missing.some((q) => /EC/i.test(q)))
            missing.push(copilotMsg(locale, 'farmerQEc'));
    }
    if (!missing.some((q) => /fungicide|ಫಂಗಿ|फफूंद|ഫംഗി|பூஞ்சை/i.test(q))) {
        missing.push(copilotMsg(locale, 'farmerQFungicide'));
    }
    if (!missing.some((q) => /rain|बारिश|മഴ|மழை|ಮಳೆ/i.test(q))) {
        missing.push(copilotMsg(locale, 'farmerQRain'));
    }
    return mergeExpertCaseDraft(draft, { farmerQuestions: missing });
}
export function enrichDraftAfterExtraction(params) {
    const locale = params.locale ?? 'en';
    let draft = mergeExpertCaseDraft(emptyExpertCaseDraft(), params.draft);
    if (params.latestMessage) {
        draft = supplementTreatmentDraft(draft, params.latestMessage);
    }
    if (params.runValidations && draftHasTreatment(draft)) {
        draft = ensureMissingFarmerQuestions(draft, params.briefing, locale);
        const validations = buildCopilotValidations(draft, params.briefing);
        draft = mergeExpertCaseDraft(draft, { validations });
        if (!draft.knowledgeCandidate && draft.diagnosis) {
            draft.knowledgeCandidate = true;
            draft.knowledgeCandidateReason =
                draft.knowledgeCandidateReason ||
                    `${draft.diagnosis} with field evidence; candidate for expert knowledge review.`;
        }
        if (!draft.farmerTasks?.length) {
            draft.farmerTasks = [
                'Upload whole-field images',
                'Upload close-up leaf photos',
                'Share progress update',
            ];
        }
        if (draft.followUpDays == null)
            draft.followUpDays = 7;
    }
    return draft;
}
export function parseFarmerAnswerMessage(text) {
    const answers = {};
    const ph = text.match(/pH\s*[:=]?\s*([\d.]+)/i);
    const ec = text.match(/EC\s*[:=]?\s*([\d.]+)/i);
    if (ph)
        answers.soilPh = ph[1].replace(/\.$/, '');
    if (ec)
        answers.soilEc = ec[1].replace(/\.$/, '');
    if (/no fungicide/i.test(text))
        answers.recentFungicide = 'No';
    if (/rain/i.test(text))
        answers.rainLinked = 'Yes — symptoms increased after rain';
    return Object.keys(answers).length ? answers : null;
}
export { draftHasTreatment, emptyExpertCaseDraft, mergeExpertCaseDraft };
//# sourceMappingURL=expert-case-copilot-simulation.service.js.map