import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { blockService } from '../core/block.service.js';
import type { AdvisoryLanguage } from '../ai/types.js';
import { isExplicitAgronomyQuestion } from '../whatsapp/pipeline/agriculture-free-text.service.js';
import { farmerMessageStoreService } from './farmer-message-store.service.js';
import { terminologyDetectionEngine } from './terminology-detection.engine.js';
import { terminologyEscalationService } from './terminology-escalation.service.js';
import { responseLocalizationService } from './response-localization.service.js';
import type { TerminologyDetectionResult } from './types.js';

function enabled(): boolean {
  return env.ENABLE_REGIONAL_TERMINOLOGY_ENGINE !== false;
}

async function farmerContext(farmerId: string) {
  const { data: farmer } = await supabase
    .from('farmers')
    .select('district, preferred_language')
    .eq('id', farmerId)
    .maybeSingle();
  const primary = await blockService.getPrimaryBlock(farmerId);
  return {
    district: farmer?.district ? String(farmer.district) : null,
    cropType: primary?.crop_type?.toLowerCase() ?? null,
  };
}

/**
 * End-to-end regional terminology pipeline for one inbound farmer message.
 */
export const regionalTerminologyProcessor = {
  enabled,

  async processInbound(params: {
    farmerId: string;
    text: string;
    language: AdvisoryLanguage;
    messageType?: string;
    externalMessageId?: string;
  }): Promise<{
    detection: TerminologyDetectionResult | null;
    messageId: string | null;
    /** True when we sent escalation reply and should stop further AI for this turn. */
    handled: boolean;
    reduceAiConfidence: boolean;
  }> {
    if (!enabled() || !params.text?.trim()) {
      return { detection: null, messageId: null, handled: false, reduceAiConfidence: false };
    }

    const ctx = await farmerContext(params.farmerId);
    const messageId = await farmerMessageStoreService.record({
      farmerId: params.farmerId,
      rawMessage: params.text,
      detectedLanguage: params.language,
      messageType: params.messageType,
      externalMessageId: params.externalMessageId,
      metadata: { cropType: ctx.cropType, district: ctx.district },
    });

    const detection = await terminologyDetectionEngine.detect({
      rawMessage: params.text,
      language: params.language,
      cropType: ctx.cropType,
      district: ctx.district,
    });

    if (!detection.hasUnknown) {
      return { detection, messageId, handled: false, reduceAiConfidence: false };
    }

    for (const unknown of detection.unknownTerms) {
      await terminologyEscalationService.escalateUnknown({
        farmerId: params.farmerId,
        unknownWord: unknown.token,
        rawMessage: params.text,
        language: params.language,
        cropType: ctx.cropType,
        district: ctx.district,
      });
    }

    const wordCount = params.text.trim().split(/\s+/).length;
    const isShortUnknownOnly =
      wordCount <= 4 && !isExplicitAgronomyQuestion(params.text) && detection.knownTerms.length === 0;

    if (isShortUnknownOnly) {
      return {
        detection,
        messageId,
        handled: true,
        reduceAiConfidence: true,
      };
    }

    return {
      detection,
      messageId,
      handled: false,
      reduceAiConfidence: true,
    };
  },

  localizeOutbound(
    text: string,
    detection: TerminologyDetectionResult | null,
    language: AdvisoryLanguage
  ): string {
    return responseLocalizationService.localizeSync({
      standardResponse: text,
      detection,
      language,
    });
  },

  async localizeOutboundAsync(
    text: string,
    detection: TerminologyDetectionResult | null,
    language: AdvisoryLanguage,
    district?: string | null
  ): Promise<string> {
    return responseLocalizationService.localize({
      standardResponse: text,
      detection,
      language,
      district,
    });
  },

  pendingFarmerCopy(language: AdvisoryLanguage): string {
    return responseLocalizationService.farmerPendingCopy(language);
  },
};
