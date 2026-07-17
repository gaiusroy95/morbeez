import type {
  VisitAssistantRecommendationValidationIssue,
  VisitAssistantRecommendationValidationRequest,
  VisitAssistantRecommendationValidationResult,
} from '@morbeez/shared/visit-assistant';
import type { MaterialCompatibilityReport } from '../core/recommendation-compatibility.service.js';
import { recommendationCompatibilityService } from '../core/recommendation-compatibility.service.js';
import { maiosKnowledgeService } from '../maios-reasoning/knowledge.service.js';
import { maiosSafetyEngineService } from '../maios-reasoning/safety-engine.service.js';

type Dependencies = {
  checkMaterials: (
    materials: Array<{ technicalName: string }>
  ) => Promise<MaterialCompatibilityReport>;
};

const REQUIRED_MATERIAL_FIELDS = [
  'technicalName',
  'doseQuantity',
  'doseUnit',
  'doseBasis',
  'applicationMode',
] as const;

const defaultDependencies: Dependencies = {
  checkMaterials: (materials) => recommendationCompatibilityService.checkMaterials(materials),
};

function missingFieldIssue(
  groupRef: string,
  materialRef: string,
  field: (typeof REQUIRED_MATERIAL_FIELDS)[number]
): VisitAssistantRecommendationValidationIssue {
  return {
    code: 'incomplete_material',
    message: `${field} is required before this assistant recommendation can be confirmed.`,
    groupRef,
    materialRef,
    field,
  };
}

export async function validateVisitAssistantRecommendations(
  input: VisitAssistantRecommendationValidationRequest,
  dependencies: Dependencies = defaultDependencies
): Promise<VisitAssistantRecommendationValidationResult> {
  const blockers: VisitAssistantRecommendationValidationIssue[] = [];
  const warnings: VisitAssistantRecommendationValidationIssue[] = [];
  const unresolvedFields: VisitAssistantRecommendationValidationIssue[] = [];

  for (const group of input.recommendationGroups) {
    for (const material of group.materials) {
      for (const field of REQUIRED_MATERIAL_FIELDS) {
        const value = material[field];
        if (typeof value !== 'string' || !value.trim()) {
          const issue = missingFieldIssue(group.localId, material.localId, field);
          blockers.push(issue);
          unresolvedFields.push(issue);
        }
      }
    }
  }

  const compatibilityGroups = [];
  for (const group of input.recommendationGroups) {
    const report = await dependencies.checkMaterials(
      group.materials
        .map((material) => ({ technicalName: material.technicalName?.trim() ?? '' }))
        .filter((material) => material.technicalName)
    );
    compatibilityGroups.push({ groupRef: group.localId, ...report });

    if (report.hasIncompatiblePair) {
      blockers.push({
        code: 'incompatible_materials',
        message: `Recommendation group ${group.localId} contains an incompatible material pair.`,
        groupRef: group.localId,
      });
    }
    if (report.hasUnknownPair) {
      warnings.push({
        code: 'unknown_compatibility',
        message: `Compatibility could not be verified for every pair in group ${group.localId}.`,
        groupRef: group.localId,
      });
    }
  }

  const compatibilityReport = {
    groups: compatibilityGroups,
    hasIncompatiblePair: compatibilityGroups.some((group) => group.hasIncompatiblePair),
    hasUnknownPair: compatibilityGroups.some((group) => group.hasUnknownPair),
  };

  if (input.dap == null) {
    const issue = {
      code: 'missing_dap',
      message: 'DAP is unavailable; crop-stage safety could not be fully checked.',
    };
    warnings.push(issue);
    unresolvedFields.push(issue);
  }
  if (input.stage == null || !input.stage.trim()) {
    const issue = {
      code: 'missing_stage',
      message: 'Crop stage is unavailable; stage-specific safety remains unresolved.',
    };
    warnings.push(issue);
    unresolvedFields.push(issue);
  }
  if (
    input.weather?.heavyRainLikely == null
    || input.weather?.highHeatLikely == null
  ) {
    const issue = {
      code: 'missing_weather',
      message: 'Weather context is incomplete; weather-dependent safety remains unresolved.',
    };
    warnings.push(issue);
    unresolvedFields.push(issue);
  }

  let safetyReport: VisitAssistantRecommendationValidationResult['safetyReport'] = null;
  if (input.cropType?.trim()) {
    const safety = maiosSafetyEngineService.validate({
      pkg: maiosKnowledgeService.load(input.cropType),
      management: {
        diagnosisLabel: 'Assistant recommendation draft',
        objectives: [],
        ipm: [],
        cultural: [],
        nutrition: [],
        biological: [],
        chemical: input.recommendationGroups.flatMap((group) =>
          group.materials
            .filter((material) => material.technicalName?.trim())
            .map((material) => ({
              activeIngredientClass: material.technicalName!.trim(),
              notes: `${material.category ?? ''} ${material.applicationMode ?? ''}`.trim(),
            }))
        ),
        monitoring: [],
      },
      dap: input.dap,
      contextPack: input.weather,
    });
    safetyReport = {
      ...safety,
      status: safety.status === 'REJECT'
        ? 'REJECT'
        : unresolvedFields.some((issue) =>
            ['missing_dap', 'missing_stage', 'missing_weather'].includes(issue.code)
          )
          ? 'UNRESOLVED'
          : 'PASS',
      context: {
        cropType: input.cropType,
        dap: input.dap,
        stage: input.stage,
        weather: input.weather,
      },
    };
    for (const reason of safety.rejectReasons) {
      blockers.push({ code: 'maios_safety_reject', message: reason });
    }
  } else {
    const issue = {
      code: 'missing_crop_type',
      message: 'Crop type is unavailable; MAIOS safety rules could not be evaluated.',
    };
    warnings.push(issue);
    unresolvedFields.push(issue);
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    unresolvedFields,
    compatibilityReport,
    safetyReport,
  };
}

export const visitAssistantRecommendationSafetyService = {
  validate: validateVisitAssistantRecommendations,
};
