import { supabase } from '../../lib/supabase.js';
const MAX_SUMMARY_LEN = 180;
function firstSentence(text, max) {
    const trimmed = text.trim();
    const match = trimmed.match(/^[^.!?\n]+[.!?]?/);
    const sentence = (match?.[0] ?? trimmed).trim();
    return sentence.length > max ? `${sentence.slice(0, max - 3)}...` : sentence;
}
function parseProducts(products) {
    if (!Array.isArray(products) || !products.length)
        return {};
    const first = products[0];
    if (typeof first === 'string')
        return { tradeName: first, technicalName: first };
    if (first && typeof first === 'object') {
        const o = first;
        return {
            technicalName: String(o.technicalName ?? o.activeIngredient ?? o.productTitle ?? ''),
            tradeName: String(o.tradeName ?? o.productTitle ?? o.brand ?? ''),
        };
    }
    return {};
}
export function formatRecommendationDate(iso, lang) {
    if (!iso?.trim())
        return '';
    try {
        const locale = lang === 'ml'
            ? 'ml-IN'
            : lang === 'ta'
                ? 'ta-IN'
                : lang === 'kn'
                    ? 'kn-IN'
                    : lang === 'hi'
                        ? 'hi-IN'
                        : 'en-IN';
        return new Date(iso).toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }
    catch {
        return iso.slice(0, 10);
    }
}
export function summarizeDosageGuidance(items) {
    if (!items?.length)
        return '';
    const parts = items.slice(0, 2).map((d) => {
        const product = d.product?.trim() ?? '';
        const rate = d.rate?.trim() ?? '';
        const method = d.method?.trim();
        const methodHint = method && /foliar|spray|leaf|drench|soil/i.test(method) ? method : method || 'foliar spray';
        return [product, rate].filter(Boolean).join(' ') + (methodHint ? ` (${methodHint})` : '');
    });
    return parts.join('; ').slice(0, MAX_SUMMARY_LEN);
}
export function summarizeFromStructuredAdvisory(advisory, lang) {
    const dosage = summarizeDosageGuidance(advisory.dosageGuidance);
    if (dosage)
        return dosage;
    const localizedSummary = lang === 'ml' ? advisory.farmerSummaryMl : advisory.farmerSummaryEn;
    if (localizedSummary?.trim())
        return firstSentence(localizedSummary, MAX_SUMMARY_LEN);
    const treatment = advisory.treatments?.[0];
    if (treatment?.action?.trim()) {
        const timing = treatment.timing?.trim();
        const action = treatment.action.trim();
        return (timing ? `${action} (${timing})` : action).slice(0, MAX_SUMMARY_LEN);
    }
    return '';
}
export function summarizeFromRecommendationFields(rec) {
    const parts = [];
    if (rec.dosage?.trim())
        parts.push(rec.dosage.trim());
    const productMeta = parseProducts(rec.products);
    const productName = rec.trade_name?.trim() ||
        productMeta.tradeName?.trim() ||
        rec.technical_name?.trim() ||
        productMeta.technicalName?.trim();
    if (productName)
        parts.push(productName);
    const appType = rec.application_type?.trim();
    if (appType)
        parts.push(appType);
    if (parts.length)
        return parts.join(' — ').slice(0, MAX_SUMMARY_LEN);
    if (rec.recommendation_text?.trim()) {
        return firstSentence(rec.recommendation_text, MAX_SUMMARY_LEN);
    }
    return '';
}
const FALLBACK_ISSUE = {
    en: 'crop issue',
    ml: 'വിള പ്രശ്നം',
    ta: 'பயிர் பிரச்சனை',
    kn: 'ಬೆಳೆ ಸಮಸ್ಯೆ',
    hi: 'फसल की समस्या',
};
const FALLBACK_SUMMARY = {
    en: 'See your last Morbeez advisory message for spray details.',
    ml: 'സ്പ്രേ വിവരങ്ങൾക്ക് അവസാന മോർബീസ് ശുപാർശ നോക്കുക.',
    ta: 'தெளிப்பு விவரங்களுக்கு கடைசி Morbeez பரிந்துரையைப் பார்க்கவும்.',
    kn: 'ಸ್ಪ್ರೇ ವಿವರಗಳಿಗಾಗಿ ಕೊನೆಯ Morbeez ಶಿಫಾರಸು ನೋಡಿ.',
    hi: 'स्प्रे विवरण के लिए अपना आखिरी Morbeez सुझाव देखें।',
};
export function buildApplicationFollowUpContext(input) {
    const lang = input.lang;
    return {
        issueLabel: input.issueLabel?.trim() || FALLBACK_ISSUE[lang] || FALLBACK_ISSUE.en,
        recommendedOn: formatRecommendationDate(input.recommendedAt, lang),
        summary: input.summary?.trim() || FALLBACK_SUMMARY[lang] || FALLBACK_SUMMARY.en,
    };
}
export function contextFromRecommendationRecord(rec, lang) {
    return buildApplicationFollowUpContext({
        issueLabel: rec.issue_detected,
        recommendedAt: rec.communicated_at ?? rec.created_at,
        summary: summarizeFromRecommendationFields(rec),
        lang,
    });
}
const COPY = {
    en: {
        prompt: 'Have you applied this recommendation?',
        issue: 'Issue',
        date: 'Date',
        treatment: 'Foliar / treatment',
        closing: 'Please let us know so we can track results.',
    },
    ml: {
        prompt: 'ഈ ശുപാർശ പ്രയോഗിച്ചോ?',
        issue: 'പ്രശ്നം',
        date: 'തീയതി',
        treatment: 'ഫോളിയർ / ചികിത്സ',
        closing: 'ഫലം ട്രാക്ക് ചെയ്യാൻ അറിയിക്കുക.',
    },
    ta: {
        prompt: 'இந்த பரிந்துரையைப் பயன்படுத்தினீர்களா?',
        issue: 'பிரச்சனை',
        date: 'தேதி',
        treatment: 'தெளிப்பு / சிகிச்சை',
        closing: 'முடிவை கண்காணிக்க தெரிவிக்கவும்.',
    },
    kn: {
        prompt: 'ಈ ಶಿಫಾರಸನ್ನು ಅನ್ವಯಿಸಿದ್ದೀರಾ?',
        issue: 'ಸಮಸ್ಯೆ',
        date: 'ದಿನಾಂಕ',
        treatment: 'ಫೋಲಿಯರ್ / ಚಿಕಿತ್ಸೆ',
        closing: 'ಫಲಿತಾಂಶ ಟ್ರ್ಯಾಕ್ ಮಾಡಲು ತಿಳಿಸಿ.',
    },
    hi: {
        prompt: 'क्या आपने यह सिफारिश लागू की?',
        issue: 'समस्या',
        date: 'तारीख',
        treatment: 'फोलियर / उपचार',
        closing: 'परिणाम ट्रैक करने के लिए बताएं।',
    },
};
export function formatApplicationCheckMessage(lang, ctx) {
    const labels = COPY[lang] ?? COPY.en;
    const lines = [labels.prompt, '', `${labels.issue}: ${ctx.issueLabel}`];
    if (ctx.recommendedOn)
        lines.push(`${labels.date}: ${ctx.recommendedOn}`);
    if (ctx.summary)
        lines.push(`${labels.treatment}: ${ctx.summary}`);
    lines.push('', labels.closing);
    return lines.join('\n');
}
async function loadFromAdvisorySession(sessionId, lang) {
    const [{ data: session }, { data: outputs }] = await Promise.all([
        supabase
            .from('ai_advisory_sessions')
            .select('created_at, symptoms_text')
            .eq('id', sessionId)
            .maybeSingle(),
        supabase
            .from('ai_advisory_outputs')
            .select('probable_issue, farmer_summary_en, farmer_summary_ml, dosage_guidance, raw_response, created_at')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(1),
    ]);
    const output = outputs?.[0];
    if (!output && !session)
        return null;
    const raw = (output?.raw_response ?? {});
    const advisory = {
        ...raw,
        probableIssue: String(output?.probable_issue ?? raw.probableIssue ?? '').trim() || undefined,
        farmerSummaryEn: String(output?.farmer_summary_en ?? raw.farmerSummaryEn ?? '').trim() || undefined,
        farmerSummaryMl: String(output?.farmer_summary_ml ?? raw.farmerSummaryMl ?? '').trim() || undefined,
        dosageGuidance: output?.dosage_guidance ?? raw.dosageGuidance ?? [],
    };
    return buildApplicationFollowUpContext({
        issueLabel: advisory.probableIssue || session?.symptoms_text,
        recommendedAt: session?.created_at ?? output?.created_at,
        summary: summarizeFromStructuredAdvisory(advisory, lang),
        lang,
    });
}
async function loadLatestRecommendationForFarmer(farmerId, lang) {
    const { data } = await supabase
        .from('recommendation_records')
        .select(`issue_detected, recommendation_text, products, dosage, application_type, technical_name, trade_name,
       communicated_at, created_at`)
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!data)
        return null;
    return contextFromRecommendationRecord(data, lang);
}
export async function loadApplicationFollowUpContext(params) {
    const { farmerId, lang, advisorySessionId, recommendationRecordId } = params;
    if (recommendationRecordId) {
        const { data } = await supabase
            .from('recommendation_records')
            .select(`issue_detected, recommendation_text, products, dosage, application_type, technical_name, trade_name,
         communicated_at, created_at`)
            .eq('id', recommendationRecordId)
            .maybeSingle();
        if (data)
            return contextFromRecommendationRecord(data, lang);
    }
    if (advisorySessionId) {
        const fromSession = await loadFromAdvisorySession(advisorySessionId, lang);
        if (fromSession)
            return fromSession;
    }
    const latest = await loadLatestRecommendationForFarmer(farmerId, lang);
    if (latest)
        return latest;
    return buildApplicationFollowUpContext({ lang });
}
//# sourceMappingURL=application-follow-up-message.util.js.map