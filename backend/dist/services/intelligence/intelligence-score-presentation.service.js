import { FARMER_OPPORTUNITY_WEIGHTS, EMPLOYEE_PERFORMANCE_WEIGHTS } from './opportunity-intelligence.types.js';
function to100(points, max) {
    if (max <= 0)
        return 0;
    return Math.round(Math.max(0, Math.min(100, (points / max) * 100)));
}
/** Blend acre size + potential into single "Acre Potential" display (spec examples). */
function acrePotentialDisplay100(components) {
    const size100 = to100(components.acreSize, FARMER_OPPORTUNITY_WEIGHTS.acreSize);
    const pot100 = to100(components.acrePotential, FARMER_OPPORTUNITY_WEIGHTS.acrePotential);
    return Math.round(size100 * 0.35 + pot100 * 0.65);
}
export function buildFarmerMetrics100(components, retentionScore100) {
    return [
        {
            key: 'engagement',
            label: 'Engagement',
            score: to100(components.engagement, FARMER_OPPORTUNITY_WEIGHTS.engagement),
            max: 100,
        },
        {
            key: 'trust',
            label: 'Trust',
            score: to100(components.trust, FARMER_OPPORTUNITY_WEIGHTS.trust),
            max: 100,
        },
        {
            key: 'relationship',
            label: 'Relationship',
            score: to100(components.relationship, FARMER_OPPORTUNITY_WEIGHTS.relationship),
            max: 100,
        },
        {
            key: 'acrePotential',
            label: 'Acre Potential',
            score: acrePotentialDisplay100(components),
            max: 100,
        },
        {
            key: 'advisoryCooperation',
            label: 'Advisory Cooperation',
            score: to100(components.advisoryCooperation, FARMER_OPPORTUNITY_WEIGHTS.advisoryCooperation),
            max: 100,
        },
        {
            key: 'retentionStability',
            label: 'Retention Stability',
            score: retentionScore100 ?? 50,
            max: 100,
        },
    ];
}
export function classifyFarmer(opportunityScore, metrics) {
    const m = Object.fromEntries(metrics.map((x) => [x.key, x.score]));
    const eng = m.engagement ?? 0;
    const trust = m.trust ?? 0;
    const rel = m.relationship ?? 0;
    const acre = m.acrePotential ?? 0;
    const ret = m.retentionStability ?? 0;
    const adv = m.advisoryCooperation ?? 0;
    if (opportunityScore >= 85 && eng >= 72 && trust >= 72) {
        return 'Premium High-ROI Farmer';
    }
    if (trust >= 82 && rel >= 80 && acre < 78 && opportunityScore >= 78) {
        return 'Strategic Long-Term Farmer';
    }
    if (opportunityScore >= 78 && acre >= 75 && ret >= 70) {
        return 'Future Premium Farmer';
    }
    if (acre >= 70 && eng < 45 && trust < 55 && ret < 45) {
        return 'Weak Long-Term Relationship';
    }
    if (opportunityScore < 40 || (eng < 30 && trust < 30)) {
        return 'High-Risk Farmer';
    }
    if (opportunityScore >= 65 && adv >= 55) {
        return 'Developing Opportunity Farmer';
    }
    return 'Moderate Relationship Farmer';
}
export function farmerBusinessInsight(classification, metrics, opportunityScore) {
    const acre = metrics.find((m) => m.key === 'acrePotential')?.score ?? 0;
    const eng = metrics.find((m) => m.key === 'engagement')?.score ?? 0;
    switch (classification) {
        case 'Premium High-ROI Farmer':
            return 'Strong future customer. High retention probability. High advisory dependency.';
        case 'Strategic Long-Term Farmer':
            return 'Smaller acreage but very high future lifetime value and trust.';
        case 'Future Premium Farmer':
            return 'Strong long-term ROI potential. Likely expansion customer.';
        case 'Weak Long-Term Relationship':
            return 'Large acreage BUT high future disengagement risk.';
        case 'High-Risk Farmer':
            return acre >= 60
                ? 'Large acreage BUT very low engagement and trust.'
                : 'Low engagement and trust — prioritize re-activation.';
        default:
            return `Opportunity score ${opportunityScore}/100 — ${eng >= 55 ? 'maintain momentum' : 'focus on engagement and advisory follow-through'}.`;
    }
}
export function farmerEmployeeInsights(metrics, classification) {
    const eng = metrics.find((m) => m.key === 'engagement')?.score ?? 0;
    const trust = metrics.find((m) => m.key === 'trust')?.score ?? 0;
    const rel = metrics.find((m) => m.key === 'relationship')?.score ?? 0;
    let telecaller = null;
    let agronomist = null;
    if (eng >= 75)
        telecaller = 'Excellent engagement builder';
    else if (eng >= 45)
        telecaller = 'Moderate engagement — room to grow';
    else if (classification === 'Weak Long-Term Relationship') {
        telecaller = 'Good short-term sales BUT poor relationship retention quality';
    }
    else
        telecaller = 'Needs stronger follow-up and WhatsApp engagement';
    if (trust >= 80)
        agronomist = 'High trust advisor';
    else if (trust >= 55)
        agronomist = 'Building trust — keep recommendations clear';
    else
        agronomist = 'Low trust continuity — reinforce outcomes';
    if (rel >= 85 && !telecaller?.includes('Excellent')) {
        telecaller = 'Strong relationship continuity';
    }
    return { telecaller, agronomist };
}
const INBOUND_TYPES = new Set(['MESSAGE_REPLY', 'IMAGE_UPLOAD', 'VOICE_NOTE', 'FARMER_REACTIVATED']);
export function detectFarmerSignalsFromEvents(events) {
    const positive = [];
    const negative = [];
    const types = new Set(events.map((e) => e.eventType));
    const inbound = events.filter((e) => INBOUND_TYPES.has(e.eventType));
    if (types.has('IMAGE_UPLOAD'))
        positive.push('Uploads crop images regularly');
    else
        negative.push('Rarely uploads crop images');
    if (types.has('ROI_ENTRY'))
        positive.push('Uses ROI tracker');
    else
        negative.push('No ROI tracking');
    if (inbound.length >= 8)
        positive.push('Active weekly on WhatsApp');
    else if (inbound.length >= 3)
        positive.push('Moderate WhatsApp replies');
    else
        negative.push('Rarely replies on WhatsApp');
    if (types.has('VOICE_NOTE'))
        positive.push('Uses voice notes for doubts');
    if (types.has('RECOMMENDATION_APPLIED'))
        positive.push('Follows recommendations');
    if (types.has('CALLBACK_REQUESTED'))
        positive.push('Requests callbacks');
    if (types.has('ADVISORY_SESSION_COMPLETED') || types.has('CROP_ASSESSMENT_REQUESTED')) {
        positive.push('Uses crop assessments');
    }
    else {
        negative.push('Low crop assessment participation');
    }
    if (types.has('ORDER_CONVERTED') && inbound.length < 3) {
        positive.push('Purchased products');
        negative.push('Low ongoing interaction after purchase');
    }
    if (types.has('FARMER_ONBOARDED') && events.some((e) => e.eventType === 'FARMER_REACTIVATED')) {
        positive.push('Re-engaged after inactivity');
    }
    const refFactors = events.filter((e) => e.eventValue?.referral || e.eventValue?.referralSource);
    if (refFactors.length > 0 || types.has('FARMER_ONBOARDED')) {
        /* referral captured in lead metadata factors */
    }
    return {
        positive: [...new Set(positive)].slice(0, 8),
        negative: [...new Set(negative)].slice(0, 6),
    };
}
export function buildFarmerScorePresentation(input) {
    const metrics = buildFarmerMetrics100(input.score.components, input.retentionScore100);
    const classification = classifyFarmer(input.score.opportunityScore, metrics);
    const businessInsight = farmerBusinessInsight(classification, metrics, input.score.opportunityScore);
    const employeeInsights = farmerEmployeeInsights(metrics, classification);
    let detected = detectFarmerSignalsFromEvents(input.recentEvents ?? []);
    for (const f of input.factors ?? []) {
        if (f.code.includes('referral') || f.code.includes('reactivation')) {
            detected.positive.push(f.label);
        }
    }
    detected.positive = [...new Set(detected.positive)].slice(0, 8);
    return {
        opportunityScore: input.score.opportunityScore,
        metrics,
        classification,
        businessInsight,
        detectedSignals: detected,
        employeeInsights,
    };
}
export function buildEmployeeMetrics100(components) {
    return [
        {
            key: 'engagementGrowth',
            label: 'Engagement Growth',
            score: to100(components.engagementGrowth, EMPLOYEE_PERFORMANCE_WEIGHTS.engagementGrowth),
            max: 100,
        },
        {
            key: 'relationshipQuality',
            label: 'Relationship Quality',
            score: to100(components.relationshipQuality, EMPLOYEE_PERFORMANCE_WEIGHTS.relationshipQuality),
            max: 100,
        },
        {
            key: 'retentionQuality',
            label: 'Retention Quality',
            score: to100(components.retentionQuality, EMPLOYEE_PERFORMANCE_WEIGHTS.retentionQuality),
            max: 100,
        },
        {
            key: 'trustBuilding',
            label: 'Trust Building',
            score: to100(components.trustBuilding, EMPLOYEE_PERFORMANCE_WEIGHTS.trustBuilding),
            max: 100,
        },
        {
            key: 'delayedConversion',
            label: 'Delayed Conversion Influence',
            score: to100(components.delayedConversion, EMPLOYEE_PERFORMANCE_WEIGHTS.delayedConversion),
            max: 100,
        },
        {
            key: 'farmerReactivation',
            label: 'Farmer Reactivation',
            score: to100(components.farmerReactivation, EMPLOYEE_PERFORMANCE_WEIGHTS.farmerReactivation),
            max: 100,
        },
    ];
}
export function classifyEmployee(performanceScore, metrics) {
    const ret = metrics.find((m) => m.key === 'retentionQuality')?.score ?? 0;
    const eng = metrics.find((m) => m.key === 'engagementGrowth')?.score ?? 0;
    const reac = metrics.find((m) => m.key === 'farmerReactivation')?.score ?? 0;
    if (performanceScore >= 82 && eng >= 70 && ret >= 65) {
        return 'Long-Term High-Value Employee';
    }
    if (performanceScore >= 70 && reac >= 75) {
        return 'Engagement & Reactivation Specialist';
    }
    if (performanceScore < 45 && ret < 40) {
        return 'Short-Term Sales Employee';
    }
    if (performanceScore >= 55) {
        return 'Solid Relationship Builder';
    }
    return 'Developing Performance';
}
export function employeeBusinessInsight(classification) {
    switch (classification) {
        case 'Long-Term High-Value Employee':
            return 'Not always the highest immediate seller — creates the strongest future farmers.';
        case 'Short-Term Sales Employee':
            return 'High fast sales BUT weak long-term farmer retention.';
        case 'Engagement & Reactivation Specialist':
            return 'Strong at waking inactive farmers and sustaining WhatsApp dialogue.';
        default:
            return 'Continue building trust and retention across assigned farmers.';
    }
}
export function buildEmployeeScorePresentation(score) {
    const metrics = buildEmployeeMetrics100(score.components);
    const classification = classifyEmployee(score.performanceScore, metrics);
    const positive = [];
    const negative = [];
    if (metrics.find((m) => m.key === 'farmerReactivation').score >= 70) {
        positive.push('Reactivates inactive farmers');
    }
    if (metrics.find((m) => m.key === 'engagementGrowth').score >= 65) {
        positive.push('Increases WhatsApp engagement');
    }
    if (metrics.find((m) => m.key === 'relationshipQuality').score >= 65) {
        positive.push('Farmers continue interacting after calls');
    }
    if (score.components.engagementGrowth >= 8) {
        positive.push('High follow-up completion');
    }
    if (metrics.find((m) => m.key === 'retentionQuality').score < 40) {
        negative.push('Low retention among attributed farmers');
    }
    if (metrics.find((m) => m.key === 'engagementGrowth').score < 45) {
        negative.push('Weak follow-up engagement');
    }
    if (metrics.find((m) => m.key === 'trustBuilding').score < 45) {
        negative.push('Low trust continuity');
    }
    if (metrics.find((m) => m.key === 'delayedConversion').score < 40) {
        negative.push('Limited delayed conversion influence');
    }
    return {
        performanceScore: score.performanceScore,
        metrics,
        classification,
        businessInsight: employeeBusinessInsight(classification),
        detectedSignals: { positive: positive.slice(0, 6), negative: negative.slice(0, 5) },
    };
}
//# sourceMappingURL=intelligence-score-presentation.service.js.map