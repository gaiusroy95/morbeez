import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
import type { ContextPack } from '../whatsapp/pipeline/context-pack.service.js';
import type { StructuredAdvisory } from './types.js';

export type CropDoctorReportContext = {
  cropType?: string;
  cropStage?: string;
  variety?: string;
  dap?: number;
  location?: string;
  plotLabel?: string;
  contextPack?: ContextPack;
  reasoning?: MaiosReasoningSnapshot | null;
};

function na(value: string | undefined | null): string {
  const v = value?.trim();
  return v || 'Not recorded';
}

function contributingFactor(advisory: StructuredAdvisory): string | null {
  const fromRanked = advisory.diagnosisRanked?.find((r) => r.role === 'contributing');
  if (fromRanked?.label) return fromRanked.label;
  const highNutrient = advisory.nutrientDeficiency?.find((n) => n.likelihood === 'high');
  if (highNutrient?.nutrient) {
    return `${highNutrient.nutrient} deficiency`;
  }
  return advisory.contributingFactor?.trim() || null;
}

function primaryLabel(advisory: StructuredAdvisory): string {
  return advisory.probableIssue?.trim() || 'Field issue under review';
}

function recoveryBlock(advisory: StructuredAdvisory): { emoji: string; label: string; reason: string } {
  const outlook = advisory.recoveryOutlook;
  if (outlook === 'excellent') {
    return { emoji: '🟢', label: 'Excellent', reason: advisory.recoveryReason?.trim() || 'Early signs with strong field conditions for recovery.' };
  }
  if (outlook === 'good') {
    return { emoji: '🟢', label: 'Good', reason: advisory.recoveryReason?.trim() || 'Timely action should help the crop recover well.' };
  }
  if (outlook === 'moderate') {
    return { emoji: '🟡', label: 'Moderate', reason: advisory.recoveryReason?.trim() || 'Recovery is possible but depends on quick field action.' };
  }
  if (outlook === 'poor') {
    return { emoji: '🔴', label: 'Poor', reason: advisory.recoveryReason?.trim() || 'Damage is significant — close monitoring and agronomist review advised.' };
  }

  const sev = advisory.severity ?? 'moderate';
  const conf = advisory.confidence;
  if (sev === 'severe' || conf < 0.45) {
    return { emoji: '🔴', label: 'Poor', reason: 'Significant stress detected — act quickly and monitor daily.' };
  }
  if (sev === 'mild' && conf >= 0.75) {
    return { emoji: '🟢', label: 'Good', reason: 'Problem appears early — timely treatment should protect yield.' };
  }
  return { emoji: '🟡', label: 'Moderate', reason: 'Recovery is likely with the recommended field actions.' };
}

function weatherLines(pack?: ContextPack): {
  temperature?: string;
  humidity?: string;
  rainfall?: string;
  weather?: string;
  soilMoisture?: string;
} {
  if (!pack) return {};
  const humidity =
    pack.avgHumidityPct != null ? `${Math.round(pack.avgHumidityPct)}%` : undefined;
  const temperature =
    pack.maxTempCToday != null ? `${Math.round(pack.maxTempCToday)}°C` : undefined;
  const rainfall = pack.rainMmToday != null ? `${pack.rainMmToday} mm (today)` : undefined;
  const weatherParts: string[] = [];
  if (pack.heavyRainLikely) weatherParts.push('Heavy rain likely');
  if (pack.highHumidityLikely) weatherParts.push('High humidity');
  if (pack.highHeatLikely) weatherParts.push('High heat');
  if (!weatherParts.length && pack.seasonPhase) weatherParts.push(`${pack.seasonPhase} season`);
  const soilMoisture =
    pack.drainageRisk === 'high'
      ? 'Wet, risk of temporary waterlogging'
      : pack.drainageRisk === 'moderate'
        ? 'Moist'
        : pack.drainageRisk === 'low'
          ? 'Normal'
          : undefined;
  return {
    temperature,
    humidity,
    rainfall,
    weather: weatherParts.join('; ') || undefined,
    soilMoisture,
  };
}

function whyWeThink(advisory: StructuredAdvisory): string[] {
  const lines: string[] = [];
  for (const obs of advisory.imageObservations?.slice(0, 2) ?? []) {
    lines.push(obs);
  }
  for (const data of advisory.morbeezDataUsed?.slice(0, 2) ?? []) {
    if (!lines.includes(data)) lines.push(data);
  }
  if (advisory.explanation?.trim()) {
    const parts = advisory.explanation
      .split(/[.;]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      if (lines.length >= 4) break;
      if (!lines.some((l) => l.toLowerCase().includes(p.slice(0, 20).toLowerCase()))) {
        lines.push(p);
      }
    }
  }
  if (!lines.length && advisory.agronomistAssessment?.trim()) {
    lines.push(advisory.agronomistAssessment.trim());
  }
  return lines.slice(0, 4).map((l) => `• ${l.replace(/^•\s*/, '')}`);
}

