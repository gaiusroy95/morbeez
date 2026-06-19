export type PartnerStatus =
  | 'applied'
  | 'verified'
  | 'training'
  | 'certified'
  | 'active'
  | 'suspended'
  | 'inactive';

export type PartnerTier = 'associate' | 'certified' | 'senior' | 'master';

export type EnrollmentOwnerType = 'partner' | 'morbeez' | 'referral' | 'campaign';

export type CustomerOwnerType = 'partner' | 'morbeez';

export type ServiceModel = 'remote_advisory' | 'partner_assisted';

export type PartnerAttributionType =
  | 'enrollment'
  | 'visit'
  | 'meeting'
  | 'soil_collection'
  | 'conversion_assist'
  | 'reactivation';

export type FarmerOwnership = {
  enrollmentOwnerType: EnrollmentOwnerType | null;
  enrollmentOwnerPartnerId: string | null;
  enrollmentOwnerPartnerName?: string | null;
  enrollmentSource: string | null;
  enrollmentEventId: string | null;
  customerOwnerType: CustomerOwnerType | null;
  customerOwnerPartnerId: string | null;
  customerOwnerPartnerName?: string | null;
  serviceModel: ServiceModel | null;
  assignedPartnerId: string | null;
  assignedPartnerName?: string | null;
  assignedTelecallerEmail: string | null;
  assignedExpertEmail: string | null;
  partnerCodeAtEnrollment: string | null;
};

export type PartnerProfile = {
  id: string;
  partnerCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: PartnerStatus;
  tier: PartnerTier;
  state: string | null;
  district: string | null;
  village: string | null;
  languages: string[];
  cropsExpertise: string[];
  referralSlug: string | null;
  qrToken: string | null;
  maxActiveFarmers: number;
  currentActiveFarmers: number;
  reliabilityScore: number;
  performanceScore: number;
  leadAllocationWeight: number;
  commissionEligible: boolean;
  referralUrl?: string;
};

export type PartnerApplication = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  state: string | null;
  district: string | null;
  village: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  createdAt: string;
};

export type PartnerDashboardStats = {
  activeFarmers: number;
  pendingTasks: number;
  visitsThisMonth: number;
  routesToday: number;
  reliabilityScore: number;
  performanceScore: number;
  leadOffersPending: number;
};

export type { AgentRouteSummary, AgentRouteStop } from './agronomist';

export type PartnerLeadOffer = {
  id: string;
  leadId: string | null;
  farmerId: string | null;
  allocationScore: number;
  status: string;
  offeredAt: string;
  expiresAt: string | null;
};

export type FarmerTimelineEntry = {
  id: string;
  farmerId: string;
  taskId: string | null;
  fieldFindingId: string | null;
  authorType: 'telecaller' | 'partner' | 'expert' | 'admin' | 'system';
  authorName: string | null;
  authorEmail?: string | null;
  entryType: 'note' | 'comment' | 'escalation' | 'support_request' | 'review_request' | 'system_event';
  body: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type TeamTimelineEntry = FarmerTimelineEntry & {
  source: 'timeline' | 'task' | 'visit' | 'recommendation' | 'escalation' | 'call';
  title?: string;
};

export type PartnerSuggestedAction =
  | 'field_visit'
  | 'follow_up'
  | 'soil_sampling'
  | 'callback'
  | 'none';

export type PartnerFarmSnapshot = {
  totalAcreage: number | null;
  activeBlockCount: number;
  primaryCrop: string | null;
  cropStatus: string | null;
};

export type PartnerCurrentRecommendation = {
  id: string;
  title: string;
  status: string;
} | null;

export type PartnerFarmerHeader = {
  id: string;
  name: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  primaryCrop: string | null;
  totalAcreage: number | null;
  customerOwnerType: string | null;
  assignedTelecallerEmail: string | null;
  serviceModel: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type PartnerFarmerListRow = {
  id: string;
  name: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  primaryCrop: string | null;
  totalAcreage: number | null;
  lastOrderDate: string | null;
  suggestedAction: PartnerSuggestedAction;
  suggestedActionLabel: string;
};

export type PartnerFarmerOrderRow = {
  id: string;
  orderDate: string;
  products: string;
  quantity: number;
  deliveryStatus: string;
};

export type PartnerFarmerTaskRow = {
  id: string;
  title: string;
  taskType: string;
  taskCategory: string;
  dueAt: string | null;
  status: string;
  farmerId: string;
  blockId: string | null;
  priority: string;
  notes?: string | null;
};

export type PartnerEscalationRow = {
  id: string;
  body: string;
  entryType: string;
  status: 'open' | 'under_review' | 'resolved';
  createdAt: string;
};

export type PartnerVisitSessionRow = {
  id: string;
  farmerId: string;
  blockId: string | null;
  status: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
};

export type PartnerFarmerWorkspace = {
  farmer: PartnerFarmerHeader;
  header: PartnerFarmerHeader;
  blocks: Record<string, unknown>[];
  timeline: FarmerTimelineEntry[];
  ownership?: FarmerOwnership | null;
  farmSnapshot: PartnerFarmSnapshot;
  currentRecommendation: PartnerCurrentRecommendation;
  suggestedAction: PartnerSuggestedAction;
  suggestedActionLabel: string;
  pendingTaskCount?: number;
  openRecommendationsCount?: number;
  lastVisitAt?: string | null;
  salesOpportunities?: SalesOpportunity[];
  recentVisits?: PartnerVisitRow[];
};

export type PartnerVisitRow = {
  id: string;
  farmerId: string;
  farmerName?: string;
  blockId?: string | null;
  visitedAt: string;
  summary?: string;
  status?: string;
};

export type PartnerNotification = {
  id: string;
  category: string;
  title: string;
  detail?: string | null;
  at: string;
  farmerId?: string;
  taskId?: string;
};

export type SalesOpportunityStatus =
  | 'interested'
  | 'hot_lead'
  | 'ready_to_order'
  | 'follow_up_required'
  | 'converted'
  | 'closed';

export type SalesOpportunity = {
  id: string;
  farmerId: string;
  partnerId: string;
  product: string;
  expectedQuantity?: string | null;
  urgency?: string | null;
  interestLevel?: string | null;
  notes?: string | null;
  status: SalesOpportunityStatus;
  assignedTelecallerEmail?: string | null;
  leadId?: string | null;
  createdAt: string;
};

export type PartnerEarningsSummary = {
  month: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  serviceRevenue: number;
  productCommission: number;
  leadBonus: number;
  successBonus: number;
  pendingPayout: number;
  approvedPayout: number;
  paidPayout: number;
  reliabilityHoldPct: number;
};

export type PartnerEarningsLedgerRow = {
  id: string;
  category: string;
  grossInr: number;
  commissionInr: number;
  bonusInr: number;
  status: 'pending' | 'held' | 'approved' | 'paid' | 'reversed';
  periodMonth: string;
  createdAt: string;
};
