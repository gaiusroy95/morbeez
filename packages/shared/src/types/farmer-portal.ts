export type PortalOrder = {
  id: string;
  orderNumber: string;
  productTitle: string;
  productImageUrl: string | null;
  quantity: number;
  amountInr: number;
  status: string;
  statusLabel: string;
  statusTone: string;
  orderedOn: string;
  deliveredOn: string;
  trackingAwb?: string | null;
  trackingUrl?: string | null;
  lineItems: Array<{ title: string; quantity: number; imageUrl?: string | null }>;
};

export type PortalSummary = {
  greetingName: string;
  crop: {
    name: string;
    variety: string | null;
    fieldSize: string | null;
    blockName: string;
    blockId?: string | null;
    stage: string;
    daysAfterPlanting: number | null;
    cycleDays?: number | null;
  } | null;
  shippingAddress: {
    name: string;
    phone: string | null;
    lines: string[];
    verified: boolean;
  };
  atAGlance: {
    activeOrders: number;
    nextAdvisory: string;
    nextAdvisoryHint: string | null;
    newReports: number;
    estimatedProfitInr: number;
  };
  todayMarket: {
    crop: string;
    pricePerKg: number;
    marketName: string;
    trend: 'up' | 'down' | 'flat' | null;
    date: string;
  } | null;
  finance: {
    todayExpenseInr: number;
    monthExpenseInr: number;
    projectedProfitInr: number;
  };
  tasks: Array<{ id: string; label: string; dueLabel: string; href: string }>;
  quickAccess: {
    ordersCount: number;
    hasAdvisory: boolean;
    reportsCount: number;
    roiBalance: number;
  };
  latestRecommendation: {
    id: string;
    cropName: string;
    stage: string | null;
    dateLabel: string;
    dayLabel: string | null;
    bullets: string[];
    summary: string | null;
  } | null;
  recentOrder: PortalOrder | null;
  notifications: Array<{ id: string; type: string; message: string; atLabel: string; tone: string }>;
};

export type PortalAdvisory = {
  crop: {
    name: string;
    fieldSize: string | null;
    stage: string;
    daysAfterPlanting: number | null;
  } | null;
  recommendations: Array<{
    id: string;
    dateLabel: string;
    cropName: string;
    blockName: string | null;
    stage: string | null;
    dayLabel: string | null;
    title: string;
    bullets: string[];
    applicationMethod: string | null;
    followUpLabel: string | null;
    status: string;
  }>;
  schedule: Array<{ id: string; dueLabel: string; type: string; notes: string | null }>;
  alerts: Array<{ message: string; dueLabel: string }>;
};

export type PortalSoilReport = {
  id: string;
  blockId: string | null;
  blockName: string;
  dateLabel: string;
  dapLabel?: string | null;
  health: string;
  healthLabel: string;
  pdfUrl: string | null;
  highlights: string[];
  metrics?: Array<{ label: string; value: string }>;
};

export type PortalRoi = {
  summary: {
    inputCostInr: number;
    estimatedYieldIncomeInr: number;
    estimatedProfitInr: number;
    acreage: number | null;
    marketNote: string;
  };
  recentEntries: Array<{
    id: string;
    dateLabel: string;
    category: string;
    amountInr: number;
    type: string;
    note: string | null;
  }>;
};

export type PortalTracking = {
  order: PortalOrder;
  tracking: Record<string, unknown>;
  timeline: Array<{ key: string; label: string; at: string | null; done: boolean; pending?: boolean }>;
  lineItems: Array<{ title: string; quantity: number }>;
  canReview: boolean;
  reviewLines: Array<{ productKey: string; title: string; rating?: number }>;
};

export type FarmerProfile = {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  shippingAddress?: string | null;
  deliveryPincode?: string | null;
  city?: string | null;
  state?: string | null;
  district?: string | null;
  village?: string | null;
  hasPassword?: boolean;
  preferredLanguage?: string | null;
};
