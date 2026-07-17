export const FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION = 'farm-activity-assistant/v1' as const;

export type FarmActivityAssistantContractVersion =
  typeof FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION;

export type FarmActivityAssistantConfidence = 'low' | 'medium' | 'high';

export type FarmActivityAssistantProvenance =
  | 'explicit_text'
  | 'voice_transcript'
  | 'source_media'
  | 'conversation_context'
  | 'assistant_inference'
  | 'user_edit';

export type FarmActivityAssistantUnresolved = {
  reason: 'missing' | 'ambiguous' | 'conflicting' | 'unsupported';
  detail: string;
};

/**
 * Every extracted value carries its own confidence and provenance. A null
 * value must explain why it is unresolved; a resolved value must not.
 */
export type FarmActivityAssistantField<T> =
  | {
      value: T;
      confidence: FarmActivityAssistantConfidence;
      provenance: FarmActivityAssistantProvenance[];
      sourceRefs: string[];
      unresolved?: never;
    }
  | {
      value: null;
      confidence: 'low';
      provenance: FarmActivityAssistantProvenance[];
      sourceRefs: string[];
      unresolved: FarmActivityAssistantUnresolved;
    };

export type FarmActivityAssistantLanguage = {
  code: string;
  detected: boolean;
  confidence: FarmActivityAssistantConfidence;
};

export type FarmActivityAssistantSourceMedia = {
  id: string;
  kind: 'audio' | 'image' | 'video' | 'document';
  mimeType: string;
  fileName?: string;
  uri?: string;
};

export type FarmActivityAssistantTranscriptSegment = {
  id: string;
  text: string;
  startMs?: number;
  endMs?: number;
  languageCode?: string;
  mediaRef?: string;
};

export type FarmActivityAssistantSource = {
  messageId: string;
  channel: 'whatsapp' | 'app' | 'api';
  text?: string;
  language: FarmActivityAssistantLanguage;
  media: FarmActivityAssistantSourceMedia[];
  transcript: FarmActivityAssistantTranscriptSegment[];
};

export type FarmActivityAssistantUnit =
  | 'kg'
  | 'g'
  | 'litre'
  | 'ml'
  | 'quintal'
  | 'tonne'
  | 'bag'
  | 'piece'
  | 'hour'
  | 'day'
  | 'acre'
  | 'other';

export type FarmActivityAssistantMoney = {
  amount: number;
  currency: 'INR';
};

export type FarmActivityAssistantBaseSubEvent = {
  id: string;
  sequence: number;
  sourceRefs: string[];
};

export type FarmActivityAssistantActivitySubEvent = FarmActivityAssistantBaseSubEvent & {
  kind: 'activity';
  occurredOn: FarmActivityAssistantField<string>;
  activityType: FarmActivityAssistantField<string>;
  blockRef: FarmActivityAssistantField<string>;
  description: FarmActivityAssistantField<string>;
  quantity: FarmActivityAssistantField<number>;
  unit: FarmActivityAssistantField<FarmActivityAssistantUnit>;
};

export type FarmActivityAssistantLabourSubEvent = FarmActivityAssistantBaseSubEvent & {
  kind: 'labour';
  occurredOn: FarmActivityAssistantField<string>;
  workType: FarmActivityAssistantField<string>;
  workerCount: FarmActivityAssistantField<number>;
  durationHours: FarmActivityAssistantField<number>;
  rate: FarmActivityAssistantField<FarmActivityAssistantMoney>;
  totalCost: FarmActivityAssistantField<FarmActivityAssistantMoney>;
};

export type FarmActivityAssistantPurchaseSubEvent = FarmActivityAssistantBaseSubEvent & {
  kind: 'purchase';
  occurredOn: FarmActivityAssistantField<string>;
  itemName: FarmActivityAssistantField<string>;
  vendorName: FarmActivityAssistantField<string>;
  quantity: FarmActivityAssistantField<number>;
  unit: FarmActivityAssistantField<FarmActivityAssistantUnit>;
  unitPrice: FarmActivityAssistantField<FarmActivityAssistantMoney>;
  totalCost: FarmActivityAssistantField<FarmActivityAssistantMoney>;
};