function buildFarmerReport(advisory: StructuredAdvisory, ctx: CropDoctorReportContext): string {
  const weather = weatherLines(ctx.contextPack);
  const location =
    ctx.location?.trim() ||
    [ctx.contextPack?.village, ctx.contextPack?.district].filter(Boolean).join(', ') ||
    ctx.plotLabel;
  const dap =
    ctx.dap != null
      ? `${ctx.dap} Days`
      : ctx.contextPack?.dap != null
        ? `${ctx.contextPack.dap} Days`
        : ctx.cropStage;
  const contributing = contributingFactor(advisory);
  const recovery = recoveryBlock(advisory);
  const observations =
    advisory.imageObservations?.length
      ? advisory.imageObservations.slice(0, 5)
      : advisory.stressAnalysis?.slice(0, 4) ?? [];

  const actions = advisory.dosageGuidance?.length
    ? advisory.dosageGuidance.slice(0, 3)
    : advisory.treatments?.slice(0, 3).map((t) => ({
        product: t.action,
        rate: t.productType ?? '-',
        method: t.timing ?? 'Field application',
      })) ?? [];

  const monitor =
    advisory.monitorAdvice?.trim() ||
    advisory.diseaseWatchNote?.trim() ||
    'Check if new symptoms spread to more leaves. Upload fresh photos if symptoms worsen.';

  const sections: string[] = [
    '🌱 MORBEEZ CROP DOCTOR',
    '',
    '📍 Crop Information',
    '',
    `Crop: ${na(ctx.cropType)}`,
    `Variety: ${na(ctx.variety)}`,
    `DAP: ${na(dap)}`,
    `Location: ${na(location)}`,
    '',
    '🌦 Current Field Conditions',
    '',
    `Temperature: ${na(weather.temperature)}`,
    `Humidity: ${na(weather.humidity)}`,
    `Rainfall (Last 7 Days): ${na(weather.rainfall)}`,
    `Weather: ${na(weather.weather)}`,
    `Soil Moisture: ${na(weather.soilMoisture)}`,
    '',
    '🚜 Last Field Activity',
    '',
    `Last Fertilizer: ${na(advisory.lastFertilizer)}`,
    `Date: ${na(advisory.lastFertilizerDate)}`,
    `Days Ago: ${na(advisory.lastFertilizerDaysAgo)}`,
    '',
    `Last Foliar Spray: ${na(advisory.lastFoliarSpray)}`,
    `Date: ${na(advisory.lastFoliarSprayDate)}`,
    `Days Ago: ${na(advisory.lastFoliarSprayDaysAgo)}`,
    '',
    `Last Drench: ${na(advisory.lastDrench)}`,
    `Date: ${na(advisory.lastDrenchDate)}`,
    `Days Ago: ${na(advisory.lastDrenchDaysAgo)}`,
    '',
    '📋 Previous Diagnosis',
    '',
    `Previous Disease: ${na(advisory.previousDisease)}`,
    `Previous Recommendation: ${na(advisory.previousRecommendation)}`,
    `Status: ${na(advisory.previousDiagnosisStatus)}`,
    '',
    '---',
    '',
    '🔍 What We Found',
    '',
    ...(observations.length
      ? observations.map((o) => `• ${o.replace(/^•\s*/, '')}`)
      : ['• Image details are limited — please send a closer leaf photo if symptoms persist.']),
    '',
    '---',
    '',
    '🎯 Most Likely Problem',
    '',
    `Primary: ${primaryLabel(advisory)}`,
  ];

  if (contributing) {
    sections.push('', `Contributing Factor: ${contributing}`);
  }

  sections.push(
    '',
    '---',
    '',
    '📌 Why We Think This',
    '',
    ...whyWeThink(advisory),
    '',
    '---',
    '',
    '💊 What To Do Now',
    ''
  );

  if (actions.length) {
    sections.push('Product\tDose\tMethod');
    for (const a of actions) {
      sections.push(`${a.product}\t${a.rate}\t${a.method}`);
    }
  } else {
    sections.push('No product action recommended yet — more field evidence may be needed.');
  }

  if (advisory.sprayTiming?.trim()) {
    sections.push('', advisory.sprayTiming.trim());
  }

  sections.push(
    '',
    '---',
    '',
    '🌱 Recovery',
    '',
    `${recovery.emoji} ${recovery.label}`,
    '',
    recovery.reason,
    '',
    '---',
    '',
    '⚠ Monitor',
    '',
    monitor,
    '',
    '---',
    '',
    '🚨 Precautions',
    '',
    ...(advisory.precautions?.length
      ? advisory.precautions.slice(0, 3).map((p) => `• ${p.replace(/^•\s*/, '')}`)
      : ['• Follow label instructions for any spray.', '• Avoid spraying during rain.']),
    '',
    '---',
    '',
    '👨‍🌾 Agronomist Review',
    '',
    'This diagnosis is generated using your field records, weather, crop history and image analysis. Our agronomist team will review if required.'
  );

  return sections.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildTechnicalReport(
  advisory: StructuredAdvisory,
  reasoning?: MaiosReasoningSnapshot | null
): string {
  const lines: string[] = ['🔬 Technical Details (Agronomist View)', ''];

  lines.push('Primary Diagnosis', '', advisory.probableIssue?.trim() || 'Unknown', '');

  const alternatives = (advisory.differentialDiagnosis ?? [])
    .filter((d) => d.label && d.label !== advisory.probableIssue)
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
    .slice(0, 5);

  lines.push('Alternative Diagnoses', '');
  if (alternatives.length) {
    for (const alt of alternatives) {
      const pct = alt.probability != null ? Math.round(alt.probability * 100) : null;
      const qualifier =
        pct == null ? '' : pct >= 40 ? ' (Moderate possibility)' : pct >= 20 ? '' : ' (Low possibility)';
      lines.push(`${alt.label}${qualifier}`);
    }
  } else {
    lines.push('None ranked');
  }
  lines.push('');

  lines.push('Supporting Evidence', '');
  const supporting = [
    ...(advisory.imageObservations ?? []),
    ...(advisory.morbeezDataUsed ?? []),
    ...(reasoning?.explanation.supporting ?? []),
  ].slice(0, 8);
  for (const s of supporting) lines.push(`• ${s}`);
  lines.push('');

  lines.push('Contradicting Evidence', '');
  const contradicting = reasoning?.explanation.rejected?.length
    ? reasoning.explanation.rejected
    : advisory.rejectedHypotheses ?? [];
  if (contradicting.length) {
    for (const c of contradicting.slice(0, 6)) lines.push(`• ${c}`);
  } else {
    lines.push('• None noted');
  }
  lines.push('');

  const diseaseWatch = advisory.diagnosisRanked?.find((r) => r.role === 'disease_watch');
  lines.push('Overall Field Risk', '');
  lines.push(
    `Disease Pressure: ${diseaseWatch ? 'High' : advisory.confidence >= 0.7 ? 'Moderate' : 'Low'}`
  );
  const nutrientStress = advisory.nutrientDeficiency?.some((n) => n.likelihood !== 'low')
    ? 'Moderate'
    : 'Low';
  lines.push(`Nutrient Stress: ${nutrientStress}`);
  lines.push(
    `Yield Risk: ${advisory.severity === 'severe' ? 'High' : advisory.severity === 'moderate' ? 'Moderate' : 'Low'} (if untreated)`
  );
  lines.push('');

  if (reasoning?.posterior?.length) {
    lines.push('Bayesian Scores', '');
    for (const p of reasoning.posterior.slice(0, 6)) {
      lines.push(`${p.label}: ${Math.round(p.probability * 100)}%`);
    }
    lines.push('');
  }

  lines.push('Image Confidence', '', `${Math.round(advisory.confidence * 100)}%`, '');

  if (advisory.diseaseWatchNote?.trim()) {
    lines.push('Weather Risk', '', advisory.diseaseWatchNote.trim(), '');
  }

  if (reasoning?.explanation.missing?.length) {
    lines.push('Recommended Follow-up Questions', '');
    for (const q of reasoning.explanation.missing.slice(0, 4)) lines.push(`• ${q}`);
  }

  return lines.join('\n').trim();
}

export const cropDoctorFarmerReportService = {
  buildFarmerReport,
  buildTechnicalReport,

  attachReports(advisory: StructuredAdvisory, ctx: CropDoctorReportContext): StructuredAdvisory {
    return {
      ...advisory,
      farmerReport: buildFarmerReport(advisory, ctx),
      technicalReport: buildTechnicalReport(advisory, ctx.reasoning),
    };
  },
};
