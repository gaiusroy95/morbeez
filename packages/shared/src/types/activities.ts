import type { FarmConfirmedRecordProvenance } from '../farm-activity-assistant/visibility';

export type ActivityType = 'spray_applied' | 'fertigation' | 'drench' | 'scouting' | 'irrigation' | 'other';

export type CultivationActivity = {
  id: string;
  blockId: string;
  blockName: string | null;
  activityType: ActivityType;
  activityLabel: string;
  activityDate: string;
  dateLabel: string;
  costInr: number | null;
  status: string;
  notes: string | null;
  /** Present only for WhatsApp Farm Assistant–confirmed rows; omit on legacy records. */
  provenance?: FarmConfirmedRecordProvenance | null;
};
