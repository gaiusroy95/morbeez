function clampScore(n) {
    return Math.max(0, Math.min(100, Math.round(n)));
}
function bandFor(score) {
    if (score >= 80)
        return 'HOT';
    if (score >= 50)
        return 'WARM';
    return 'COLD';
}
/** Rule-based lead score. Missing fields stay COLD rather than inventing data. */
export function scoreQualification(answers) {
    let score = 0;
    if (answers.hasName && answers.hasPhone)
        score += 15;
    else if (answers.hasPhone)
        score += 8;
    if (answers.hasLocation)
        score += 5;
    if (answers.crop?.trim())
        score += 15;
    if (answers.acres != null && answers.acres > 0)
        score += 10;
    if (answers.cropAgeDays != null && answers.cropAgeDays >= 0)
        score += 10;
    if (answers.problemStated)
        score += 20;
    if (answers.requirementStated)
        score += 15;
    if (answers.marketingSource?.trim())
        score += 5;
    if (answers.availabilityStated)
        score += 10;
    const total = clampScore(score);
    return { score: total, band: bandFor(total), answers };
}
export function parseAcres(raw) {
    if (!raw)
        return null;
    const n = Number(String(raw).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
}
export function parseCropAgeDays(raw) {
    if (!raw)
        return null;
    const text = raw.toLowerCase();
    const month = text.match(/(\d+(?:\.\d+)?)\s*(month|മാസ|माह|மாதம்|ತಿಂಗಳು)/u);
    if (month)
        return Math.round(Number(month[1]) * 30);
    const day = text.match(/(\d+)\s*(day|dap|ദിവസ|दिन|நாள்|ದಿನ)/u);
    if (day)
        return Number(day[1]);
    const n = Number(text.replace(/[^\d]/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : null;
}
//# sourceMappingURL=qualification-score.js.map