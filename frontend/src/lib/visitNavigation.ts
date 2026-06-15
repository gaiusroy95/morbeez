import { paths, toPath } from './routes';

export type VisitWizardUrlParams = {
  farmerId: string;
  blockId: string;
  blockName: string;
  cropType: string;
  farmerName: string;
};

export function buildVisitWizardUrl(params: VisitWizardUrlParams): string {
  const q = new URLSearchParams({
    farmerId: params.farmerId,
    blockId: params.blockId,
    blockName: params.blockName,
    cropType: params.cropType,
    farmerName: params.farmerName,
  });
  return `${toPath(paths.agronomistVisit)}?${q.toString()}`;
}
