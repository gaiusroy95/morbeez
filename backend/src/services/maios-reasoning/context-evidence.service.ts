import { diseaseWeatherRulesService } from '../whatsapp/pipeline/disease-weather-rules.service.js';
import type { ReasoningEvidenceItem } from '../../domain/maios-reasoning/types.js';
import {
  hasPestSilverStreakEvidence,
  hasYellowStreakEvidence,
} from './symptom-evidence-patterns.js';
export type ContextEvidenceInput = {
  cropType: string;
  symptomsText?: string;
  contextPack?: {
    weatherRiskScore?: number;
    heavyRainLikely?: boolean;
    highHeatLikely?: boolean;
    highHumidityLikely?: boolean;
    soilPh?: number;
    soilEc?: number;
    dap?: number | null;
    daysSinceLastFertilizer?: number | null;
    cropType?: string;
  };
  regionalPriors?: Array<{ issueLabel: string; caseCount: number }>;
};

function symptomEvidence(text: string): ReasoningEvidenceItem[] {
  const t = text.toLowerCase();
  const out: ReasoningEvidenceItem[] = [];
  if (/spindle|diamond|blast|pyricularia/.test(t)) {
    out.push({
      key: 'symptom:spindle_lesion',
      label: 'Spindle-shaped lesions reported',
      source: 'farmer',
      reliability: 0.85,
    });
  }
  if (/grey center|gray center|grey.?centre/.test(t)) {
    out.push({
      key: 'symptom:grey_center',
      label: 'Grey lesion centre reported',
      source: 'farmer',
      reliability: 0.82,
    });
  }
  if (/black dot|speck/.test(t)) {
    out.push({
      key: 'symptom:black_dots',
      label: 'Black dots in lesions reported',
      source: 'farmer',
      reliability: 0.85,
    });
  }
  if (hasPestSilverStreakEvidence(t)) {
    out.push({
      key: 'symptom:silver_streak',
      label: 'Silver streaks / scraping damage reported',
      source: 'farmer',
      reliability: 0.84,
    });
  }
  if (/rot|soft|pythium|waterlog/.test(t)) {
    out.push({
      key: 'symptom:soft_rot',
      label: 'Rot / waterlogging signals',
      source: 'farmer',
      reliability: 0.86,
    });
  }
  if (/yellow|chlorosis|deficien/.test(t)) {
    out.push({
      key: 'symptom:yellowing',
      label: 'Yellowing / deficiency signs',
      source: 'farmer',
      reliability: 0.8,
    });
  }
  if (/margin|tip burn|scorch|necrotic margin|edge yellow|chlorosis.*margin|tip.*yellow/.test(t)) {
    out.push({
      key: 'symptom:margin_scorch',
      label: 'Leaf margin / tip scorch or yellowing',
      source: 'farmer',
      reliability: 0.84,
    });
  }
  if (/sigatoka|yellow streak|parallel streak|leaf streak/.test(t) || hasYellowStreakEvidence(t)) {
    out.push({
      key: 'symptom:yellow_streak',
      label: 'Yellow streaks on leaves reported',
      source: 'farmer',
      reliability: 0.84,
    });
  }
  if (/wilt|collapse|pseudostem split|vascular brown/.test(t)) {
    out.push({
      key: 'symptom:wilt_collapse',
      label: 'Wilt / pseudostem collapse reported',
      source: 'farmer',
      reliability: 0.86,
    });
  }
  if (/borer|bore hole|sawdust|weevil/.test(t)) {
    out.push({
      key: 'symptom:borer_hole',
      label: 'Borer / weevil damage reported',
      source: 'farmer',
      reliability: 0.85,
    });
  }
  if (/concentric|target pattern|ring.*spot/.test(t)) {
    out.push({
      key: 'symptom:concentric_rings',
      label: 'Concentric ring leaf spots reported',
      source: 'farmer',
      reliability: 0.84,
    });
  }
  if (/water.?soaked|greasy spot|late blight/.test(t)) {
    out.push({
      key: 'symptom:water_soaked',
      label: 'Water-soaked lesions reported',
      source: 'farmer',
      reliability: 0.85,
    });
  }
  if (/bud rot|spear rot|crown rot|foul smell/.test(t)) {
    out.push({
      key: 'symptom:bud_rot',
      label: 'Bud / crown rot reported',
      source: 'farmer',
      reliability: 0.87,
    });
  }
  if (/rhinoceros|beetle|chewed fibre|crown damage/.test(t)) {
    out.push({
      key: 'symptom:beetle_damage',
      label: 'Beetle / mechanical crown damage reported',
      source: 'farmer',
      reliability: 0.85,
    });
  }
  return out;
}

