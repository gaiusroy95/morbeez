export const LEAD_QUEUE_TABLE = 'telecaller_leads';

export type LeadQueueColumnId =
  | 'priority'
  | 'farmerName'
  | 'cropAcreage'
  | 'pendingTasks'
  | 'escalations'
  | 'lastInteraction'
  | 'owner'
  | 'stage'
  | 'actions'
  | 'phone'
  | 'district'
  | 'pincode'
  | 'language'
  | 'relationshipScore'
  | 'opportunityScore'
  | 'dap'
  | 'roiPotential'
  | 'healthStatus'
  | 'followUpDue'
  | 'createdDate';

export type LeadQueueColumnDef = {
  id: LeadQueueColumnId;
  label: string;
  defaultVisible: boolean;
  sticky?: boolean;
  defaultWidth: number;
  optional?: boolean;
};

export const LEAD_QUEUE_COLUMNS: LeadQueueColumnDef[] = [
  { id: 'priority', label: 'Priority', defaultVisible: true, sticky: true, defaultWidth: 108 },
  { id: 'farmerName', label: 'Farmer Name', defaultVisible: true, sticky: true, defaultWidth: 168 },
  { id: 'cropAcreage', label: 'Crop & Acreage', defaultVisible: true, defaultWidth: 140 },
  { id: 'pendingTasks', label: 'Pending Tasks', defaultVisible: true, defaultWidth: 108 },
  { id: 'escalations', label: 'Escalations', defaultVisible: true, defaultWidth: 96 },
  { id: 'lastInteraction', label: 'Last Interaction', defaultVisible: true, defaultWidth: 148 },
  { id: 'owner', label: 'Owner', defaultVisible: true, defaultWidth: 120 },
  { id: 'stage', label: 'Stage', defaultVisible: true, defaultWidth: 120 },
  { id: 'actions', label: 'Actions', defaultVisible: true, sticky: true, defaultWidth: 200 },
  { id: 'phone', label: 'Phone', defaultVisible: false, optional: true, defaultWidth: 120 },
  { id: 'district', label: 'District', defaultVisible: false, optional: true, defaultWidth: 110 },
  { id: 'pincode', label: 'Pincode', defaultVisible: false, optional: true, defaultWidth: 88 },
  { id: 'language', label: 'Language', defaultVisible: false, optional: true, defaultWidth: 88 },
  {
    id: 'relationshipScore',
    label: 'Relationship Score',
    defaultVisible: false,
    optional: true,
    defaultWidth: 120,
  },
  {
    id: 'opportunityScore',
    label: 'Opportunity Score',
    defaultVisible: false,
    optional: true,
    defaultWidth: 120,
  },
  { id: 'dap', label: 'DAP', defaultVisible: false, optional: true, defaultWidth: 72 },
  { id: 'roiPotential', label: 'ROI Potential', defaultVisible: false, optional: true, defaultWidth: 100 },
  { id: 'healthStatus', label: 'Health Status', defaultVisible: false, optional: true, defaultWidth: 110 },
  { id: 'followUpDue', label: 'Follow-up Due', defaultVisible: false, optional: true, defaultWidth: 130 },
  { id: 'createdDate', label: 'Created Date', defaultVisible: false, optional: true, defaultWidth: 130 },
];

export const DEFAULT_COLUMN_ORDER = LEAD_QUEUE_COLUMNS.map((c) => c.id);

export const DEFAULT_VISIBLE_COLUMNS = LEAD_QUEUE_COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.id
);

export const DEFAULT_FILTER_STATE = {
  pendingTasks: true,
  smartFilter: 'pending' as const,
  sort: 'priority' as const,
  search: '',
  stage: '',
  district: '',
  pincode: '',
  language: '',
  crop: '',
  owner: '',
  opportunityLevel: '' as '' | 'high' | 'medium' | 'low',
  escalationsOnly: false,
};

export type ViewPresetId = 'telecaller' | 'manager' | 'agronomist';

export const VIEW_PRESETS: Record<
  ViewPresetId,
  { label: string; visibleColumns: LeadQueueColumnId[]; columnOrder: LeadQueueColumnId[] }
> = {
  telecaller: {
    label: 'Telecaller Workflow',
    visibleColumns: [
      'priority',
      'farmerName',
      'pendingTasks',
      'phone',
      'followUpDue',
      'cropAcreage',
      'stage',
      'actions',
    ],
    columnOrder: [
      'pendingTasks',
      'phone',
      'followUpDue',
      'priority',
      'farmerName',
      'cropAcreage',
      'escalations',
      'lastInteraction',
      'stage',
      'actions',
    ],
  },
  manager: {
    label: 'Manager Workflow',
    visibleColumns: [
      'priority',
      'farmerName',
      'opportunityScore',
      'relationshipScore',
      'owner',
      'stage',
      'pendingTasks',
      'actions',
    ],
    columnOrder: [
      'priority',
      'farmerName',
      'opportunityScore',
      'relationshipScore',
      'owner',
      'escalations',
      'pendingTasks',
      'stage',
      'lastInteraction',
      'actions',
    ],
  },
  agronomist: {
    label: 'Agronomist Workflow',
    visibleColumns: [
      'priority',
      'farmerName',
      'cropAcreage',
      'dap',
      'escalations',
      'healthStatus',
      'pendingTasks',
      'actions',
    ],
    columnOrder: [
      'priority',
      'farmerName',
      'cropAcreage',
      'dap',
      'escalations',
      'healthStatus',
      'pendingTasks',
      'followUpDue',
      'actions',
    ],
  },
};

export type LeadPriorityColor = 'red' | 'orange' | 'yellow' | 'green' | 'gray';

export const PRIORITY_COLOR_CLASS: Record<LeadPriorityColor, string> = {
  red: 'tc-priority--red',
  orange: 'tc-priority--orange',
  yellow: 'tc-priority--yellow',
  green: 'tc-priority--green',
  gray: 'tc-priority--gray',
};

export const SMART_FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'due_today', label: 'Due Today' },
  { id: 'hot_leads', label: 'Hot Leads' },
  { id: 'high_acreage', label: 'High Acreage' },
  { id: 'no_engagement', label: 'No Engagement' },
  { id: 'all', label: 'All Leads' },
] as const;
