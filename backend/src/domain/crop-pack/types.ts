import type { MaiosModuleKey } from '../case/types.js';

export type CropPhotoSlotDef = {
  id: string;
  group: 'farm' | 'canopy' | 'leaf' | 'root' | 'fruit' | 'pest';
  labelEn: string;
  labelMl: string;
  whatsappPriority: number;
  conditional?: boolean;
};

export type CropStageDef = {
  id: string;
  label: string;
  dapMin: number;
  dapMax: number | null;
};

export type CropPackConfig = {
  cropType: string;
  version: string;
  displayName: string;
  photoSlots: CropPhotoSlotDef[];
  rootPhotoSlots: string[];
  measurementKeys: string[];
  moduleWeights: Partial<Record<MaiosModuleKey, number>>;
  recoveryDays: number[];
  stageModel: CropStageDef[];
  riskRules?: {
    rootStressPattern?: string;
  };
  canopyExpectations?: Array<{ dap: number; closurePct: number }>;
};

export type CropPackRow = {
  id: string;
  crop_type: string;
  version: string;
  config: CropPackConfig;
  active: boolean;
};
