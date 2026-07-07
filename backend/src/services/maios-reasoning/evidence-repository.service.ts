import type { MaiosPhotoEvidence } from '../../domain/case/types.js';
import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import type { ReasoningEvidenceItem } from '../../domain/maios-reasoning/types.js';
import { maiosKnowledgeService } from './knowledge.service.js';

export type EvidenceRepositoryInput = {
  contextItems: ReasoningEvidenceItem[];
  visionLabel?: string | null;
  visionConfidence?: number;
  visionFeatures?: Array<{ feature: string; value: string; confidence: number }>;
  farmerAnswers?: Array<{ questionId?: string; questionText: string; answer: string }>;
  photos: MaiosPhotoEvidence[];
  pack: CropPackConfig;
  labSummary?: string | null;
  cropType?: string;
};

function visionKey(label: string): string | null {
  const t = label.toLowerCase();
  if (/blast|pyricularia|spindle/.test(t)) return 'vision:blast';
  if (/rot|pythium|rhizome|bud rot|spear rot|crown rot/.test(t)) return 'vision:rot';
  if (/thrip/.test(t)) return 'vision:thrips';
  if (/sigatoka|leaf spot|mycosphaerella/.test(t)) return 'vision:sigatoka';
  if (/panama|fusarium|wilt/.test(t)) return 'vision:wilt';
  if (/weevil|borer|beetle/.test(t)) return 'vision:borer';
  if (/alternaria|early blight|target spot/.test(t)) return 'vision:blast';
  if (/late blight|phytophthora infestans/.test(t)) return 'vision:rot';
  return null;
}

function visionFeatureToEvidence(obs: {
  feature: string;
  value: string;
  confidence: number;
}): ReasoningEvidenceItem | null {
  const f = obs.feature.toLowerCase().replace(/\s+/g, '_');
  const present = /present|yes|visible|detected|true|positive/i.test(obs.value.trim());
  if (!present && obs.confidence < 0.55) return null;

  const map: Record<string, { key: string; label: string }> = {
    spindle_shape: { key: 'symptom:spindle_lesion', label: 'Vision: spindle-shaped lesions' },
    spindle_lesion: { key: 'symptom:spindle_lesion', label: 'Vision: spindle lesions' },
    grey_center: { key: 'symptom:grey_center', label: 'Vision: grey lesion centre' },
    gray_center: { key: 'symptom:grey_center', label: 'Vision: grey lesion centre' },
    black_dots: { key: 'symptom:black_dots', label: 'Vision: black dots in lesions' },
    silver_streak: { key: 'symptom:silver_streak', label: 'Vision: silver streaks' },
    soft_rot: { key: 'symptom:soft_rot', label: 'Vision: soft rot signs' },
    concentric_rings: { key: 'symptom:concentric_rings', label: 'Vision: concentric ring lesions' },
    water_soaked: { key: 'symptom:water_soaked', label: 'Vision: water-soaked lesions' },
    yellow_streak: { key: 'symptom:yellow_streak', label: 'Vision: yellow leaf streaks' },
    parallel_streak: { key: 'symptom:parallel_streak', label: 'Vision: parallel leaf streaks' },
    wilt_collapse: { key: 'symptom:wilt_collapse', label: 'Vision: wilt or collapse signs' },
    borer_hole: { key: 'symptom:borer_hole', label: 'Vision: borer hole damage' },
    beetle_damage: { key: 'symptom:beetle_damage', label: 'Vision: beetle bore damage' },
    bud_rot: { key: 'symptom:bud_rot', label: 'Vision: bud or crown rot' },
    yellowing: { key: 'symptom:yellowing', label: 'Vision: leaf yellowing' },
  };

  const hit = map[f];
  if (!hit) return null;
  return {
    key: hit.key,
    label: hit.label,
    source: 'vision',
    reliability: Math.max(0.5, Math.min(0.98, obs.confidence)),
  };
}

function answerIsYes(answer: string): boolean {
  const a = answer.toLowerCase().trim();
  return a === 'yes' || a === 'true';
}

function answerIsNo(answer: string): boolean {
  const a = answer.toLowerCase().trim();
  return a === 'no' || a === 'false';
}

