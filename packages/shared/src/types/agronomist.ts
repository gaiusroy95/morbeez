export type AgronomistFarmerSearchRow = {
  id: string;
  name: string;
  phone: string | null;
  district: string | null;
  village?: string | null;
  acreage?: number | null;
  primaryCrop?: string | null;
  dap?: number | null;
  distanceKm?: number | null;
  healthStatus?: string | null;
  lastVisitAt?: string | null;
  openTaskCount?: number;
};

export type AgronomistBlockRow = {
  id: string;
  name: string;
  cropType: string;
  plotLabel: string | null;
  dap?: number | null;
  plantingDate?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  hasPlotGps?: boolean;
  acreage?: number | null;
  area?: string | null;
  soilHealth?: string | null;
  soilHealthLabel?: string;
  soilHealthStatus?: string;
  lastVisitAt?: string | null;
  lastVisitDap?: number | null;
  cropHealthLabel?: string;
  cropHealthStatus?: string;
  latestFindingLabel?: string | null;
  latestFieldActivity?: string | null;
  latestSoilTestAt?: string | null;
  needsAttention?: boolean;
  openIssueCount?: number;
  blockHealth?: string | null;
};

export type AgronomistDashboard = {
  todaysVisits: number;
  routesToday: number;
  pendingFollowUps: number;
  pendingCallbacks: number;
  openEscalations: number;
  newSoilReports: number;
  aiReviewCases: number;
  findingReviewQueue: number;
  focusFarmers: Array<{
    farmerId: string;
    farmerName: string;
    opportunityScore: number | null;
    riskBand: string | null;
    reason: string;
  }>;
};

export type AgronomistTaskItem = {
  id: string;
  kind: 'visit' | 'follow_up' | 'callback' | 'escalation' | 'ai_review' | 'finding_review';
  title: string;
  subtitle: string;
  dueAt: string | null;
  status: string;
  farmerId?: string | null;
  leadId?: string | null;
  refId?: string;
  priority?: number | null;
};

export type AgronomistCallbackRow = {
  id: string;
  farmerId: string;
  farmerName: string | null;
  phone: string | null;
  reason: string | null;
  status: string;
  requestedAt: string;
  dueAt: string | null;
};

export type AgronomistEscalationRow = {
  id: string;
  farmerId: string | null;
  farmerName: string | null;
  type: string;
  status: string;
  summary: string | null;
  createdAt: string;
};

export type RouteCoordSource = 'plot_gps' | 'pincode' | 'district' | 'none';

export type AgentRouteStop = {
  id: string;
  farmerId: string;
  farmerName: string;
  blockId: string | null;
  blockName: string | null;
  sortOrder: number;
  latitude: number | null;
  longitude: number | null;
  coordSource: RouteCoordSource;
  pincode: string | null;
  pincodeId: string | null;
};

export type PincodeClusterSummary = {
  pincode: string | null;
  pincodeId: string | null;
  stopCount: number;
  centroidLat: number | null;
  centroidLng: number | null;
};

export type AgentRouteSummary = {
  id: string;
  routeName: string;
  routeDate: string;
  status: string;
  stopCount: number;
  estimatedDistanceKm: number | null;
  estimatedHours: number | null;
  pincodeClusters: PincodeClusterSummary[];
  stops: AgentRouteStop[];
};

/** @deprecated Use AgentRouteSummary — kept for agronomist client compatibility */
export type AgronomistRouteSummary = AgentRouteSummary;

export type AgronomistVisitSession = {
  id: string;
  farmerId: string;
  blockId: string | null;
  status: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
};

export type AgronomistWorkspaceSummary = {
  farmer: {
    id: string;
    name: string;
    phone: string | null;
    district: string | null;
    acreage: number | null;
  };
  leadId: string | null;
  healthStatus: string;
  activeCrops: string[];
  dap: number | null;
  lastVisitAt: string | null;
  pendingTaskCount: number;
  openEscalationCount: number;
};

export type FarmerWorkspaceDashboard = AgronomistWorkspaceSummary & {
  openIssuesCount: number;
  pendingRecommendationsCount: number;
  pendingFindingReviewsCount: number;
  pendingAiCasesCount: number;
  todaysVisitsCount: number;
  lastCallAt: string | null;
  farmerSummary: {
    name: string;
    lastCallAt: string | null;
    lastVisitAt: string | null;
    openIssuesCount: number;
    pendingRecommendationsCount: number;
  };
};

export type FarmerVisitRow = {
  id: string;
  blockId: string | null;
  blockName: string;
  cropType: string | null;
  visitedAt: string;
  dapAtVisit: number | null;
  issueCount: number;
  recommendationCount: number;
  summary: string;
  blockHealth: string | null;
};

/** Structured field finding list row (extends visit timeline with issue intelligence). */
export type FarmerFieldFindingRow = FarmerVisitRow & {
  topIssueNames: string[];
};

export type FieldFindingStatusFilter = 'all' | 'open' | 'monitoring' | 'resolved';

export type FarmerOrderRow = {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  totalAmount?: number | null;
  createdAt?: string | null;
  lineItems?: Array<{ title?: string; quantity?: number }>;
};

export type AgronomistDocumentRow = {
  id: string;
  type: string;
  title: string;
  url: string | null;
  createdAt: string;
};

export type AgronomistRecommendationRow = {
  id: string;
  farmerId: string;
  blockId: string | null;
  fieldFindingId: string | null;
  visitIssueId?: string | null;
  issueDetected: string | null;
  recommendationText: string;
  dosage: string | null;
  status: string;
  fieldRecStatus?: string | null;
  priority?: string | null;
  reviewDate?: string | null;
  outcome?: string | null;
  createdAt: string;
};

/** Prefill payload when opening a farm visit from a farmer-workspace recommendation or escalation. */
export type RecommendationVisitContext = {
  recommendationId: string | null;
  farmerId: string;
  farmerName: string | null;
  blockId: string | null;
  blockName: string | null;
  cropType: string | null;
  aiSessionId: string | null;
  escalationId: string | null;
  issueDetected: string | null;
  aiDiagnosis: string | null;
  aiConfidence: number | null;
  recommendationText: string;
  symptomsText: string | null;
  images: Array<{ url: string; caption: string | null; suggestedPhotoType?: string | null }>;
  source: string | null;
  status: string | null;
  /** True when visit is opened to verify/correct a prior AI advisory. */
  rectificationMode?: boolean;
};

export type FieldVisitQuestion = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

export type ReviewQueueItem = {
  finding: {
    id: string;
    blockName: string;
    cropType: string;
    diseasePest: string | null;
    visitedAt: string;
  };
  farmer: { name: string | null; phone: string | null } | null;
  existingRecommendation: { id: string; status: string } | null;
};
