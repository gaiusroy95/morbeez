export function resolveMatchConfidenceBand(score) {
    if (score >= 0.9)
        return 'high';
    if (score >= 0.7)
        return 'medium';
    return 'low';
}
export function needsMoreEvidence(ctx) {
    if (!ctx.hasPhoto)
        return true;
    if (ctx.matchConfidence < 0.7)
        return true;
    if (ctx.category === 'unknown_low_conf')
        return true;
    return false;
}
export function shouldSkipFollowUpIntake(ctx) {
    return ctx.matchConfidence >= 0.9 && ctx.hasPhoto && !needsMoreEvidence(ctx);
}
const BRANCH_AFTER_RAIN_YES = [
    {
        id: 'fungicide_after_rain',
        kind: 'spray_timing',
        textEn: 'When did you last spray fungicide on this crop?',
        textMl: 'ഈ വിളയിൽ അവസാനം fungicide spray എപ്പോഴാണ് ചെയ്തത്?',
    },
];
const BRANCH_SOFT_RHIZOME_YES = [
    {
        id: 'drainage_poor',
        kind: 'yes_no',
        textEn: 'Is water standing in the field or is drainage poor?',
        textMl: 'നിലത്ത് വെള്ളം നിൽക്കുന്നുണ്ടോ അല്ലെങ്കിൽ drainage മോശമാണോ?',
    },
];
function localize(q, lang) {
    if (lang === 'ml')
        return q.textMl;
    return q.textEn;
}
function issueFamily(label) {
    const t = (label ?? '').toLowerCase();
    if (/thrip|streak|silver/i.test(t))
        return 'thrips';
    if (/spot|phyllosticta|anthracnose|blotch/i.test(t))
        return 'leaf_spot';
    if (/blast|pyricularia/i.test(t))
        return 'blast';
    if (/rot|wilt|pythium|soft/i.test(t))
        return 'root_rot';
    if (/yellow|chlorosis|nutrient/i.test(t))
        return 'nutrient';
    return 'general';
}
function priorsForIssue(priors, family) {
    const hints = {
        thrips: /thrip|silver/i,
        leaf_spot: /spot|anthracnose|fungal/i,
        blast: /blast|pyricularia/i,
        root_rot: /rot|pythium|wilt/i,
        nutrient: /yellow|chlorosis|nutrient/i,
    };
    const re = hints[family];
    if (!re)
        return priors.slice(0, 2);
    return priors.filter((p) => re.test(p.issueLabel)).slice(0, 2);
}
export const diagnosisFollowUpReasoningEngine = {
    resolveMatchConfidenceBand,
    shouldSkipFollowUpIntake,
    needsMoreEvidence,
    buildIntro(ctx) {
        const count = Math.max(ctx.similarCases.length, ctx.totalVerifiedCases);
        const band = resolveMatchConfidenceBand(ctx.matchConfidence);
        const issue = ctx.bestIssueLabel;
        if (ctx.language === 'ml') {
            const caseLine = count > 0
                ? `മോർബീസിൽ ഈ ${ctx.cropType} വിളയിൽ ${count}+ വിജയകരമായ സമാന കേസുകൾ ഉണ്ട്.`
                : 'നിങ്ങളുടെ പ്രശ്നം കൃത്യമായി മനസ്സിലാക്കാൻ ചില ചോദ്യങ്ങൾ ചോദിക്കുന്നു.';
            const matchLine = issue ? `\nഏറ്റവും അടുത്ത പ്രശ്നം: ${issue}.` : '';
            const weatherLine = ctx.highHumidityLikely
                ? '\nഈ ആഴ്ച ഉയർന്ന humidity — fungal/blast അപകടം കൂടാം.'
                : ctx.heavyRainLikely
                    ? '\nമഴ അധികം — drainage/rot ശ്രദ്ധിക്കണം.'
                    : '';
            const confLine = band === 'medium'
                ? '\n\n2–3 ചെറിയ ചോദ്യങ്ങൾ — ശരിയായ ഉപദേശം നൽകാൻ:'
                : band === 'low'
                    ? '\n\nകൂടുതൽ വിവരം ശേഖരിക്കുന്നു (agronomist review ആവശ്യമാകാം):'
                    : '\n\nconfirmation ചോദ്യങ്ങൾ:';
            return `${caseLine}${matchLine}${weatherLine}${confLine}`;
        }
        const caseLine = count > 0
            ? `Morbeez found ${count}+ similar successful ${ctx.cropType} cases in your region.`
            : 'A few quick questions will help give accurate advice.';
        const matchLine = issue ? `\nClosest match: ${issue}.` : '';
        const weatherLine = ctx.highHumidityLikely
            ? '\nHigh humidity this week — fungal/blast risk may be elevated.'
            : ctx.heavyRainLikely
                ? '\nHeavy rain likely — check drainage and rot signs.'
                : '';
        const confLine = band === 'medium'
            ? '\n\nA few one-by-one questions for the most accurate advice:'
            : band === 'low'
                ? '\n\nGathering more field evidence (agronomist review may follow):'
                : '\n\nQuick confirmation questions:';
        return `${caseLine}${matchLine}${weatherLine}${confLine}`;
    },
    planQuestionSequence(ctx, maxQuestions) {
        const planned = [];
        const family = issueFamily(ctx.bestIssueLabel);
        const priors = priorsForIssue(ctx.diseasePriors, family);
        if (!ctx.hasPhoto) {
            planned.push({
                id: 'photo_close',
                kind: 'photo_close',
                textEn: 'Please send a **close, clear photo** of the affected leaf (or type skip).',
                textMl: 'ബാധിച്ച **ഇലയുടെ അടുത്ത, വ്യക്തമായ ഫോട്ടോ** അയയ്ക്കൂ (അല്ലെങ്കിൽ "skip" ടൈപ്പ് ചെയ്യൂ).',
            });
        }
        if (ctx.heavyRainLikely && !/rain|മഴ/i.test(ctx.symptomsText)) {
            planned.push({
                id: 'rain_recent',
                kind: 'yes_no',
                textEn: 'Has rainfall increased in your area in the last 7 days?',
                textMl: 'കഴിഞ്ഞ 7 ദിവസത്തിൽ നിങ്ങളുടെ പ്രദേശത്ത് മഴ കൂടിയോ?',
                skipHint: /rain|മഴ|wet|നന/i,
            });
        }
        if (ctx.highHumidityLikely && (family === 'leaf_spot' || family === 'blast')) {
            planned.push({
                id: 'spread_fast',
                kind: 'yes_no',
                textEn: 'Is the problem spreading quickly to many plants?',
                textMl: 'പ്രശ്നം വേഗത്തിൽ പല ചെടികളിലേക്ക് പടരുന്നുണ്ടോ?',
            });
        }
        if (family === 'leaf_spot') {
            planned.push({
                id: 'round_spots',
                kind: 'yes_no',
                textEn: 'Are spots round with yellow-brown edges?',
                textMl: 'പുള്ളികൾ വൃത്താകാരവും മഞ്ഞ-തവിട്ട അരികുകളുമാണോ?',
                skipHint: /round|circle|പുള്ളി/i,
            });
            if (ctx.heavyRainLikely) {
                planned.push({
                    id: 'after_rain',
                    kind: 'yes_no',
                    textEn: 'Did spots increase after recent rain?',
                    textMl: 'അടുത്തിടെ മഴ കഴിഞ്ഞ് പുള്ളി കൂടിയോ?',
                    skipHint: /rain|മഴ/i,
                });
            }
        }
        if (family === 'thrips') {
            planned.push({
                id: 'silver_streaks',
                kind: 'yes_no',
                textEn: 'Do you see silvery streaks or scraping on leaves?',
                textMl: 'ഇലയിൽ വെള്ള/വെള്ളിമിശ്രിത പട്ടയോ scrape ചിഹ്നങ്ങളോ?',
                skipHint: /silver|streak|വെള്ള/i,
            });
        }
        if (family === 'blast') {
            planned.push({
                id: 'water_soaked',
                kind: 'yes_no',
                textEn: 'Do leaves show water-soaked or burnt-looking patches?',
                textMl: 'ഇലയിൽ വെള്ളം പിടിച്ച അല്ലെങ്കിൽ കരിച്ച ഭാഗങ്ങളുണ്ടോ?',
            });
        }
        if (family === 'root_rot' || priors.some((p) => /rot|pythium/i.test(p.issueLabel))) {
            planned.push({
                id: 'soft_rhizome',
                kind: 'yes_no',
                textEn: 'Is the rhizome/underground part soft or smelly?',
                textMl: 'രൈസോം/അടിവേര് മൃദുവോ ദുർഗന്ധമോ?',
                skipHint: /rot|soft|smell|മൃദു/i,
            });
            if (!ctx.hasPhoto) {
                planned.push({
                    id: 'photo_rhizome',
                    kind: 'photo_rhizome',
                    textEn: 'If possible, send a photo of rhizome/root after washing (or type skip).',
                    textMl: 'സാധ്യമെങ്കിൽ കഴുകിയ rhizome/root ഫോട്ടോ അയയ്ക്കൂ (അല്ലെങ്കിൽ "skip").',
                });
            }
        }
        if (family === 'nutrient' || /yellow|chlorosis|മഞ്ഞ/i.test(ctx.symptomsText)) {
            planned.push({
                id: 'mulch_heat',
                kind: 'yes_no',
                textEn: 'Is thick mulch or straw covering the crop (possible heat stress under mulch)?',
                textMl: 'കനത്ത mulch/straw മൂടിയിട്ടുണ്ടോ (താഴെ heat stress സാധ്യത)?',
            });
            planned.push({
                id: 'new_growth_yellow',
                kind: 'yes_no',
                textEn: 'Are young new leaves more yellow than old leaves?',
                textMl: 'പുതിയ ഇലകൾ പഴയ ഇലകളേക്കാൾ കൂടുതൽ മഞ്ഞയാണോ?',
            });
        }
        if (!ctx.lastSprayKnown && (family === 'leaf_spot' || family === 'blast')) {
            planned.push({
                id: 'last_fungicide',
                kind: 'spray_timing',
                textEn: 'When did you last spray fungicide on this crop?',
                textMl: 'ഈ വിളയിൽ അവസാനം fungicide spray എപ്പോഴാണ് ചെയ്തത്?',
            });
        }
        if (ctx.dap != null && ctx.dap >= 120 && family === 'general') {
            planned.push({
                id: 'stage_late',
                kind: 'yes_no',
                textEn: `Crop is around ${ctx.dap} DAP — are symptoms mainly on older leaves?`,
                textMl: `വിള ~${ctx.dap} DAP — പഴയ ഇലകളിലാണോ പ്രധാന ലക്ഷണങ്ങൾ?`,
            });
        }
        const filtered = [];
        for (const q of planned) {
            if (q.skipHint && q.skipHint.test(ctx.symptomsText))
                continue;
            if (filtered.some((f) => f.id === q.id))
                continue;
            filtered.push(q);
            if (filtered.length >= maxQuestions)
                break;
        }
        if (!filtered.length && !ctx.hasPhoto) {
            filtered.push({
                id: 'photo_close',
                kind: 'photo_close',
                textEn: 'Please send a close photo of the affected part (or type skip).',
                textMl: 'ബാധിച്ച ഭാഗത്തിന്റെ അടുത്ത ഫോട്ടോ അയയ്ക്കൂ (അല്ലെങ്കിൽ "skip").',
            });
        }
        return filtered.slice(0, maxQuestions);
    },
    branchAfterAnswer(questionId, answer, ctx) {
        if (answer === 'skip')
            return [];
        if (questionId === 'rain_recent' && answer === 'yes') {
            return BRANCH_AFTER_RAIN_YES.filter((q) => !ctx.lastSprayKnown || q.id !== 'fungicide_after_rain');
        }
        if (questionId === 'after_rain' && answer === 'yes') {
            return BRANCH_AFTER_RAIN_YES;
        }
        if (questionId === 'soft_rhizome' && answer === 'yes') {
            return BRANCH_SOFT_RHIZOME_YES;
        }
        if (questionId === 'spread_fast' && answer === 'yes' && ctx.matchConfidence < 0.85) {
            return [
                {
                    id: 'field_percent',
                    kind: 'yes_no',
                    textEn: 'Is more than 20% of the field affected?',
                    textMl: 'നിലത്ത് 20% ൽ കൂടുതൽ ചെടികൾ ബാധിച്ചിട്ടുണ്ടോ?',
                },
            ];
        }
        return [];
    },
    toWhatsAppQuestion(q, lang) {
        const kind = q.kind === 'photo' || q.kind === 'photo_close' || q.kind === 'photo_rhizome'
            ? 'photo'
            : q.kind === 'spray_timing'
                ? 'spray_timing'
                : 'yes_no';
        return {
            id: q.id,
            kind,
            text: localize(q, lang),
        };
    },
    enrichSymptomsFromAnswers(initial, answers, ctx) {
        const parts = [initial.trim()];
        for (const [qid, ans] of Object.entries(answers)) {
            if (ans === 'skip')
                continue;
            parts.push(`${qid}=${ans}`);
        }
        if (ctx.bestIssueLabel)
            parts.push(`Closest learned case: ${ctx.bestIssueLabel}`);
        if (ctx.heavyRainLikely)
            parts.push('Weather: heavy rain likely');
        if (ctx.highHumidityLikely)
            parts.push('Weather: high humidity');
        if (ctx.dap != null)
            parts.push(`Crop stage: ${ctx.dap} DAP`);
        return parts.filter(Boolean).join('. ');
    },
    formatFieldInvestigationSummary(answers, ctx) {
        const lines = [
            'FIELD INVESTIGATION — farmer answered follow-up questions on WhatsApp.',
            'You MUST base probableIssue, treatments, and farmerSummary on these answers.',
            'Do NOT ignore them or return a generic template that contradicts them.',
            '',
        ];
        const label = {
            rain_recent: 'Rainfall increased in last 7 days',
            after_rain: 'Spots increased after recent rain',
            fungicide_after_rain: 'Fungicide spray after rain (follow-up)',
            last_fungicide: 'Last fungicide spray timing',
            spread_fast: 'Problem spreading quickly across plants',
            field_percent: 'More than 20% of field affected',
            round_spots: 'Spots are round with yellow-brown edges',
            silver_streaks: 'Silvery streaks / scrape marks on leaves',
            water_soaked: 'Water-soaked or burnt-looking leaf patches',
            soft_rhizome: 'Soft or smelly rhizome',
            drainage_poor: 'Poor drainage / standing water',
            mulch_heat: 'Thick mulch (possible heat under mulch)',
            new_growth_yellow: 'Young leaves more yellow than old',
            photo_close: 'Close leaf photo provided',
            photo_rhizome: 'Rhizome photo provided',
        };
        for (const [qid, ans] of Object.entries(answers)) {
            if (ans === 'skip')
                continue;
            const title = label[qid] ?? qid;
            const human = ans === 'yes'
                ? 'Yes'
                : ans === 'no'
                    ? 'No'
                    : ans === 'within_7d'
                        ? 'Within last 7 days'
                        : ans === 'over_14d'
                            ? '14+ days ago or never recently'
                            : ans === 'never'
                                ? 'Not yet / no fungicide'
                                : ans;
            lines.push(`- ${title}: ${human}`);
        }
        const inferred = this.inferPrimaryIssueFromIntake(ctx.symptomsText, answers, ctx.bestIssueLabel);
        const holistic = this.synthesizeAllAnswersConclusion(ctx.symptomsText, answers, ctx);
        lines.push('');
        lines.push(`Investigation conclusion (use as probableIssue unless image strongly contradicts): ${inferred}`);
        lines.push('');
        lines.push('INTEGRATED SYNTHESIS (all answers combined — farmerSummary MUST reflect this):');
        lines.push(holistic);
        if (ctx.bestIssueLabel) {
            lines.push('');
            lines.push(`Similar verified cases in Morbeez suggested: ${ctx.bestIssueLabel}`);
        }
        return lines.join('\n');
    },
    inferPrimaryIssueFromIntake(initialSymptoms, answers, bestIssueLabel) {
        const yes = (id) => answers[id] === 'yes';
        const no = (id) => answers[id] === 'no';
        const neverSprayed = answers['last_fungicide'] === 'never' ||
            answers['fungicide_after_rain'] === 'never' ||
            answers['last_fungicide'] === 'over_14d';
        const scores = {
            leaf_spot: 0,
            thrips: 0,
            blast_rot: 0,
            heat_stress: 0,
        };
        if (yes('round_spots'))
            scores.leaf_spot += 4;
        if (yes('after_rain') || yes('rain_recent'))
            scores.leaf_spot += 2;
        if (neverSprayed)
            scores.leaf_spot += 1;
        if (yes('spread_fast'))
            scores.leaf_spot += 1;
        if (yes('field_percent'))
            scores.leaf_spot += 1;
        if (yes('silver_streaks'))
            scores.thrips += 4;
        if (/silver|streak/i.test(initialSymptoms))
            scores.thrips += 2;
        if (no('round_spots'))
            scores.thrips += 2;
        if (yes('spread_fast') && !yes('round_spots'))
            scores.thrips += 1;
        if (yes('water_soaked'))
            scores.blast_rot += 3;
        if (yes('soft_rhizome'))
            scores.blast_rot += 3;
        if (yes('drainage_poor'))
            scores.blast_rot += 2;
        if (yes('mulch_heat'))
            scores.heat_stress += 2;
        if (yes('new_growth_yellow'))
            scores.heat_stress += 2;
        const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const [topKey, topScore] = ranked[0];
        if (topScore >= 3) {
            if (topKey === 'leaf_spot') {
                const parts = ['Fungal leaf spot (Phyllosticta / anthracnose)'];
                if (yes('rain_recent') || yes('after_rain'))
                    parts.push('rain-triggered spread');
                if (neverSprayed)
                    parts.push('no recent fungicide');
                if (yes('field_percent'))
                    parts.push('>20% field affected');
                return parts.join(' — ');
            }
            if (topKey === 'thrips')
                return 'Thrips damage — silvery streak pattern';
            if (topKey === 'blast_rot')
                return 'Foliar blast or rhizome rot — wet field stress';
            if (topKey === 'heat_stress')
                return 'Heat stress under mulch — not primary nutrient deficiency';
        }
        if (bestIssueLabel?.trim())
            return bestIssueLabel.trim();
        return 'Field issue — resolve using all investigation answers and image';
    },
    /** Single paragraph synthesizing every follow-up answer (not just one rule). */
    synthesizeAllAnswersConclusion(initialSymptoms, answers, ctx) {
        const yes = (id) => answers[id] === 'yes';
        const parts = [];
        parts.push(`Original complaint: ${initialSymptoms.trim().slice(0, 200)}.`);
        const facts = [];
        if (yes('rain_recent') || yes('after_rain'))
            facts.push('rain recently increased symptoms');
        if (answers['last_fungicide'] === 'never' || answers['fungicide_after_rain'] === 'never') {
            facts.push('farmer has not sprayed fungicide yet');
        }
        else if (answers['last_fungicide'] === 'within_7d') {
            facts.push('fungicide was sprayed within the last 7 days');
        }
        else if (answers['last_fungicide'] === 'over_14d') {
            facts.push('last fungicide spray was 14+ days ago');
        }
        if (yes('spread_fast'))
            facts.push('problem is spreading quickly');
        if (yes('field_percent'))
            facts.push('more than 20% of the field is affected (severe spread)');
        if (yes('round_spots'))
            facts.push('spots are round with yellow-brown edges (fungal pattern)');
        if (yes('silver_streaks'))
            facts.push('silvery streaks/scrape marks present');
        if (yes('water_soaked'))
            facts.push('water-soaked or burnt leaf patches');
        if (yes('soft_rhizome'))
            facts.push('soft or smelly rhizome');
        if (yes('drainage_poor'))
            facts.push('poor drainage / standing water');
        if (yes('mulch_heat'))
            facts.push('thick mulch may be causing heat stress');
        if (yes('new_growth_yellow'))
            facts.push('young leaves more yellow than old');
        if (facts.length) {
            parts.push(`All follow-up answers together: ${facts.join('; ')}.`);
        }
        else {
            parts.push('Follow-up answers recorded but no strong pattern flags.');
        }
        if (ctx.highHumidityLikely)
            parts.push('Regional weather: high humidity this week.');
        if (ctx.heavyRainLikely)
            parts.push('Regional weather: heavy rain likely.');
        const issue = this.inferPrimaryIssueFromIntake(initialSymptoms, answers, ctx.bestIssueLabel);
        parts.push(`Integrated conclusion (must reflect ALL answers above, not just the first symptom): ${issue}.`);
        return parts.join(' ');
    },
};
//# sourceMappingURL=diagnosis-follow-up-reasoning.engine.js.map