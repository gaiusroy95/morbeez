/** Shared symptom text patterns — crop-aware where streak semantics differ. */
export function hasPestSilverStreakEvidence(text, cropType) {
    const t = text.toLowerCase();
    const crop = (cropType ?? '').toLowerCase();
    if (/thrip|scraping|scraped|silvery|silver.?white|bleaching/.test(t)) {
        return /streak|scrap|thrip|silv/.test(t);
    }
    if (crop.includes('banana')) {
        return false;
    }
    return /silver.{0,12}streak|silvery.{0,8}streak|scraping.{0,8}mark/.test(t);
}
export function hasYellowStreakEvidence(text) {
    const t = text.toLowerCase();
    return /yellow streak|leaf streak|parallel streak|sigatoka|mycosphaerella/.test(t);
}
//# sourceMappingURL=symptom-evidence-patterns.js.map