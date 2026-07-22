/**
 * Ginger advisory workflow — sample soil reports and scenario metadata for QA / AI training.
 * Seeded in DB via migration 20260722000000_ginger_advisory_soil_samples.sql
 */
/** Farmer phone for advisory QA samples (last 10 digits: 6282873542). */
export const GINGER_ADVISORY_SAMPLE_PHONE = '+916282873542';
export const GINGER_ADVISORY_SAMPLE_PHONE_DIGITS = '6282873542';
export const GINGER_ADVISORY_SAMPLE_BLOCKS = {
    rhizomeRot: 'e0000000-0000-4000-8000-000000000011',
    nutrientDeficiency: 'e0000000-0000-4000-8000-000000000012',
    waterloggingE2e: 'e0000000-0000-4000-8000-000000000013',
};
function m(value, unit = '') {
    return { value, unit };
}
export const GINGER_ADVISORY_SCENARIOS = [
    {
        id: 'rhizomeRot',
        title: 'Scenario 1 — Rhizome Rot Risk',
        crop: 'ginger',
        stage: 'Vegetative',
        das: 90,
        blockId: GINGER_ADVISORY_SAMPLE_BLOCKS.rhizomeRot,
        soilReportId: 'e0000000-0000-4000-8000-000000000021',
        metrics: {
            version: 2,
            soilType: 'Laterite/Red Soil',
            remarks: 'Advisory sample S1 — rhizome rot risk after prolonged rainfall',
            macro: {
                ph: m('5.8'),
                ec: m('0.6', 'dS/m'),
                organicCarbon: m('0.9', '%'),
                nitrogen: m('280', 'kg/ha'),
                phosphorus: m('42', 'kg/ha'),
                potassium: m('310', 'kg/ha'),
                calcium: m('350', 'ppm'),
                magnesium: m('', 'ppm'),
                sulfur: m('', 'ppm'),
                sodium: m('', 'meq/100g'),
            },
            micro: {
                zinc: m('1.2', 'ppm'),
                boron: m('', 'ppm'),
                iron: m('', 'ppm'),
                manganese: m('', 'ppm'),
                copper: m('', 'ppm'),
                molybdenum: m('', 'ppm'),
            },
        },
        fieldObservations: [
            'Yellowing patches',
            'Wilting plants',
            'Some pseudostems collapsing',
        ],
        weatherNotes: 'Heavy rainfall for last 10 days',
        expectedIssues: ['Rhizome Rot'],
        testPurpose: 'Disease detection + photo validation',
    },
    {
        id: 'nutrientDeficiency',
        title: 'Scenario 2 — Potassium & Magnesium Deficiency',
        crop: 'ginger',
        stage: 'Rhizome Development',
        das: 150,
        blockId: GINGER_ADVISORY_SAMPLE_BLOCKS.nutrientDeficiency,
        soilReportId: 'e0000000-0000-4000-8000-000000000022',
        metrics: {
            version: 2,
            soilType: 'Loamy',
            remarks: 'Advisory sample S2 — low K and Mg; AI should avoid misdiagnosing as disease',
            macro: {
                ph: m('7.3'),
                ec: m('0.5', 'dS/m'),
                organicCarbon: m('0.45', '%'),
                nitrogen: m('260', 'kg/ha'),
                phosphorus: m('35', 'kg/ha'),
                potassium: m('85', 'kg/ha'),
                calcium: m('', 'ppm'),
                magnesium: m('45', 'ppm'),
                sulfur: m('', 'ppm'),
                sodium: m('', 'meq/100g'),
            },
            micro: {
                zinc: m('0.8', 'ppm'),
                boron: m('', 'ppm'),
                iron: m('', 'ppm'),
                manganese: m('', 'ppm'),
                copper: m('', 'ppm'),
                molybdenum: m('', 'ppm'),
            },
        },
        fieldObservations: ['Leaf edge scorching', 'Yellow margins', 'Reduced vigor'],
        weatherNotes: 'Normal seasonal rainfall',
        expectedIssues: ['Potassium Deficiency', 'Magnesium Deficiency'],
        testPurpose: 'Soil-report-driven diagnosis (not disease)',
    },
    {
        id: 'waterloggingE2e',
        title: 'Scenario 3 — Waterlogging + Rot + Nutrient Issues',
        crop: 'ginger',
        stage: 'Vegetative',
        das: 120,
        blockId: GINGER_ADVISORY_SAMPLE_BLOCKS.waterloggingE2e,
        soilReportId: 'e0000000-0000-4000-8000-000000000023',
        metrics: {
            version: 2,
            soilType: 'Clay',
            remarks: 'Advisory sample S3 — full E2E: waterlogging, early rot, N and Zn deficiency',
            macro: {
                ph: m('8.2'),
                ec: m('2.2', 'dS/m'),
                organicCarbon: m('0.28', '%'),
                nitrogen: m('110', 'kg/ha'),
                phosphorus: m('18', 'kg/ha'),
                potassium: m('95', 'kg/ha'),
                calcium: m('140', 'ppm'),
                magnesium: m('', 'ppm'),
                sulfur: m('', 'ppm'),
                sodium: m('', 'meq/100g'),
            },
            micro: {
                zinc: m('0.3', 'ppm'),
                boron: m('', 'ppm'),
                iron: m('', 'ppm'),
                manganese: m('', 'ppm'),
                copper: m('', 'ppm'),
                molybdenum: m('', 'ppm'),
            },
        },
        fieldObservations: [
            'Standing water',
            'Yellowing leaves',
            'Stunted growth',
            'Some soft rhizomes',
        ],
        weatherNotes: 'Prolonged wet spell; poor drainage in low-lying areas',
        expectedIssues: [
            'Waterlogging Stress',
            'Early Rhizome Rot',
            'Nitrogen Deficiency',
            'Zinc Deficiency',
        ],
        testPurpose: 'Full workflow — multi-issue, rec groups, monitoring, follow-up Q&A',
    },
];
export function getGingerAdvisoryScenario(id) {
    const row = GINGER_ADVISORY_SCENARIOS.find((s) => s.id === id);
    if (!row)
        throw new Error(`Unknown ginger advisory scenario: ${id}`);
    return row;
}
//# sourceMappingURL=ginger-advisory-samples.js.map