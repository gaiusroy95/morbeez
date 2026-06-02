import { inputClassifierService } from './input-classifier.service.js';
const INDIC_SCRIPT = /[\u0D00-\u0D7F\u0B80-\u0BFF\u0C80-\u0CFF\u0900-\u097F]/;
function hasIndicScript(text) {
    const t = text.trim();
    return Boolean(t) && INDIC_SCRIPT.test(t);
}
/** Latin + regional crop / symptom signals (not English-only). */
const AGRI_SIGNALS = /\b(crop|farm|ginger|pepper|plant|leaf|leaves|disease|pest|spray|fertiliz|manure|harvest|yellow|spot|wilt|fungus|anthracnose|thrips)\b|വിള|രോഗ|കീട|ഇഞ്ചി|ഇല|പുള്ളി|മഞ്ഞ|பயிர|இலை|கீட|ಬೆಳೆ|ಎಲೆ|ಎಳೆ|फसल|कीट|रोग|पत्त|पत्ती|पीले|पील|धब्ब|अदरक|हल्दी|मिर्च|फैल|बीमार|सड़|खाद|छिड़क/i;
const BLOCKED_TOPICS = /\b(bitcoin|crypto|stock|politics|election|python|javascript|code|hack|dating|movie|song lyrics)\b/i;
/**
 * True when the message is likely a crop-health / farming question (any supported language).
 */
export function isAgricultureMessage(text) {
    const t = text.trim();
    if (!t)
        return true;
    if (BLOCKED_TOPICS.test(t))
        return false;
    if (AGRI_SIGNALS.test(t))
        return true;
    const classified = inputClassifierService.classifyText(t);
    if (classified.category !== 'unknown_low_conf')
        return true;
    if (classified.confidence >= 0.45)
        return true;
    // Substantive Indic symptom narrative (e.g. Hindi ginger leaf spots).
    if (hasIndicScript(t) && t.length >= 14)
        return true;
    return false;
}
/**
 * Route to Crop Doctor text diagnosis (same bar for English, Hindi, Malayalam, etc.).
 */
export function shouldRunCropDoctorTextDiagnosis(text) {
    const t = text.trim();
    if (t.length < 12)
        return false;
    if (!isAgricultureMessage(t))
        return false;
    const classified = inputClassifierService.classifyText(t);
    if (classified.category === 'disease_stress' ||
        classified.category === 'insect' ||
        classified.category === 'weed' ||
        classified.category === 'root_soil') {
        return true;
    }
    if (AGRI_SIGNALS.test(t) && t.length >= 15)
        return true;
    if (hasIndicScript(t) && t.length >= 18)
        return true;
    return t.length >= 25 && isAgricultureMessage(t);
}
/** Stable cross-language intent slug for reuse indexing / lookup. */
export function buildCrossLanguageIntentSlug(cropType, text, issueLabel) {
    const crop = cropType.toLowerCase().trim() || 'crop';
    const parts = [crop];
    const sources = [text, issueLabel ?? ''].join(' ').toLowerCase();
    if (/yellow|chlorosis|पीले|पील|peele|peela|pila|മഞ്ഞ|ಹಳದಿ|மஞ்சள்/i.test(sources))
        parts.push('yellow');
    if (/spot|blotch|lesion|धब्ब|dhabb|dabbe|പുള്ള|ಕಲೆ|புள்ளி/i.test(sources))
        parts.push('spot');
    if (/leaf|leaves|foliar|पत्त|patte|patta|ഇല|ಎಲೆ|இலை/i.test(sources))
        parts.push('leaf');
    if (/ginger|adrak|adhrak|inji|इंजी|ഇഞ്ചി/i.test(sources))
        parts.push('ginger');
    if (/wilt|wilting|മുരട|ವಾಡ|मुरझा/i.test(sources))
        parts.push('wilt');
    if (/rot|सड़|ചീച്ചൽ|sclerotium/i.test(sources))
        parts.push('rot');
    if (/sprout|shoot|tiller|chimb|chimbi|kana|kanaya|കണാ|കണ/i.test(sources))
        parts.push('sprout');
    if (parts.length < 2) {
        const label = issueLabel?.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 40);
        if (label && label.length >= 4)
            return `${crop}_${label}`;
        return null;
    }
    return parts.join('_');
}
export function pickLocalizedFarmerSummary(advisory, language) {
    const en = advisory.farmerSummaryEn?.trim() ?? '';
    const ml = advisory.farmerSummaryMl?.trim() ?? '';
    if (language === 'ml' && ml)
        return ml;
    if (en)
        return en;
    if (ml)
        return ml;
    return advisory.probableIssue?.trim() ?? '';
}
//# sourceMappingURL=crop-message-intent.service.js.map