export const maiosContextEvidenceService = {
  build(input: ContextEvidenceInput): ReasoningEvidenceItem[] {
    const items: ReasoningEvidenceItem[] = [];
    const ctx = input.contextPack;

    if (ctx?.heavyRainLikely) {
      items.push({
        key: 'weather:heavy_rain',
        label: 'Heavy rain likely (7-day forecast)',
        source: 'weather',
        reliability: 0.97,
      });
    }
    if (ctx?.highHumidityLikely) {
      items.push({
        key: 'weather:high_humidity',
        label: 'High humidity likely',
        source: 'weather',
        reliability: 0.94,
      });
    }

    const weatherPriors = diseaseWeatherRulesService.evaluate({
      cropType: input.cropType,
      env: {
        heavyRainLikely: Boolean(ctx?.heavyRainLikely),
        highHumidityLikely: Boolean(ctx?.highHumidityLikely),
        weatherRiskScore: ctx?.weatherRiskScore ?? 0,
      },
      symptomsText: input.symptomsText,
    });

    for (const p of weatherPriors) {
      if (p.likelihood === 'high') {
        items.push({
          key: 'regional:prior',
          label: `Regional weather prior: ${p.issueLabel}`,
          source: 'regional',
          reliability: 0.75,
          value: p.issueLabel,
        });
      }
    }

    for (const rp of input.regionalPriors ?? []) {
      if (rp.caseCount >= 3) {
        items.push({
          key: 'regional:prior',
          label: `Regional outbreak: ${rp.issueLabel} (${rp.caseCount} cases)`,
          source: 'regional',
          reliability: 0.7,
          value: rp.issueLabel,
        });
      }
    }

    const n = ctx?.soilPh;
    if (n != null && n < 5.5) {
      items.push({
        key: 'soil:low_n',
        label: 'Acidic soil — nutrient uptake stress',
        source: 'soil',
        reliability: 0.65,
      });
    }

    if (input.symptomsText?.trim()) {
      items.push(...symptomEvidence(input.symptomsText));
    }

    const dap = ctx?.dap;
    const crop = (input.cropType ?? ctx?.cropType ?? '').toLowerCase();
    if (dap != null && dap >= 60) {
      if (crop === 'ginger' && dap >= 90 && dap <= 200) {
        items.push({
          key: 'context:k_demand_stage',
          label: `Ginger at ${dap} DAP — peak potassium demand stage`,
          source: 'context',
          reliability: 0.88,
        });
      }
    }

    const daysSinceFert = ctx?.daysSinceLastFertilizer;
    if (daysSinceFert != null && daysSinceFert >= 21) {
      items.push({
        key: 'context:fertilizer_gap_21d',
        label: `No fertilizer/fertigation recorded in ${daysSinceFert}+ days`,
        source: 'context',
        reliability: 0.82,
      });
    }

    if (ctx?.heavyRainLikely && ctx?.highHumidityLikely) {
      items.push({
        key: 'context:prolonged_wet',
        label: 'Prolonged wet conditions — uptake stress risk',
        source: 'weather',
        reliability: 0.86,
      });
    }

    return items;
  },
};
