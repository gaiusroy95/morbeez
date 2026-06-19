import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import type { CropStageDef } from '../../domain/crop-pack/types.js';

export const cropStageService = {
  stageForDap(pack: CropPackConfig, dap: number | null | undefined): CropStageDef | null {
    if (dap == null || dap < 0) return null;
    for (const stage of pack.stageModel) {
      const max = stage.dapMax ?? Number.MAX_SAFE_INTEGER;
      if (dap >= stage.dapMin && dap <= max) return stage;
    }
    return pack.stageModel[pack.stageModel.length - 1] ?? null;
  },
};
