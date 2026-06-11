export type FieldHealthStatus = 'stable' | 'monitor' | 'alert' | 'critical';

/** Active crop from CRM masters (same list as staff telecaller workspace). */
export type CropMaster = {
  id: string;
  name: string;
};

export type FieldBlock = {
  id: string;
  name: string;
  crop: string;
  acreage: number | null;
  dap: number | null;
  plantingDate?: string | null;
  plantingDateLabel?: string | null;
  healthStatus: FieldHealthStatus;
  healthLabel: string;
  lastActivity: string | null;
  currentAlert: string | null;
  stage: string | null;
  isPrimary: boolean;
};

export type FieldOverview = FieldBlock & {
  spad: string | null;
  shootCount: string | null;
  soilMoisture: string | null;
  irrigationType: string | null;
  healthScore: number | null;
};

export type FieldTimelineItem = {
  id: string;
  type: 'recommendation' | 'activity' | 'scan' | 'recovery' | 'soil';
  title: string;
  subtitle: string | null;
  at: string;
  atLabel: string;
};

export type FieldDetail = {
  block: FieldOverview;
  timeline: FieldTimelineItem[];
};
