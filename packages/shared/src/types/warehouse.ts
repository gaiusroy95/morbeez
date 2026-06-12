export type WarehouseStats = {
  pending: number;
  packed: number;
  lrPending: number;
  completed: number;
  pendingOrders?: number;
  readyToPack?: number;
  packedToday?: number;
  handedOverToday?: number;
  courierPending?: number;
  failedAwb?: number;
  picking?: number;
  packing?: number;
  readyDispatch?: number;
  awaitingTracking?: number;
};

export type PrintDocType =
  | 'picking_slip'
  | 'packing_slip'
  | 'tax_invoice'
  | 'courier_label'
  | 'return_inspection';

export type PrintDocumentPayload = {
  ok?: boolean;
  type: PrintDocType;
  company: {
    companyName: string;
    formattedAddress: string;
    gstin: string;
    customerCareNumber: string;
    quotationLogoUrl?: string;
    termsAndConditions?: string;
  };
  document: Record<string, unknown>;
};

export type WarehouseEmployee = {
  id: string;
  fullName: string;
  email: string | null;
  role: string;
};

export type AssignableOrder = {
  id: string;
  orderName: string;
  omsStatus: string;
  courier: string;
  awb: string | null;
  createdAt: string;
};

export type LabelBatch = {
  id: string;
  batch_number: string;
  assigned_employee_id: string;
  assigned_employee_name: string;
  batch_status: string;
  total_orders: number;
  printed_at: string | null;
  created_at: string;
};

export type LabelStackItem = {
  labelId: string;
  commerceOrderId: string;
  orderName: string;
  printSequence: number;
  qrCode: string;
  awb: string | null;
  labelUrl: string | null;
  courier: string | null;
};

export type ShiprocketDiagnostics = {
  authOk: boolean;
  authError: string | null;
  authHint: string | null;
  walletBalanceInr: number | null;
  pickupLocationConfigured: string;
  pickupLocationsAvailable: string[];
  apiUserEmail: string | null;
};

export type QueueOrder = {
  id: string;
  orderName: string;
  customerName?: string | null;
  courier: string;
  itemCount: number;
  orderItemCount?: number;
  stockIssue?: 'no_order_lines' | 'no_stock_reserved' | null;
  missingProducts?: string[];
  priority: string;
  omsStatus: string;
  awb: string | null;
  shippingMethod?: 'shiprocket' | 'manual';
  needsManualTracking?: boolean;
  pickListId: string | null;
  shiprocketError: string | null;
  isCod?: boolean;
  totalAmount?: number;
  createdAt?: string;
  packedAt?: string | null;
  shippedAt?: string | null;
  assignedEmployee?: string | null;
};

export type RackLine = {
  row?: number;
  id: string;
  productTitle: string;
  sku: string | null;
  batchCode: string | null;
  qtyRequired: number;
  qtyPicked: number;
  remaining: number;
  complete: boolean;
};

export type RackProgress = {
  rack: string;
  lineCount: number;
  totalQty: number;
  pickedQty: number;
  complete: boolean;
  active: boolean;
};

export type PickWorkflow = {
  stage: 'picking' | 'pack' | 'print';
  step: number;
  currentRack: string | null;
  racks: RackProgress[];
  currentRackLines: RackLine[];
  pickComplete?: boolean;
  printEnabled: boolean;
};

export type PickLookup = {
  lineId: string;
  productTitle: string;
  sku: string | null;
  batchCode: string | null;
  qtyRequired: number;
  qtyPicked: number;
  remaining: number;
  defaultQty: number;
};

export type WarehouseOrderDetail = {
  order: {
    id: string;
    order_name: string | null;
    oms_status: string;
    courier_name: string | null;
    tracking_awb: string | null;
    label_url: string | null;
    dispatch_rack: string | null;
    shiprocket_error: string | null;
    shiprocket_shipment_id?: string | null;
    shipping_method?: string | null;
    tracking_status?: string | null;
    created_at?: string;
    picking_started_at?: string | null;
    label_verified_at?: string | null;
    package_confirmed_at?: string | null;
    shipped_at?: string | null;
    delivered_at?: string | null;
  };
  pickList: { id: string; picker_id?: string | null } | null;
  packSession: { id: string; scan_complete?: boolean } | null;
  invoice: { id: string; invoice_number: string } | null;
  suggestedDispatchRack: string | null;
  pickComplete?: boolean;
  printEnabled: boolean;
  fulfillmentGates?: {
    pickComplete: boolean;
    packRequired: boolean;
    printEnabled: boolean;
    awbPending: boolean;
    shippingMethod: 'shiprocket' | 'manual';
    packageConfirmed: boolean;
  };
  workflow: PickWorkflow | null;
  shippingMethod?: 'shiprocket' | 'manual';
  awbAssignAvailable?: boolean;
  shiprocketErrorDisplay?: string | null;
  shiprocketDiagnostics?: ShiprocketDiagnostics | null;
  customerSummary?: {
    phone: string | null;
    address: string | null;
    isCod: boolean;
    totalAmount: number;
  };
  assignment?: {
    employeeId: string | null;
    employeeName: string | null;
    batchId: string | null;
    pickingStartedAt: string | null;
    labelVerifiedAt: string | null;
  };
  shippingLabel?: {
    id: string;
    qrCode: string;
    labelVerified: boolean;
    verifiedAt?: string | null;
    printSequence?: number;
  } | null;
  package?: {
    status: string;
    suggestedBoxCode?: string;
    suggestedBoxName?: string;
    packagingCategoryName?: string;
    boxCount?: number;
    lengthCm?: number;
    breadthCm?: number;
    heightCm?: number;
    estimatedWeightKg?: number;
    packageWeightKg?: number;
    billingWeightKg?: number;
    overridden?: boolean;
    confirmedAt?: string | null;
  } | null;
};

export type PackForm = {
  boxId?: string;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
  weightKg?: number;
  packedBy?: string;
  freeSample?: boolean;
};

export type LRUpdatePayload = {
  courierName: string;
  trackingAwb: string;
  trackingUrl?: string | null;
  notifyCustomer?: boolean;
};

export type ShippingBox = {
  id: string;
  code: string;
  name: string;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  maxWeightKg?: number;
  tareWeightKg?: number;
};

export type WarehouseMaster = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
};

export type PrintableDoc = {
  type: 'picking_slip' | 'packing_slip' | 'tax_invoice' | 'courier_label' | 'return_inspection';
  id: string;
  label: string;
};

export type OrderTimelineStep = {
  key: string;
  label: string;
  status: 'done' | 'current' | 'pending';
  at: string | null;
  detail?: string | null;
};

export type WarehouseMobileModule = 'dashboard' | 'picking' | 'packing' | 'dispatch' | 'more';
