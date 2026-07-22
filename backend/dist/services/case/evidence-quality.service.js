import { cropPackLoaderService } from '../crop-pack/crop-pack-loader.service.js';
function clamp(n, min = 0, max = 100) {
    return Math.max(min, Math.min(max, n));
}
function inferSlotFromCaption(caption, pack) {
    if (!caption?.trim())
        return null;
    const t = caption.toLowerCase();
    if (/root|വേര|வேர்|ಬೇರು|जड़/.test(t)) {
        return pack.rootPhotoSlots[0] ?? 'root_zone';
    }
    if (/rhizome|റൈസോം|राइजोम/.test(t))
        return 'rhizome_outside';
    if (/underside|അടിവശ|அடி|नीचे/.test(t))
        return 'leaf_underside';
    if (/healthy|ആരോഗ്യ|ஆரோக்கிய/.test(t))
        return 'healthy_zone';
    if (/field|വയൽ|வயல்|खेत/.test(t))
        return 'field_wide';
    if (/affected|ബാധ|பாதிப்ப|बाढ़/.test(t))
        return 'affected_zone';
    return null;
}
function baseQualityForChannel(channel) {
    if (channel === 'field_visit')
        return 85;
    if (channel === 'whatsapp')
        return 62;
    return 70;
}
export const evidenceQualityService = {
    assignPhotosToSlots(params) {
        const order = cropPackLoaderService.whatsappSlotOrder(params.pack);
        const used = new Set(params.existingSlots ?? []);
        const captured = [];
        for (let i = 0; i < params.photoCount; i++) {
            const captionSlot = inferSlotFromCaption(params.captions?.[i], params.pack);
            let slot = captionSlot;
            if (!slot || used.has(slot)) {
                slot = order.find((s) => !used.has(s)) ?? null;
            }
            if (!slot)
                break;
            used.add(slot);
            captured.push({
                slot,
                status: 'captured',
                qualityScore: clamp(baseQualityForChannel(params.channel) - i * 2),
                storagePath: params.storagePaths?.[i],
            });
        }
        return params.pack.photoSlots.map((def) => {
            const hit = captured.find((c) => c.slot === def.id);
            if (hit)
                return hit;
            return { slot: def.id, status: 'missing', qualityScore: 0 };
        });
    },
    completenessPct(photos, slotCount) {
        const captured = photos.filter((p) => p.status === 'captured');
        if (!captured.length)
            return 0;
        const weightSum = captured.reduce((sum, p) => sum + p.qualityScore, 0);
        const maxWeight = slotCount * 100;
        return clamp(Math.round((weightSum / maxWeight) * 100 + captured.length * 4));
    },
    evidenceTier(completenessPct, hasSoil, hasRootPhoto, hasFieldMetrics) {
        if (hasFieldMetrics && hasSoil && hasRootPhoto && completenessPct >= 75)
            return 'T5';
        if (hasSoil && hasRootPhoto && completenessPct >= 50)
            return 'T4';
        if (hasRootPhoto && completenessPct >= 35)
            return 'T3';
        if (hasSoil && completenessPct >= 25)
            return 'T2';
        if (completenessPct >= 15)
            return 'T1';
        return 'T0';
    },
    /** Unified EQS 0–100 from completeness + tier bonuses */
    computeEqs(params) {
        let eqs = params.completenessPct * 0.55;
        const tierBonus = {
            T0: 0,
            T1: 8,
            T2: 15,
            T3: 22,
            T4: 30,
            T5: 38,
        };
        eqs += tierBonus[params.tier];
        if (params.hasSoil)
            eqs += 8;
        if (params.hasRootPhoto)
            eqs += 10;
        if (params.hasFieldMetrics)
            eqs += 12;
        if (params.hasWaterData)
            eqs += 5;
        if (params.hasLabReport)
            eqs += 7;
        return clamp(Math.round(eqs));
    },
    missingSlotPrompt(pack, language, slots) {
        const defs = pack.photoSlots.filter((s) => slots.includes(s.id));
        const lines = defs.map((d) => (language === 'ml' ? d.labelMl : d.labelEn));
        if (language === 'ml') {
            return `കൂടുതൽ വ്യക്തതയ്ക്ക് ഈ ഫോട്ടോകൾ അയയ്ക്കുക:\n• ${lines.join('\n• ')}`;
        }
        return `For a stronger diagnosis, please send:\n• ${lines.join('\n• ')}`;
    },
};
//# sourceMappingURL=evidence-quality.service.js.map