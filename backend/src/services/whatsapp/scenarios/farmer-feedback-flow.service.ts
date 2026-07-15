import type { AdvisoryLanguage } from '../../ai/types.js';
import { conversationSessionService } from '../conversation-session.service.js';
import {
  extractPriorProduct,
  extractAllSuggestedDiagnoses,
  isFarmerDisagreementIntent,
  looksLikePriorExperience,
} from '../../core/farmer-feedback-intent.service.js';
import { farmerExperienceLearningService } from '../../core/farmer-experience-learning.service.js';
import { farmerHypothesisRefineService } from '../../core/farmer-hypothesis-refine.service.js';
import { diagnosisSessionEvidenceService } from '../pipeline/diagnosis-session-evidence.service.js';
import { supabase } from '../../../lib/supabase.js';
import type { ScenarioSenders } from './whatsapp-scenario-router.service.js';
import {
  FARMER_SUGGEST_OTHER_BUTTON_ID,
  isFarmerSuggestionButtonId,
  mapFarmerSuggestionInput,
} from '../../../domain/learning/farmer-nutrient-suggestions.js';

export type FarmerFeedbackCaptureStep =
  | 'diagnosis'
  | 'experience_years'
  | 'experience'
  | 'product'
  | 'outcome';

function askFreeTextDiagnosis(lang: AdvisoryLanguage): string {
  const map: Record<AdvisoryLanguage, string> = {
    en: 'Understood 👍\n\nWhat do you think the issue is?\n\nType your answer here, or send a voice note.',
    ml: 'മനസ്സിലായി 👍\n\nനിങ്ങൾ കരുതുന്ന പ്രശ്നം എന്താണ്?\n\nഇവിടെ ടൈപ്പ് ചെയ്യുക, അല്ലെങ്കിൽ വോയ്സ് നോട്ട് അയയ്ക്കുക.',
    ta: 'புரிந்தது 👍\n\nபிரச்சனை என்ன என்று நீங்கள் நினைக்கிறீர்கள்?\n\nஇங்கே தட்டச்சு செய்யுங்கள், அல்லது குரல் செய்தி அனுப்புங்கள்.',
    kn: 'ಅರ್ಥವಾಯಿತು 👍\n\nಸಮಸ್ಯೆ ಏನೆಂದು ನೀವು ಭಾವಿಸುತ್ತೀರಿ?\n\nಇಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ, ಅಥವಾ ವಾಯ್ಸ್ ನೋಟ್ ಕಳುಹಿಸಿ.',
    hi: 'समझ गया 👍\n\nआपको क्या लगता है समस्या क्या है?\n\nयहाँ टाइप करें, या वॉइस नोट भेजें।',
  };
  return map[lang] ?? map.en;
}

function askFreeTextDiagnosisRetry(lang: AdvisoryLanguage): string {
  const map: Record<AdvisoryLanguage, string> = {
    en: 'Please describe what you think the issue is (type or voice note).',
    ml: 'നിങ്ങൾ കരുതുന്ന പ്രശ്നം വിവരിക്കുക (ടൈപ്പ് അല്ലെങ്കിൽ വോയ്സ് നോട്ട്).',
    ta: 'பிரச்சனை என்ன என்று விவரிக்கவும் (தட்டச்சு அல்லது குரல் செய்தி).',
    kn: 'ಸಮಸ್ಯೆಯನ್ನು ವಿವರಿಸಿ (ಟೈಪ್ ಅಥವಾ ವಾಯ್ಸ್ ನೋಟ್).',
    hi: 'समस्या क्या है बताएं (टाइप या वॉइस नोट)।',
  };
  return map[lang] ?? map.en;
}

function isFarmerFreeTextHypothesis(text: string): boolean {
  const t = text.trim();
  if (!t || isFarmerSuggestionButtonId(t)) return false;
  if (/^feedback\./i.test(t)) return false;
  return t.length >= 3;
}

function askExperienceYears(lang: AdvisoryLanguage): string {
  if (lang === 'ml') {
    return 'ഈ വിള കൃഷി ചെയ്ത് എത്ര വർഷമായി? (സംഖ്യ മാത്രം, ഉദാ: 15)';
  }
  if (lang === 'hi') {
    return 'इस फसल की खेती आप कितने साल से कर रहे हैं? (संख्या, उदा: 15)';
  }
  return 'How many years have you been growing this crop? (number only, e.g. 15)';
}