export const maiosEvidenceRepositoryService = {
  merge(input: EvidenceRepositoryInput): ReasoningEvidenceItem[] {
    const repo: ReasoningEvidenceItem[] = [...input.contextItems];
    const seen = new Set(repo.map((e) => e.key));

    const push = (item: ReasoningEvidenceItem) => {
      if (seen.has(item.key)) return;
      seen.add(item.key);
      repo.push(item);
    };

    if (input.visionLabel?.trim()) {
      const vk = visionKey(input.visionLabel);
      if (vk) {
        push({
          key: vk,
          label: `Vision: ${input.visionLabel}`,
          source: 'vision',
          reliability: Math.max(0.5, Math.min(0.98, input.visionConfidence ?? 0.75)),
        });
      }
    }

    for (const feat of input.visionFeatures ?? []) {
      const mapped = visionFeatureToEvidence(feat);
      if (mapped) {
        push(mapped);
        continue;
      }
      const key = `vision:${feat.feature.replace(/\s+/g, '_').toLowerCase()}`;
      push({
        key,
        label: `${feat.feature}: ${feat.value}`,
        source: 'vision',
        reliability: Math.max(0.5, Math.min(0.98, feat.confidence)),
      });
    }

    for (const ans of input.farmerAnswers ?? []) {
      if (ans.questionId && input.cropType && !ans.questionId.startsWith('photo:')) {
        const pkg = maiosKnowledgeService.load(input.cropType);
        const q = pkg.questions.find((row) => row.id === ans.questionId);
        if (q) {
          if (answerIsYes(ans.answer) && q.evidenceKeyIfYes) {
            push({
              key: q.evidenceKeyIfYes,
              label: `Farmer confirmed: ${q.text}`,
              source: 'farmer',
              reliability: 0.86,
            });
          } else if (answerIsNo(ans.answer) && q.evidenceKeyIfNo) {
            push({
              key: q.evidenceKeyIfNo,
              label: `Farmer denied: ${q.text}`,
              source: 'farmer',
              reliability: 0.72,
            });
          }
          continue;
        }
      }

      const q = ans.questionText.toLowerCase();
      const a = ans.answer.toLowerCase().trim();
      const yes = a === 'yes' || a === 'true';
      if (/black dot/.test(q) && yes) {
        push({
          key: 'farmer:black_dots_yes',
          label: 'Farmer confirmed black dots in lesions',
          source: 'farmer',
          reliability: 0.85,
        });
      }
      if (/rain|waterlog/.test(q) && yes) {
        push({
          key: 'farmer:rain_worse_yes',
          label: 'Farmer confirmed symptoms worsened after rain',
          source: 'farmer',
          reliability: 0.83,
        });
      }
      if (/silver|thrip/.test(q) && yes) {
        push({
          key: 'symptom:silver_streak',
          label: 'Farmer confirmed silver streaks',
          source: 'farmer',
          reliability: 0.84,
        });
      }
      if (/rhizome|soft|rot/.test(q) && yes) {
        push({
          key: 'symptom:soft_rot',
          label: 'Farmer confirmed soft/rotting rhizome',
          source: 'farmer',
          reliability: 0.86,
        });
      }
      if (/streak|sigatoka|parallel/.test(q) && yes) {
        push({
          key: 'farmer:streaks_yes',
          label: 'Farmer confirmed leaf streaks',
          source: 'farmer',
          reliability: 0.84,
        });
      }
      if (/borer|bore hole|weevil|sawdust/.test(q) && yes) {
        push({
          key: 'symptom:borer_hole',
          label: 'Farmer confirmed borer damage',
          source: 'farmer',
          reliability: 0.85,
        });
      }
      if (/concentric|target pattern|ring/.test(q) && yes) {
        push({
          key: 'farmer:rings_yes',
          label: 'Farmer confirmed concentric ring spots',
          source: 'farmer',
          reliability: 0.84,
        });
      }
      if (/water.?soaked|greasy|humid/.test(q) && yes) {
        push({
          key: 'symptom:water_soaked',
          label: 'Farmer confirmed water-soaked lesions',
          source: 'farmer',
          reliability: 0.85,
        });
      }
      if (/bud rot|spear rot|crown rot|foul/.test(q) && yes) {
        push({
          key: 'farmer:bud_rot_yes',
          label: 'Farmer confirmed bud/crown rot',
          source: 'farmer',
          reliability: 0.86,
        });
      }
      if (/beetle|bore hole|chewed/.test(q) && yes && !/borer|weevil|sawdust/.test(q)) {
        push({
          key: 'symptom:beetle_damage',
          label: 'Farmer confirmed beetle damage',
          source: 'farmer',
          reliability: 0.85,
        });
      }
      if (/wilt|wilting|collapse|splitting/.test(q) && yes && !/borer|bore hole|weevil|sawdust/.test(q)) {
        push({
          key: 'farmer:wilt_yes',
          label: 'Farmer confirmed wilt / pseudostem symptoms',
          source: 'farmer',
          reliability: 0.85,
        });
      }
    }

    const capturedSlots = new Set(
      input.photos.filter((p) => p.status === 'captured').map((p) => p.slot)
    );
    for (const slot of input.pack.rootPhotoSlots ?? []) {
      if (!capturedSlots.has(slot)) {
        push({
          key: `photo:missing:${slot}`,
          label: `Missing photo slot: ${slot}`,
          source: 'photo',
          reliability: 0.5,
          value: slot,
        });
      }
    }

    if (input.labSummary?.trim()) {
      push({
        key: 'lab:summary',
        label: input.labSummary,
        source: 'lab',
        reliability: 0.9,
      });
    }

    return repo;
  },

  missingPhotoSlots(input: EvidenceRepositoryInput): string[] {
    const captured = new Set(
      input.photos.filter((p) => p.status === 'captured').map((p) => p.slot)
    );
    return input.pack.photoSlots.map((s) => s.id).filter((id) => !captured.has(id));
  },
};
