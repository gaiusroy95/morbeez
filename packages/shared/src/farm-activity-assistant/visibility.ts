/**
 * Farmer/staff visibility helpers for WhatsApp-confirmed farm activity & ROI rows.
 * All fields are optional so legacy records without provenance degrade gracefully.
 */

export type FarmConfirmedSourceChannel = 'whatsapp' | 'app' | 'api' | 'unknown' | (string & {});

export type FarmConfirmedInputModality =
  | 'voice'
  | 'text'
  | 'image'
  | 'invoice'
  | 'unknown'
  | (string & {});

/**
 * Additive provenance envelope returned on cultivation activities / ROI entries
 * after Farm Activity Assistant confirm. Absent or partial on older rows.
 */
export type FarmConfirmedRecordProvenance = {
  sourceChannel?: FarmConfirmedSourceChannel | null;
  inputModality?: FarmConfirmedInputModality | null;
  /** Explicit confirmed-via-WhatsApp flag when API provides it. */
  whatsappConfirmed?: boolean | null;
  confirmedAt?: string | null;
  confirmedAtLabel?: string | null;
  linkedActivityId?: string | null;
  linkedActivityLabel?: string | null;
  linkedRoiEntryId?: string | null;
  linkedRoiLabel?: string | null;
  canCorrect?: boolean | null;
  canUndo?: boolean | null;
  correctionUrl?: string | null;
  undoUrl?: string | null;
  /** Prefill text when falling back to WhatsApp support for corrections. */
  supportCorrectionMessage?: string | null;
};

export type FarmConfirmedVisibilityBadge =
  | 'whatsapp_voice'
  | 'whatsapp'
  | 'voice'
  | null;

export type FarmConfirmedCorrectionPath =
  | { kind: 'correct'; url: string }
  | { kind: 'undo'; url: string }
  | { kind: 'support'; message: string }
  | { kind: 'none' };

export type FarmConfirmedVisibility = {
  /** True when this row is a WhatsApp (or WhatsApp+voice) confirmed assistant entry. */
  isWhatsAppConfirmed: boolean;
  badge: FarmConfirmedVisibilityBadge;
  confirmedAt: string | null;
  confirmedAtLabel: string | null;
  linkedActivityId: string | null;
  linkedActivityLabel: string | null;
  linkedRoiEntryId: string | null;
  linkedRoiLabel: string | null;
  correctionPath: FarmConfirmedCorrectionPath;
};

export type FarmConfirmedVisibilityInput = {
  provenance?: FarmConfirmedRecordProvenance | null;
} & Partial<FarmConfirmedRecordProvenance>;

function trimText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asBool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function mergeProvenance(input: FarmConfirmedVisibilityInput | null | undefined): FarmConfirmedRecordProvenance {
  const nested = input?.provenance ?? {};
  return {
    sourceChannel: input?.sourceChannel ?? nested.sourceChannel ?? null,
    inputModality: input?.inputModality ?? nested.inputModality ?? null,
    whatsappConfirmed: input?.whatsappConfirmed ?? nested.whatsappConfirmed ?? null,
    confirmedAt: input?.confirmedAt ?? nested.confirmedAt ?? null,
    confirmedAtLabel: input?.confirmedAtLabel ?? nested.confirmedAtLabel ?? null,
    linkedActivityId: input?.linkedActivityId ?? nested.linkedActivityId ?? null,
    linkedActivityLabel: input?.linkedActivityLabel ?? nested.linkedActivityLabel ?? null,
    linkedRoiEntryId: input?.linkedRoiEntryId ?? nested.linkedRoiEntryId ?? null,
    linkedRoiLabel: input?.linkedRoiLabel ?? nested.linkedRoiLabel ?? null,
    canCorrect: input?.canCorrect ?? nested.canCorrect ?? null,
    canUndo: input?.canUndo ?? nested.canUndo ?? null,
    correctionUrl: input?.correctionUrl ?? nested.correctionUrl ?? null,
    undoUrl: input?.undoUrl ?? nested.undoUrl ?? null,
    supportCorrectionMessage:
      input?.supportCorrectionMessage ?? nested.supportCorrectionMessage ?? null,
  };
}

function channelIsWhatsApp(channel: string | null): boolean {
  if (!channel) return false;
  const normalized = channel.toLowerCase();
  return normalized === 'whatsapp' || normalized === 'wa' || normalized.includes('whatsapp');
}

