import { buildLooseSymptomKey, buildSymptomKey, } from '../ai/question-reuse-keys.util.js';
function normalizeTextKey(text) {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
}
export function textsLikelySame(a, b) {
    if (!a?.trim() || !b?.trim())
        return false;
    const na = normalizeTextKey(a);
    const nb = normalizeTextKey(b);
    if (na === nb)
        return true;
    if (buildLooseSymptomKey(a) === buildLooseSymptomKey(b))
        return true;
    if (buildSymptomKey(a) === buildSymptomKey(b))
        return true;
    if (na.length >= 12 && nb.length >= 12) {
        return na.includes(nb) || nb.includes(na);
    }
    if (na.length >= 4 && nb.length >= 4) {
        const ta = new Set(na.split(' ').filter((w) => w.length >= 3));
        const tb = new Set(nb.split(' ').filter((w) => w.length >= 3));
        if (ta.size && tb.size) {
            let overlap = 0;
            for (const w of ta)
                if (tb.has(w))
                    overlap += 1;
            if (overlap / Math.min(ta.size, tb.size) >= 0.6)
                return true;
        }
    }
    return false;
}
export function pickLatestOutput(outputs) {
    const rows = (outputs ?? []);
    if (!rows.length)
        return undefined;
    return [...rows].sort((a, b) => {
        const ta = new Date(String(a.created_at ?? 0)).getTime();
        const tb = new Date(String(b.created_at ?? 0)).getTime();
        return tb - ta;
    })[0];
}
export function resolveFarmerQuestion(sessionRow) {
    const parts = [sessionRow?.symptoms_text, sessionRow?.voice_transcript]
        .map((v) => (v != null ? String(v).trim() : ''))
        .filter(Boolean);
    return parts.join(' ').trim();
}
export function pickFarmerFacingSummary(output, language) {
    if (!output)
        return '';
    const en = output.farmer_summary_en != null ? String(output.farmer_summary_en).trim() : '';
    const ml = output.farmer_summary_ml != null ? String(output.farmer_summary_ml).trim() : '';
    if (language === 'ml' && ml)
        return ml;
    return en || ml;
}
export function resolveProbableIssue(output, sessionProbable, farmerQuestion) {
    const candidates = [
        output?.probable_issue != null ? String(output.probable_issue).trim() : '',
        sessionProbable?.trim() ?? '',
    ].filter(Boolean);
    for (const c of candidates) {
        if (!textsLikelySame(c, farmerQuestion))
            return c;
    }
    return null;
}
export function mapRecordSeverityToUi(severity) {
    if (severity === 'low')
        return 'mild';
    if (severity === 'medium')
        return 'moderate';
    if (severity === 'high')
        return 'severe';
    return undefined;
}
export function mapUiSeverityToRecord(severity) {
    if (severity === 'mild')
        return 'low';
    if (severity === 'moderate')
        return 'medium';
    if (severity === 'severe')
        return 'high';
    return null;
}
export function parseEscalationCorrection(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const c = raw;
    const sev = c.severity;
    const severity = sev === 'mild' || sev === 'moderate' || sev === 'severe' ? sev : undefined;
    return {
        action: c.action != null ? String(c.action) : undefined,
        correctDiagnosis: c.correctDiagnosis != null ? String(c.correctDiagnosis) : null,
        severity: severity ?? null,
        recommendationId: c.recommendationId != null ? String(c.recommendationId) : null,
    };
}
//# sourceMappingURL=case-review-inquiry.util.js.map