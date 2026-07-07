import type { StructuredAdvisory, AdvisoryLanguage } from '../../ai/types.js';
import { env } from '../../../config/env.js';
import { supabase } from '../../../lib/supabase.js';
import { conversationSessionService } from '../conversation-session.service.js';
import { soilFlowService } from './soil-flow.service.js';
import { responseComposerService } from '../pipeline/response-composer.service.js';
import { shopifyLinksService } from '../../shopify/shopify-links.service.js';
import { whatsappDiagnosisRendererService } from '../pipeline/whatsapp-diagnosis-renderer.service.js';
import { pickLocalizedFarmerSummary } from '../pipeline/crop-message-intent.service.js';
import type { SessionContext } from './session-context.types.js';

const NUTRIENT_PATTERN =
  /nutrient|deficien|nitrogen|potassium|phosphorus|npk|chlorosis|yellowing|മണ്ണ്|പോഷക|ஊட்டச்சத்து|पोषक|ನೈಟ್ರೋಜನ್/i;

export function suggestsNutrientDeficiency(advisory: StructuredAdvisory): boolean {
  if ((advisory.nutrientDeficiency?.length ?? 0) > 0) return true;
  const blob = [
    advisory.probableIssue,
    advisory.farmerSummaryEn,
    advisory.farmerSummaryMl,
    ...(advisory.stressAnalysis ?? []),
    ...(advisory.treatments?.map((t) => t.action) ?? []),
  ]
    .filter(Boolean)
    .join(' ');
  return NUTRIENT_PATTERN.test(blob);
}

export function soilGatePreface(language: AdvisoryLanguage): string {
  return language === 'ml'
    ? 'ഇലയിലെ ലക്ഷണങ്ങൾ പോഷക കുറവോ മറ്റ് സമ്മർദ്ദമോ സൂചിപ്പിക്കാം. വളം ശുപാർശ ചെയ്യുന്നതിന് മുമ്പ് മണ്ണ് പരിശോധന റിപ്പോർട്ട് നല്ലതാണ്.'
    : language === 'ta'
      ? 'இலை அறிகுறிகள் ஊட்டச்சத்து குறைபாடு அல்லது வேறு அழுத்தத்தைக் காட்டலாம். உரம் பரிந்துரைக்கும் முன் மண் பரிசோதனை அறிக்கை உதவும்.'
      : language === 'hi'
        ? 'पत्तियों के लक्षण पोषक की कमी या अन्य तनाव दिखा सकते हैं। उर्वरक सुझाने से पहले मिट्टी जांच रिपोर्ट बेहतर होगी।'
        : 'Leaf symptoms may point to nutrient shortage or other stress. A soil test report helps before we recommend fertilizer.';
}

function buildDeliverReply(
  advisory: StructuredAdvisory,
  language: AdvisoryLanguage,
  extraFooter?: string
): string {
  let body: string;
  if (env.ENABLE_WHATSAPP_RICH_DIAGNOSIS) {
    body = whatsappDiagnosisRendererService.render({ advisory, language });
  } else {
    body = pickLocalizedFarmerSummary(advisory, language);
  }
  if (extraFooter) body += `\n\n${extraFooter}`;

  const productBlock = shopifyLinksService.formatRecommendationsForWhatsApp([], language);
  if (productBlock) body += `\n\n${productBlock}`;

  const footer = env.ENABLE_WHATSAPP_RICH_DIAGNOSIS
    ? responseComposerService.brandFooter(language)
    : responseComposerService.advisoryDisclaimer(language);

  if (env.ENABLE_WHATSAPP_RICH_DIAGNOSIS) {
    return responseComposerService.composeDiagnosis({
      body,
      validationQuestion: null,
      footer,
    });
  }
  return responseComposerService.compose({
    body,
    validationQuestion: null,
    footer,
  });
}

export const nutrientSoilGateService = {
  suggestsNutrientDeficiency,

  async storePending(
    farmerId: string,
    payload: { sessionId: string; advisory: StructuredAdvisory }
  ): Promise<void> {
    await conversationSessionService.patchContext(farmerId, {
      pendingNutrientAdvisory: payload,
    });
  },

  async clearPending(farmerId: string): Promise<void> {
    await conversationSessionService.patchContext(farmerId, { pendingNutrientAdvisory: undefined });
  },

  async getPending(farmerId: string): Promise<SessionContext['pendingNutrientAdvisory'] | null> {
    const ctx = await conversationSessionService.getContext(farmerId);
    return ctx.pendingNutrientAdvisory ?? null;
  },

  async markSoilReportReceived(farmerId: string): Promise<void> {
    const { data: farmer } = await supabase
      .from('farmers')
      .select('metadata')
      .eq('id', farmerId)
      .maybeSingle();
    const meta = (farmer?.metadata as Record<string, unknown>) ?? {};
    await supabase
      .from('farmers')
      .update({
        metadata: {
          ...meta,
          soil_report_uploaded: true,
          soil_report_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', farmerId);
  },

  async shouldGateBeforeFertilizerAdvice(
    farmerId: string,
    advisory: StructuredAdvisory
  ): Promise<boolean> {
    if (!suggestsNutrientDeficiency(advisory)) return false;
    return !(await soilFlowService.hasSoilReport(farmerId));
  },

  async deliverPending(params: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    sendText: (phone: string, text: string) => Promise<void>;
    extraFooter?: string;
  }): Promise<{ delivered: boolean; summary: string; sessionId: string; advisory: StructuredAdvisory } | null> {
    const pending = await this.getPending(params.farmerId);
    if (!pending) return null;

    const advisory = pending.advisory;
    const reply = buildDeliverReply(advisory, params.language, params.extraFooter);

    await params.sendText(params.phone, reply);
    await this.clearPending(params.farmerId);
    return { delivered: true, summary: reply, sessionId: pending.sessionId, advisory };
  },
};