function modalityIsVoice(modality: string | null): boolean {
  if (!modality) return false;
  const normalized = modality.toLowerCase();
  return normalized === 'voice' || normalized === 'audio' || normalized.includes('voice');
}

function resolveBadge(params: {
  isWhatsApp: boolean;
  isVoice: boolean;
}): FarmConfirmedVisibilityBadge {
  if (params.isWhatsApp && params.isVoice) return 'whatsapp_voice';
  if (params.isWhatsApp) return 'whatsapp';
  if (params.isVoice) return 'voice';
  return null;
}

function resolveCorrectionPath(p: FarmConfirmedRecordProvenance): FarmConfirmedCorrectionPath {
  const correctionUrl = trimText(p.correctionUrl);
  const undoUrl = trimText(p.undoUrl);
  if (asBool(p.canCorrect) === true && correctionUrl) {
    return { kind: 'correct', url: correctionUrl };
  }
  if (asBool(p.canUndo) === true && undoUrl) {
    return { kind: 'undo', url: undoUrl };
  }
  // Prefer explicit URLs even when boolean flags are omitted by older API payloads.
  if (correctionUrl) return { kind: 'correct', url: correctionUrl };
  if (undoUrl) return { kind: 'undo', url: undoUrl };

  const supportMessage = trimText(p.supportCorrectionMessage);
  if (supportMessage) return { kind: 'support', message: supportMessage };

  return { kind: 'none' };
}

/**
 * Normalize optional API provenance into a stable farmer-app visibility model.
 * Old records without provenance fields yield a no-op visibility object.
 */
export function resolveFarmConfirmedVisibility(
  input: FarmConfirmedVisibilityInput | null | undefined
): FarmConfirmedVisibility {
  const p = mergeProvenance(input);
  const sourceChannel = trimText(p.sourceChannel);
  const inputModality = trimText(p.inputModality);
  const explicitWhatsApp = asBool(p.whatsappConfirmed);
  const isWhatsApp = explicitWhatsApp === true || channelIsWhatsApp(sourceChannel);
  const isVoice = modalityIsVoice(inputModality);
  const badge = resolveBadge({ isWhatsApp, isVoice });

  // Farmer surfaces only highlight WhatsApp-confirmed assistant entries.
  const isWhatsAppConfirmed = isWhatsApp && badge != null;

  const confirmedAt = trimText(p.confirmedAt);
  const confirmedAtLabel = trimText(p.confirmedAtLabel);

  return {
    isWhatsAppConfirmed,
    badge: isWhatsAppConfirmed ? badge : null,
    confirmedAt: isWhatsAppConfirmed ? confirmedAt : null,
    confirmedAtLabel: isWhatsAppConfirmed ? (confirmedAtLabel ?? confirmedAt) : null,
    linkedActivityId: isWhatsAppConfirmed ? trimText(p.linkedActivityId) : null,
    linkedActivityLabel: isWhatsAppConfirmed ? trimText(p.linkedActivityLabel) : null,
    linkedRoiEntryId: isWhatsAppConfirmed ? trimText(p.linkedRoiEntryId) : null,
    linkedRoiLabel: isWhatsAppConfirmed ? trimText(p.linkedRoiLabel) : null,
    correctionPath: isWhatsAppConfirmed ? resolveCorrectionPath(p) : { kind: 'none' },
  };
}

export function farmConfirmedBadgeLabel(badge: FarmConfirmedVisibilityBadge): string | null {
  switch (badge) {
    case 'whatsapp_voice':
      return 'WhatsApp · Voice';
    case 'whatsapp':
      return 'WhatsApp';
    case 'voice':
      return 'Voice';
    default:
      return null;
  }
}

export function farmConfirmedProvenanceSummary(visibility: FarmConfirmedVisibility): string | null {
  if (!visibility.isWhatsAppConfirmed) return null;
  const parts: string[] = [];
  if (visibility.confirmedAtLabel) {
    parts.push(`Confirmed ${visibility.confirmedAtLabel}`);
  }
  if (visibility.linkedRoiLabel) {
    parts.push(`ROI: ${visibility.linkedRoiLabel}`);
  } else if (visibility.linkedActivityLabel) {
    parts.push(`Activity: ${visibility.linkedActivityLabel}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

export function farmConfirmedHasCorrectionPath(visibility: FarmConfirmedVisibility): boolean {
  return visibility.correctionPath.kind !== 'none';
}