function askExperience(lang: AdvisoryLanguage): string {
  if (lang === 'ml') {
    return 'ഇതുപോലുള്ള ലക്ഷണങ്ങൾ മുമ്പ് കണ്ടിട്ടുണ്ടോ?\n\nമുമ്പ് ഏത് ചികിത്സ ഫലപ്രദമായിരുന്നു?';
  }
  if (lang === 'ta') {
    return 'இதுபோன்ற அறிகுறிகளை முன்பு பார்த்திருக்கிறீர்களா?\n\nஎந்த சிகிச்சை வேலை செய்தது?';
  }
  return 'Have you seen similar symptoms before?\n\nWhat treatment worked previously? (product name if you remember)';
}

function askProduct(lang: AdvisoryLanguage): string {
  if (lang === 'ml') return 'ഏത് ഉൽപ്പന്നം / സ്പ്രേ ഉപയോഗിച്ചിരുന്നു?';
  return 'Which product or spray did you use? (or type "none")';
}

function askOutcome(lang: AdvisoryLanguage): string {
  if (lang === 'ml') return 'ഫലം എങ്ങനെയായിരുന്നു? (മെച്ചം / ഭാഗികം / ഇല്ല)';
  return 'What was the outcome? (improved / partial / no change)';
}

function submittedReply(lang: AdvisoryLanguage): string {
  if (lang === 'ml') {
    return 'നന്ദി! നിങ്ങളുടെ അനുഭവം ഞങ്ങളുടെ വിദഗ്ധർ പരിശോധിക്കും. സ്ഥിരീകരിച്ചാൽ മാത്രമേ അറിവ് ശേഖരത്തിലേക്ക് ചേർക്കൂ.';
  }
  return 'Thank you! Our agronomist team will review your experience. Only agronomist-approved cases enter the knowledge base used for future advice.';
}

async function farmerHasExperienceYears(farmerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('farmers')
    .select('crop_experience_years')
    .eq('id', farmerId)
    .maybeSingle();
  return data?.crop_experience_years != null && Number(data.crop_experience_years) > 0;
}

function parseExperienceYears(text: string): number | null {
  const m = text.replace(/\D/g, '');
  const n = parseInt(m, 10);
  if (!Number.isFinite(n) || n < 0 || n > 60) return null;
  return n;
}

async function captureDiagnosisAndMaybeRefine(params: {
  feedbackId: string;
  farmerId: string;
  phone: string;
  lang: AdvisoryLanguage;
  text: string;
  send: ScenarioSenders;
  sessionId: string | null;
  priorAiIssue: string | null;
}): Promise<void> {
  const descriptive = isFarmerFreeTextHypothesis(params.text);

  if (descriptive) {
    try {
      const refined = await farmerHypothesisRefineService.refine({
        farmerText: params.text,
        sessionId: params.sessionId,
        farmerId: params.farmerId,
        lang: params.lang,
        priorAiIssue: params.priorAiIssue,
      });
      await farmerExperienceLearningService.captureFarmerDiagnosesFromText(
        params.feedbackId,
        params.text,
        {
          storeFullTextAsExperience: true,
          refinedAssessment: {
            conditions: refined.conditions,
            sequenceSummary: refined.sequenceSummary,
            source: refined.source,
          },
        }
      );
      await diagnosisSessionEvidenceService.appendTranscript(
        params.farmerId,
        'farmer',
        `Correction hypothesis: ${params.text.slice(0, 400)}`
      );
      await diagnosisSessionEvidenceService.appendTranscript(
        params.farmerId,
        'assistant',
        refined.replyToFarmer.slice(0, 500)
      );
      await params.send.text(params.phone, refined.replyToFarmer);
      return;
    } catch {
      // LLM refine unavailable — keep farmer free text for agronomist; no invented scores.
      await farmerExperienceLearningService.captureFarmerDiagnosesFromText(
        params.feedbackId,
        params.text,
        { storeFullTextAsExperience: true, storeAsRawHypothesis: true }
      );
      await params.send.text(
        params.phone,
        params.lang === 'ml'
          ? 'നന്ദി — നിങ്ങളുടെ വിവരണം രേഖപ്പെടുത്തി. അഗ്രോണമിസ്റ്റ് പരിശോധിക്കും. കുറച്ച് ചോദ്യങ്ങൾ കൂടി…'
          : 'Thanks — your description is saved for agronomist review. A few quick follow-up questions…'
      );
      return;
    }
  }

  await farmerExperienceLearningService.captureFarmerDiagnosesFromText(
    params.feedbackId,
    params.text,
    { storeFullTextAsExperience: true }
  );
}