export type FarmActivityAssistantExpenseSubEvent = FarmActivityAssistantBaseSubEvent & {
  kind: 'expense';
  occurredOn: FarmActivityAssistantField<string>;
  category: FarmActivityAssistantField<string>;
  description: FarmActivityAssistantField<string>;
  amount: FarmActivityAssistantField<FarmActivityAssistantMoney>;
  paidTo: FarmActivityAssistantField<string>;
};

export type FarmActivityAssistantHarvestSubEvent = FarmActivityAssistantBaseSubEvent & {
  kind: 'harvest';
  occurredOn: FarmActivityAssistantField<string>;
  cropName: FarmActivityAssistantField<string>;
  blockRef: FarmActivityAssistantField<string>;
  quantity: FarmActivityAssistantField<number>;
  unit: FarmActivityAssistantField<FarmActivityAssistantUnit>;
  grade: FarmActivityAssistantField<string>;
  buyerName: FarmActivityAssistantField<string>;
  saleAmount: FarmActivityAssistantField<FarmActivityAssistantMoney>;
};

export type FarmActivityAssistantInventoryMovementSubEvent =
  FarmActivityAssistantBaseSubEvent & {
    kind: 'inventory_movement';
    occurredOn: FarmActivityAssistantField<string>;
    movementType: FarmActivityAssistantField<
      'stock_in' | 'stock_out' | 'transfer' | 'adjustment'
    >;
    itemName: FarmActivityAssistantField<string>;
    quantity: FarmActivityAssistantField<number>;
    unit: FarmActivityAssistantField<FarmActivityAssistantUnit>;
    fromLocation: FarmActivityAssistantField<string>;
    toLocation: FarmActivityAssistantField<string>;
  };

export type FarmActivityAssistantSubEvent =
  | FarmActivityAssistantActivitySubEvent
  | FarmActivityAssistantLabourSubEvent
  | FarmActivityAssistantPurchaseSubEvent
  | FarmActivityAssistantExpenseSubEvent
  | FarmActivityAssistantHarvestSubEvent
  | FarmActivityAssistantInventoryMovementSubEvent;

export type FarmActivityAssistantSubEventKind = FarmActivityAssistantSubEvent['kind'];

export type FarmActivityAssistantFieldName = Exclude<
  keyof FarmActivityAssistantSubEvent,
  'id' | 'kind' | 'sequence' | 'sourceRefs'
>;

export type FarmActivityAssistantClarification = {
  id: string;
  question: string;
  subEventId: string;
  field: string;
  required: boolean;
  options?: string[];
};

export type FarmActivityAssistantDraftV1 = {
  contractVersion: FarmActivityAssistantContractVersion;
  draftId: string;
  revision: number;
  source: FarmActivityAssistantSource;
  subEvents: FarmActivityAssistantSubEvent[];
  clarifications: FarmActivityAssistantClarification[];
};

export type FarmActivityAssistantConfirmAction = {
  action: 'confirm';
  draftId: string;
  revision: number;
};

/**
 * Editing replaces explicitly selected sub-events, keeping the action
 * allowlisted and avoiding unsafe arbitrary object paths.
 */
export type FarmActivityAssistantEditAction = {
  action: 'edit';
  draftId: string;
  revision: number;
  subEvents: FarmActivityAssistantSubEvent[];
};

export type FarmActivityAssistantCancelAction = {
  action: 'cancel';
  draftId: string;
  revision: number;
  reason?: string;
};

export type FarmActivityAssistantAction =
  | FarmActivityAssistantConfirmAction
  | FarmActivityAssistantEditAction
  | FarmActivityAssistantCancelAction;

export type FarmActivityAssistantValidationError = {
  path: string;
  code: string;
  message: string;
};

export type FarmActivityAssistantValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FarmActivityAssistantValidationError[] };
