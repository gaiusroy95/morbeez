import type { AgronomistBlockRow } from '@morbeez/shared';

export type FarmerWorkspaceTab =
  | 'overview'
  | 'interactions'
  | 'blocks'
  | 'fieldFindings'
  | 'recommendations'
  | 'orders'
  | 'followUps'
  | 'notes'
  | 'team';

export const FARMER_WORKSPACE_TABS: Array<{ id: FarmerWorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'interactions', label: 'Calls' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'fieldFindings', label: 'Field Findings' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'orders', label: 'Orders' },
  { id: 'followUps', label: 'Follow-ups' },
  { id: 'notes', label: 'Notes' },
  { id: 'team', label: 'Team' },
];

/** Overview KPI tiles that deep-link to the Field Findings tab. */
export const FIELD_FINDINGS_KPI_LABELS = [
  'Pending reviews',
  "Today's visits",
  'Open issues',
] as const;

export type VisitRouteParams = {
  pathname: '/visit';
  params: {
    farmerId: string;
    blockId: string;
    blockName: string;
    cropType: string;
    farmerName: string;
    leadId?: string;
  };
};

export function buildVisitRouteParams(input: {
  farmerId: string;
  farmerName: string;
  block: Pick<AgronomistBlockRow, 'id' | 'name' | 'cropType'>;
  leadId?: string | null;
}): VisitRouteParams {
  return {
    pathname: '/visit',
    params: {
      farmerId: input.farmerId,
      blockId: input.block.id,
      blockName: input.block.name,
      cropType: input.block.cropType || '_default',
      farmerName: input.farmerName,
      ...(input.leadId ? { leadId: input.leadId } : {}),
    },
  };
}

export function kpiNavigatesToFieldFindings(label: string): boolean {
  return (FIELD_FINDINGS_KPI_LABELS as readonly string[]).includes(label);
}