async function nextStepAfterDiagnosis(
  farmerId: string,
  feedbackId: string
): Promise<FarmerFeedbackCaptureStep> {
  if (!(await farmerHasExperienceYears(farmerId))) {
    await farmerExperienceLearningService.updateCapture(feedbackId, {
      capture_step: 'experience_years',
    });
    return 'experience_years';
  }
  await farmerExperienceLearningService.updateCapture(feedbackId, { capture_step: 'experience' });
  return 'experience';
}

export const farmerFeedbackFlowService = {
  isDisagreementIntent: isFarmerDisagreementIntent,

  async canStartDisagreement(farmerId: string): Promise<{
    sessionId: string | null;
    aiIssue: string | null;
    aiConfidence: number | null;
  } | null> {
    const ctx = await conversationSessionService.getContext(farmerId);
    const sessionId = ctx.diagnosis?.lastSessionId ?? ctx.lastAdvisorySessionId ?? null;
    if (!sessionId) return null;

    const { data: output } = await supabase
      .from('ai_advisory_outputs')
      .select('probable_issue')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: sess } = await supabase
      .from('ai_advisory_sessions')
      .select('confidence_score')
      .eq('id', sessionId)
      .maybeSingle();

    return {
      sessionId,
      aiIssue: output?.probable_issue ? String(output.probable_issue) : null,
      aiConfidence: sess?.confidence_score != null ? Number(sess.confidence_score) : null,
    };
  },

  async startFlow(params: {
    farmerId: string;
    phone: string;
    lang: AdvisoryLanguage;
    send: ScenarioSenders;
    initialText?: string;
  }): Promise<void> {
    const meta = await this.canStartDisagreement(params.farmerId);
    const mapped = params.initialText ? mapFarmerSuggestionInput(params.initialText) : undefined;
    const initialDiagnoses = params.initialText ? extractAllSuggestedDiagnoses(params.initialText) : [];
    const initialDx = initialDiagnoses[0] ?? (typeof mapped === 'string' ? mapped : null);
    const priorProduct = params.initialText ? extractPriorProduct(params.initialText) : null;

    const fb = await farmerExperienceLearningService.createFromDisagreement({
      farmerId: params.farmerId,
      sessionId: meta?.sessionId ?? null,
      blockId: null,
      aiProbableIssue: meta?.aiIssue ?? null,
      aiConfidence: meta?.aiConfidence ?? null,
      initialFarmerDiagnosis: initialDx,
      initialText: params.initialText,
    });

    if (params.initialText?.trim()) {
      const t = params.initialText.trim();
      const skipCapture =
        mapped === null ||
        t === FARMER_SUGGEST_OTHER_BUTTON_ID ||
        t === 'feedback.disagree' ||
        (isFarmerDisagreementIntent(t) &&
          !isFarmerFreeTextHypothesis(t) &&
          initialDiagnoses.length === 0);
      if (!skipCapture) {
        await captureDiagnosisAndMaybeRefine({
          feedbackId: fb.id,
          farmerId: params.farmerId,
          phone: params.phone,
          lang: params.lang,
          text: t,
          send: params.send,
          sessionId: meta?.sessionId ?? null,
          priorAiIssue: meta?.aiIssue ?? null,
        });
      }
    }

    let step: FarmerFeedbackCaptureStep = initialDx ? await nextStepAfterDiagnosis(params.farmerId, fb.id) : 'diagnosis';
    if (priorProduct) {
      await farmerExperienceLearningService.updateCapture(fb.id, {
        farmer_prior_product: priorProduct,
        capture_step: 'outcome',
      });
      step = 'outcome';
    }

    await conversationSessionService.patchContext(params.farmerId, {
      farmerFeedbackId: fb.id,
      farmerFeedbackStep: step,
    });
    await conversationSessionService.setState(params.farmerId, 'farmer_feedback_capture');

    if (step === 'diagnosis') {
      await params.send.text(params.phone, askFreeTextDiagnosis(params.lang));
    } else if (step === 'experience_years') {
      await params.send.text(params.phone, askExperienceYears(params.lang));
    } else if (step === 'experience') {
      await params.send.text(params.phone, askExperience(params.lang));
    } else {
      await params.send.text(params.phone, askOutcome(params.lang));
    }
  },

  async tryHandleCapture(params: {
    farmerId: string;
    phone: string;
    lang: AdvisoryLanguage;
    text: string;
    send: ScenarioSenders;
  }): Promise<boolean> {
    const ctx = await conversationSessionService.getContext(params.farmerId);
    const feedbackId = ctx.farmerFeedbackId;
    const step = ctx.farmerFeedbackStep;
    if (!feedbackId || !step) return false;

    const text = params.text.trim();
    if (!text || text.startsWith('menu.')) return false;

    if (step === 'diagnosis') {
      if (!isFarmerFreeTextHypothesis(text)) {
        await params.send.text(params.phone, askFreeTextDiagnosisRetry(params.lang));
        return true;
      }

      const meta = await farmerFeedbackFlowService.canStartDisagreement(params.farmerId);
      await captureDiagnosisAndMaybeRefine({
        feedbackId,
        farmerId: params.farmerId,
        phone: params.phone,
        lang: params.lang,
        text,
        send: params.send,
        sessionId: meta?.sessionId ?? null,
        priorAiIssue: meta?.aiIssue ?? null,
      });

      const next = await nextStepAfterDiagnosis(params.farmerId, feedbackId);
      await conversationSessionService.patchContext(params.farmerId, {
        farmerFeedbackStep: next,
      });
      if (next === 'experience_years') {
        await params.send.text(params.phone, askExperienceYears(params.lang));
      } else {
        await params.send.text(params.phone, askExperience(params.lang));
      }
      return true;
    }

    if (step === 'experience_years') {
      const years = parseExperienceYears(text);
      if (years == null) {
        await params.send.text(params.phone, askExperienceYears(params.lang));
        return true;
      }
      await farmerExperienceLearningService.saveCropExperienceYears(
        params.farmerId,
        years,
        feedbackId
      );
      await farmerExperienceLearningService.updateCapture(feedbackId, {
        crop_experience_years: years,
        capture_step: 'experience',
      });
      await conversationSessionService.patchContext(params.farmerId, {
        farmerFeedbackStep: 'experience',
      });
      await params.send.text(params.phone, askExperience(params.lang));
      return true;
    }

    if (step === 'experience') {
      const product = extractPriorProduct(text);
      const productOrPractice = product || (looksLikePriorExperience(text) ? text.slice(0, 400) : null);
      await farmerExperienceLearningService.updateCapture(feedbackId, {
        farmer_prior_experience: text.slice(0, 1000),
        farmer_prior_product: productOrPractice ?? undefined,
        capture_step: productOrPractice ? 'outcome' : 'product',
      });
      if (productOrPractice) {
        await conversationSessionService.patchContext(params.farmerId, {
          farmerFeedbackStep: 'outcome',
        });
        await params.send.text(params.phone, askOutcome(params.lang));
      } else {
        await conversationSessionService.patchContext(params.farmerId, {
          farmerFeedbackStep: 'product',
        });
        await params.send.text(params.phone, askProduct(params.lang));
      }
      return true;
    }

    if (step === 'product') {
      const product = /^none$/i.test(text) ? null : text.slice(0, 200);
      await farmerExperienceLearningService.updateCapture(feedbackId, {
        farmer_prior_product: product,
        capture_step: 'outcome',
      });
      await conversationSessionService.patchContext(params.farmerId, {
        farmerFeedbackStep: 'outcome',
      });
      await params.send.text(params.phone, askOutcome(params.lang));
      return true;
    }

    if (step === 'outcome') {
      let outcome = text.slice(0, 200);
      if (/improved|better|മെച്ചം|சரி/i.test(text)) outcome = 'improved';
      else if (/partial|ഭാഗിക/i.test(text)) outcome = 'partial';
      else if (/no|not|ഇല്ല/i.test(text)) outcome = 'no_change';

      await farmerExperienceLearningService.updateCapture(feedbackId, {
        farmer_prior_outcome: outcome,
      });
      await farmerExperienceLearningService.submitForReview(feedbackId);

      await conversationSessionService.patchContext(params.farmerId, {
        farmerFeedbackId: undefined,
        farmerFeedbackStep: undefined,
      });
      await conversationSessionService.setState(params.farmerId, 'main_menu');

      await params.send.text(params.phone, submittedReply(params.lang));
      return true;
    }

    return false;
  },
};
