import { EMPLOYEE_PERFORMANCE_WEIGHTS } from './opportunity-intelligence.types.js';
export const MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD = 10;
function clamp(n, max) {
    return Math.max(0, Math.min(max, Math.round(n)));
}
export function scoreEngagementGrowth(signals) {
    const max = EMPLOYEE_PERFORMANCE_WEIGHTS.engagementGrowth;
    const factors = [];
    let raw = 0;
    const growth = signals.inboundEventsPrev30d > 0
        ? (signals.inboundEvents30d - signals.inboundEventsPrev30d) / signals.inboundEventsPrev30d
        : signals.inboundEvents30d > 0
            ? 1
            : 0;
    if (growth > 0.25) {
        raw += 10;
        factors.push({ code: 'eng_growth', label: 'Farmer inbound engagement grew (30d)', delta: 10 });
    }
    else if (signals.inboundEvents30d >= 5) {
        raw += 7;
        factors.push({
            code: 'eng_inbound',
            label: `${signals.inboundEvents30d} farmer inbound events (30d)`,
            delta: 7,
        });
    }
    else if (signals.inboundEvents30d > 0) {
        raw += 4;
    }
    raw += Math.min(6, signals.outboundEvents30d * 0.3);
    raw += Math.min(4, signals.crmTasksCompleted30d * 2);
    if (signals.crmTasksCompleted30d > 0) {
        factors.push({
            code: 'eng_crm_tasks',
            label: 'CRM follow-ups completed',
            delta: Math.min(4, signals.crmTasksCompleted30d * 2),
            evidence: { count: signals.crmTasksCompleted30d },
        });
    }
    return { score: clamp(raw, max), factors };
}
export function scoreRelationshipQuality(signals) {
    const max = EMPLOYEE_PERFORMANCE_WEIGHTS.relationshipQuality;
    if (signals.avgFarmerRelationshipScore == null || signals.attributedFarmerCount === 0) {
        return {
            score: signals.attributedFarmerCount > 0 ? 6 : 0,
            factors: [{ code: 'rel_pending', label: 'Relationship scores pending farmer engine run', delta: 0 }],
        };
    }
    const pct = signals.avgFarmerRelationshipScore / 10;
    const score = clamp(pct * max, max);
    return {
        score,
        factors: [
            {
                code: 'rel_avg',
                label: `Avg relationship component across ${signals.attributedFarmerCount} farmers`,
                delta: score,
                evidence: { avgComponent: signals.avgFarmerRelationshipScore },
            },
        ],
    };
}
export function scoreRetentionQuality(signals) {
    const max = EMPLOYEE_PERFORMANCE_WEIGHTS.retentionQuality;
    if (signals.healthyRetentionPct == null || signals.attributedFarmerCount === 0) {
        return { score: 0, factors: [{ code: 'ret_no_data', label: 'No retention data yet', delta: 0 }] };
    }
    const score = clamp(signals.healthyRetentionPct * max, max);
    return {
        score,
        factors: [
            {
                code: 'ret_healthy_pct',
                label: `${Math.round(signals.healthyRetentionPct * 100)}% farmers healthy/watch`,
                delta: score,
            },
        ],
    };
}
export function scoreTrustBuilding(signals) {
    const max = EMPLOYEE_PERFORMANCE_WEIGHTS.trustBuilding;
    let raw = Math.min(9, signals.trustEvents90d * 2);
    raw += Math.min(6, signals.recommendationsApproved90d * 3);
    const factors = [];
    if (signals.trustEvents90d > 0) {
        factors.push({
            code: 'trust_events',
            label: 'ROI / applied recommendation events on attributed farmers',
            delta: Math.min(9, signals.trustEvents90d * 2),
        });
    }
    return { score: clamp(raw, max), factors };
}
export function scoreDelayedConversion(signals) {
    const max = EMPLOYEE_PERFORMANCE_WEIGHTS.delayedConversion;
    const score = clamp(signals.conversionAssists180d * 3, max);
    return {
        score,
        factors: signals.conversionAssists180d > 0
            ? [
                {
                    code: 'conversion_assist',
                    label: 'Conversion assist attributions (180d)',
                    delta: score,
                    evidence: { count: signals.conversionAssists180d },
                },
            ]
            : [{ code: 'conversion_none', label: 'No attributed conversions yet', delta: 0 }],
    };
}
export function scoreFarmerReactivation(signals) {
    const max = EMPLOYEE_PERFORMANCE_WEIGHTS.farmerReactivation;
    const score = clamp(signals.reactivations90d * 4, max);
    return {
        score,
        factors: signals.reactivations90d > 0
            ? [{ code: 'reactivation', label: 'Farmer reactivations credited', delta: score }]
            : [],
    };
}
export function scoreKnowledgeContribution(signals) {
    const max = EMPLOYEE_PERFORMANCE_WEIGHTS.knowledgeContribution;
    let raw = Math.min(3, signals.recommendationsApproved90d * 2);
    raw += Math.min(2, signals.recommendationsCommunicated90d);
    raw += Math.min(2, signals.activityEvidence30d * 0.5);
    return {
        score: clamp(raw, max),
        factors: raw > 0
            ? [{ code: 'knowledge', label: 'Recommendations approved/communicated', delta: clamp(raw, max) }]
            : [],
    };
}
export function scoreFarmerSatisfaction(signals) {
    const max = EMPLOYEE_PERFORMANCE_WEIGHTS.farmerSatisfaction;
    const score = clamp(signals.positiveOutcomes90d * 2, max);
    return {
        score,
        factors: signals.positiveOutcomes90d > 0
            ? [{ code: 'satisfaction', label: 'Positive recommendation outcomes', delta: score }]
            : [],
    };
}
export function computeEmployeeScoreComponents(signals) {
    const g = scoreEngagementGrowth(signals);
    const rq = scoreRelationshipQuality(signals);
    const ret = scoreRetentionQuality(signals);
    const trust = scoreTrustBuilding(signals);
    const conv = scoreDelayedConversion(signals);
    const react = scoreFarmerReactivation(signals);
    const know = scoreKnowledgeContribution(signals);
    const sat = scoreFarmerSatisfaction(signals);
    const factors = [
        ...g.factors,
        ...rq.factors,
        ...ret.factors,
        ...trust.factors,
        ...conv.factors,
        ...react.factors,
        ...know.factors,
        ...sat.factors,
    ];
    if (signals.attributedFarmerCount < MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD) {
        factors.push({
            code: 'sample_size',
            label: `Building sample (${signals.attributedFarmerCount}/${MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD} attributed farmers for leaderboard)`,
            evidence: { attributedFarmerCount: signals.attributedFarmerCount },
        });
    }
    return {
        components: {
            engagementGrowth: g.score,
            relationshipQuality: rq.score,
            retentionQuality: ret.score,
            trustBuilding: trust.score,
            delayedConversion: conv.score,
            farmerReactivation: react.score,
            knowledgeContribution: know.score,
            farmerSatisfaction: sat.score,
        },
        factors,
    };
}
export function performanceBreakdownFromComponents(components) {
    return [
        {
            label: 'Engagement growth',
            pct: Math.round((components.engagementGrowth / EMPLOYEE_PERFORMANCE_WEIGHTS.engagementGrowth) * 100),
        },
        {
            label: 'Relationship quality',
            pct: Math.round((components.relationshipQuality / EMPLOYEE_PERFORMANCE_WEIGHTS.relationshipQuality) * 100),
        },
        {
            label: 'Retention quality',
            pct: Math.round((components.retentionQuality / EMPLOYEE_PERFORMANCE_WEIGHTS.retentionQuality) * 100),
        },
        {
            label: 'Trust building',
            pct: Math.round((components.trustBuilding / EMPLOYEE_PERFORMANCE_WEIGHTS.trustBuilding) * 100),
        },
        {
            label: 'Delayed conversion',
            pct: Math.round((components.delayedConversion / EMPLOYEE_PERFORMANCE_WEIGHTS.delayedConversion) * 100),
        },
        {
            label: 'Farmer reactivation',
            pct: Math.round((components.farmerReactivation / EMPLOYEE_PERFORMANCE_WEIGHTS.farmerReactivation) * 100),
        },
        {
            label: 'Knowledge contribution',
            pct: Math.round((components.knowledgeContribution / EMPLOYEE_PERFORMANCE_WEIGHTS.knowledgeContribution) * 100),
        },
        {
            label: 'Farmer satisfaction',
            pct: Math.round((components.farmerSatisfaction / EMPLOYEE_PERFORMANCE_WEIGHTS.farmerSatisfaction) * 100),
        },
    ];
}
export function performanceLabel(score) {
    if (score >= 90)
        return 'Excellent';
    if (score >= 80)
        return 'Very Good';
    if (score >= 70)
        return 'Good';
    if (score >= 60)
        return 'Average';
    return 'Needs improvement';
}
//# sourceMappingURL=employee-performance-scoring.util.js.map