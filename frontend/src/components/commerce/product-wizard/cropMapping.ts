export type CropMappingEntry = {
  id: string;
  crop: string;
  pest: string;
  disease: string;
  symptoms: string;
  dosageAcre: string;
  dosageWater: string;
  applicationStage: string;
  sprayIntervalDays: string;
  compatibility: string;
};

export function emptyCropMapping(): CropMappingEntry {
  return {
    id: crypto.randomUUID(),
    crop: '',
    pest: '',
    disease: '',
    symptoms: '',
    dosageAcre: '',
    dosageWater: '',
    applicationStage: '',
    sprayIntervalDays: '',
    compatibility: '',
  };
}

function asMappingRow(raw: unknown): CropMappingEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const crop = String(row.crop ?? '').trim();
  if (!crop) return null;
  return {
    id: String(row.id ?? crypto.randomUUID()),
    crop,
    pest: String(row.pest ?? ''),
    disease: String(row.disease ?? ''),
    symptoms: String(row.symptoms ?? ''),
    dosageAcre: String(row.dosageAcre ?? row.dosage ?? ''),
    dosageWater: String(row.dosageWater ?? row.waterVolume ?? ''),
    applicationStage: String(row.applicationStage ?? ''),
    sprayIntervalDays: String(row.sprayIntervalDays ?? row.sprayInterval ?? ''),
    compatibility: String(row.compatibility ?? row.compatibleProducts ?? ''),
  };
}

export function cropMappingsFromIntelligence(
  ai: Record<string, unknown>,
  ag: Record<string, unknown>
): CropMappingEntry[] {
  const rawMappings = ai.cropMappings ?? ai.crop_mappings;
  if (Array.isArray(rawMappings) && rawMappings.length) {
    const parsed = rawMappings.map(asMappingRow).filter((m): m is CropMappingEntry => m != null);
    if (parsed.length) return parsed;
  }

  const cropsRaw = ai.crops;
  const crops = Array.isArray(cropsRaw)
    ? cropsRaw.map(String).filter(Boolean)
    : typeof cropsRaw === 'string'
      ? cropsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : typeof ag.recommendedCrops === 'string'
        ? ag.recommendedCrops.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

  const shared = {
    pest: String(ai.pest ?? ai.targetPests ?? ''),
    disease: String(ai.disease ?? ai.targetDiseases ?? ''),
    symptoms: String(ai.symptoms ?? ''),
    dosageAcre: String(ai.dosage ?? ag.dosePerAcre ?? ''),
    dosageWater: String(ai.waterVolume ?? ''),
    applicationStage: String(ai.applicationStage ?? ''),
    sprayIntervalDays: String(ai.sprayInterval ?? ''),
    compatibility: String(ai.compatibleProducts ?? ag.compatibility ?? ''),
  };

  if (crops.length) {
    return crops.map((crop) => ({
      id: crypto.randomUUID(),
      crop,
      ...shared,
    }));
  }

  if (String(ai.crop ?? '').trim()) {
    return [{ id: crypto.randomUUID(), crop: String(ai.crop), ...shared }];
  }

  return [emptyCropMapping()];
}

export function uniqueCropsFromMappings(mappings: CropMappingEntry[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of mappings) {
    const c = m.crop.trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}
