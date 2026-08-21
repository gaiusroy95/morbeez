import { hasUsableCropPhotoEvidence, observationIndicatesNoCrop, } from '../whatsapp/pipeline/crop-photo-evidence.util.js';
/** Weather/humidity fillers that must not appear as Contributing Factor without lesion evidence. */
const WEATHER_ONLY_DISEASE_RE = /\banthracnose\b|\bfungal\s+leaf\s+spot\b|\bcolletotrichum\b/i;
const LESION_EVIDENCE_RE = /\b(lesion|spot|spots|blight|anthracnose|necrotic|halo|margin|spore|fungal\s+leaf)\b/i;
function dedupeObservations(list) {
    const seen = new Set();
    const out = [];
    for (const raw of list) {
        const t = raw.replace(/^•\s*/, '').trim();
        if (!t)
            continue;
        const key = t.toLowerCase().replace(/\s+/g, ' ');
        const softKey = key
            .replace(/\b(photo\s*\d+:?\s*)/g, '')
            .replace(/\b(provided|visible|seen)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (seen.has(softKey))
            continue;
        seen.add(softKey);
        out.push(t);
    }
    return out;
}
function observationsSupportFungalLesions(observations) {
    return (observations ?? []).some((o) => {
        const t = o.toLowerCase();
        // Ignore negations like "no discrete spots" / "without necrotic lesions"
        if (/\b(no|not|without|absent|lack(?:ing)?)\b[\s\w-]{0,24}\b(lesion|spots?|blight|anthracnose|necrotic|halo|spore)\b/.test(t)) {
            return false;
        }
        return LESION_EVIDENCE_RE.test(o);
    });
}
function stripWeatherOnlyContributing(advisory) {
    const next = { ...advisory };
    const usable = hasUsableCropPhotoEvidence(next.imageObservations);
    const lesionSupport = observationsSupportFungalLesions(next.imageObservations);
    const allowWeatherDisease = usable && lesionSupport;
    const shouldDropLabel = (label) => {
        if (!label?.trim())
            return false;
        if (!WEATHER_ONLY_DISEASE_RE.test(label))
            return false;
        return !allowWeatherDisease;
    };
    if (shouldDropLabel(next.contributingFactor)) {
        next.contributingFactor = undefined;
    }
    if (next.diagnosisRanked?.length) {
        next.diagnosisRanked = next.diagnosisRanked.filter((row) => {
            if (row.role !== 'contributing')
                return true;
            return !shouldDropLabel(row.label);
        });
    }
    if (!usable && next.differentialDiagnosis?.length) {
        next.differentialDiagnosis = next.differentialDiagnosis.filter((d) => !WEATHER_ONLY_DISEASE_RE.test(d.label ?? ''));
    }
    return next;
}
/**
 * Sanitize LLM/advisory output before WhatsApp farmer report.
 * - Reject diagnoses built on non-crop photos
 * - Never promote weather-only anthracnose as Contributing Factor without lesion evidence
 * - Deduplicate observation bullets
 */
export function sanitizeAdvisoryForFarmerWhatsApp(advisory) {
    let next = { ...advisory };
    next.imageObservations = dedupeObservations(next.imageObservations ?? []);
    const usable = hasUsableCropPhotoEvidence(next.imageObservations);
    const noCrop = (next.imageObservations ?? []).some(observationIndicatesNoCrop);
    next = stripWeatherOnlyContributing(next);
    if (!usable && (noCrop || (next.imageObservations?.length ?? 0) > 0)) {
        return {
            advisory: {
                ...next,
                probableIssue: 'Unable to diagnose — crop not visible in photo',
                confidence: Math.min(next.confidence, 0.25),
                uncertain: true,
                contributingFactor: undefined,
                diagnosisRanked: [],
                differentialDiagnosis: [],
                treatments: [],
                dosageGuidance: [],
                connectedPrevention: [],
                nutrientDeficiency: [],
                farmerSummaryEn: 'This photo does not clearly show the crop. Please send a close photo of the affected leaves or plant.',
                farmerSummaryMl: 'ഈ ഫോട്ടോയിൽ വിള വ്യക്തമല്ല. ബാധിത ഇലയുടെ അടുത്ത ഫോട്ടോ അയയ്ക്കുക.',
                agronomistAssessment: 'Photo rejected for farmer diagnosis: no usable crop tissue visible. Weather priors must not drive a disease label.',
            },
            blockDiagnosis: true,
            reason: 'no_usable_crop_photo',
        };
    }
    next = stripWeatherOnlyContributing(next);
    return { advisory: next, blockDiagnosis: false };
}
//# sourceMappingURL=advisory-farmer-sanitize.util.js.map