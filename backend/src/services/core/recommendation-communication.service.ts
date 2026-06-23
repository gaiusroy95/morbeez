import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, AppError } from '../../lib/errors.js';
import { whatsappService } from '../whatsapp/whatsapp.service.js';
import { env } from '../../config/env.js';
import type { RecommendationStatus } from './recommendation-records.service.js';
import { recommendationFollowUpService } from './recommendation-follow-up.service.js';

type RecRow = {
  id: string;
  farmer_id: string;
  issue_detected: string | null;
  recommendation_text: string;
  dosage: string | null;
  application_type: string | null;
  weather_warning: string | null;
  language: string;
  status: string;
  communicated_at?: string | null;
  metadata?: Record<string, unknown>;
  farmers?: { phone: string | null; name: string | null; preferred_language: string | null };
};

export type RecommendationMessageExtras = {
  blockName?: string;
  products?: Array<{
    technicalName?: string;
    dose?: string;
    method?: string;
    applicationDay?: number;
    applicationType?: string;
  }>;
  reviewDate?: string;
  monitoringInterval?: string;
};

function pickSummary(text: string): string {
  return text.trim();
}

export function buildApprovedRecommendationMessage(
  row: RecRow,
  extras?: RecommendationMessageExtras
): string {
  const lang = String(row.language || row.farmers?.preferred_language || 'en').toLowerCase();
  const copy: Record<string, { title: string; issue: string; advice: string; dosage: string; app: string; footer: string }> = {
    en: {
      title: '🌾 *Morbeez — Approved recommendation*',
      issue: '*Issue:*',
      advice: '*Advice:*',
      dosage: '*Dosage:*',
      app: '*Application:*',
      footer: '_Approved by Morbeez agronomy team. Reply if you need help applying this._',
    },
    ml: {
      title: '🌾 *മോർബീസ് — അംഗീകരിച്ച ശുപാർശ*',
      issue: '*പ്രശ്നം:*',
      advice: '*ശുപാർശ:*',
      dosage: '*ഡോസേജ്:*',
      app: '*പ്രയോഗം:*',
      footer: '_മോർബീസ് അഗ്രോണമി ടീം അംഗീകരിച്ചത്. സഹായം വേണമെങ്കിൽ മറുപടി നൽകുക._',
    },
    ta: {
      title: '🌾 *மோர்பீஸ் — அங்கீகரிக்கப்பட்ட பரிந்துரை*',
      issue: '*பிரச்சனை:*',
      advice: '*பரிந்துரை:*',
      dosage: '*அளவு:*',
      app: '*பயன்பாடு:*',
      footer: '_மோர்பீஸ் குழுவால் அங்கீகரிக்கப்பட்டது. உதவி வேண்டுமெனில் பதிலளிக்கவும்._',
    },
    kn: {
      title: '🌾 *ಮೋರ್ಬೀಸ್ — ಅನುಮೋದಿತ ಶಿಫಾರಸು*',
      issue: '*ಸಮಸ್ಯೆ:*',
      advice: '*ಶಿಫಾರಸು:*',
      dosage: '*ಡೋಸೇಜ್:*',
      app: '*ಅನ್ವಯಿಕೆ:*',
      footer: '_ಮೋರ್ಬೀಸ್ ತಂಡದಿಂದ ಅನುಮೋದಿಸಲಾಗಿದೆ. ಸಹಾಯ ಬೇಕಾದರೆ ಪ್ರತಿಕ್ರಿಯಿಸಿ._',
    },
    hi: {
      title: '🌾 *मॉर्बीज़ — स्वीकृत सलाह*',
      issue: '*समस्या:*',
      advice: '*सलाह:*',
      dosage: '*डोसेज:*',
      app: '*उपयोग:*',
      footer: '_मॉर्बीज़ एग्रोनॉमी टीम द्वारा स्वीकृत। मदद चाहिए तो जवाब दें।_',
    },
  };
  const t = copy[lang] ?? copy.en;
  const productLines =
    extras?.products?.map((p) => {
      const day = p.applicationDay != null ? `Day ${p.applicationDay}` : '';
      const parts = [p.technicalName, p.dose, p.method, day].filter(Boolean);
      return `• ${parts.join(' · ')}`;
    }) ?? [];

  const lines = [
    t.title,
    '',
    extras?.blockName ? (lang === 'ml' ? `*ബ്ലോക്ക്:* ${extras.blockName}` : `*Block:* ${extras.blockName}`) : null,
    row.issue_detected ? `${t.issue} ${row.issue_detected}` : null,
    `${t.advice} ${pickSummary(row.recommendation_text)}`,
    row.dosage ? `${t.dosage} ${row.dosage}` : null,
    row.application_type ? `${t.app} ${row.application_type}` : null,
    productLines.length ? (lang === 'ml' ? '*ഉൽപ്പന്നങ്ങൾ:*' : '*Products & schedule:*') : null,
    ...productLines,
    extras?.reviewDate ? (lang === 'ml' ? `*പുനര്പരിശോധന:* ${extras.reviewDate}` : `*Review:* ${extras.reviewDate}`) : null,
    extras?.monitoringInterval
      ? lang === 'ml'
        ? `*നിരീക്ഷണം:* ഓരോ ${extras.monitoringInterval} ദിവസവും`
        : `*Monitoring:* every ${extras.monitoringInterval} days`
      : null,
    row.weather_warning ? `⚠️ ${row.weather_warning}` : null,
    '',
    t.footer,
  ].filter(Boolean) as string[];

  let text = lines.join('\n');
  if (env.REC_SEND_COMPLIANCE_IN_INITIAL) {
    const compliance =
      lang === 'ml'
        ? `\n\n_ചികിത്സ പൂർത്തിയാക്കിയോ? Yes അല്ലെങ്കിൽ No എന്ന് മറുപടി നൽകുക._`
        : `\n\n_Have you applied this treatment? Reply Yes or No._`;
    text += compliance;
  }
  return text;
}

export const recommendationCommunicationService = {
  async sendApprovedRecommendation(
    recommendationId: string,
    options?: {
      force?: boolean;
      customMessage?: string;
      complianceQuestion?: string;
      complianceNoAction?: 'escalate' | 'review';
    }
  ): Promise<{ sent: boolean; message?: string; reason?: string }> {
    const { data, error } = await supabase
      .from('recommendation_records')
      .select(
        'id, farmer_id, issue_detected, recommendation_text, dosage, application_type, weather_warning, language, status, communicated_at, metadata, farmers(phone, name, preferred_language)'
      )
      .eq('id', recommendationId)
      .single();

    throwIfSupabaseError(error, 'Could not load recommendation');
    if (!data) throw new NotFoundError('Recommendation not found');

    const raw = data as Record<string, unknown>;
    const farmersRel = raw.farmers;
    const farmerObj = Array.isArray(farmersRel) ? farmersRel[0] : farmersRel;
    const row = {
      ...raw,
      farmers: farmerObj as RecRow['farmers'],
    } as RecRow;
    const allowed: RecommendationStatus[] = ['approved', 'communicated'];
    if (!allowed.includes(row.status as RecommendationStatus)) {
      throw new AppError('Recommendation must be approved before sending', 400, 'INVALID_STATUS');
    }

    if (row.communicated_at && !options?.force) {
      return { sent: false, reason: 'already_communicated' };
    }

    const phone = row.farmers?.phone;
    if (!phone?.trim()) {
      return { sent: false, reason: 'no_phone' };
    }

    if (!env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PROVIDER === 'cloud') {
      return { sent: false, reason: 'whatsapp_not_configured' };
    }

    const text =
      options?.customMessage?.trim() ||
      buildApprovedRecommendationMessage(row, {
        blockName:
          typeof row.metadata?.blockName === 'string' ? String(row.metadata.blockName) : undefined,
        products: Array.isArray(row.metadata?.products)
          ? (row.metadata!.products as RecommendationMessageExtras['products'])
          : undefined,
        reviewDate:
          typeof row.metadata?.reviewDate === 'string'
            ? new Date(String(row.metadata.reviewDate)).toLocaleDateString()
            : undefined,
      });
    await whatsappService.sendText(phone, text.slice(0, 4000));

    const complianceQuestion = options?.complianceQuestion?.trim();
    const complianceNoAction = options?.complianceNoAction ?? 'escalate';
    if (complianceQuestion) {
      try {
        await whatsappService.sendButtons({
          to: phone,
          body: complianceQuestion.slice(0, 1024),
          buttons: [
            { id: 'rec.compliance_yes', title: 'Yes' },
            { id: 'rec.compliance_no', title: 'No' },
          ],
        });
      } catch {
        await whatsappService.sendText(
          phone,
          `${complianceQuestion}\n\nReply *Yes* or *No*.`.slice(0, 4000)
        );
      }
    }

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('recommendation_records')
      .update({
        status: 'communicated',
        communicated_at: now,
        updated_at: now,
        metadata: {
          ...(row.metadata ?? {}),
          whatsapp_sent_at: now,
          ...(complianceQuestion
            ? {
                complianceFollowUp: {
                  question: complianceQuestion,
                  noAction: complianceNoAction,
                  sentAt: now,
                },
              }
            : {}),
        },
      })
      .eq('id', recommendationId);

    throwIfSupabaseError(updErr, 'Could not mark recommendation communicated');

    await recommendationFollowUpService.onRecommendationCommunicated(recommendationId);
    if (complianceQuestion) {
      await recommendationFollowUpService.onCompliancePromptSent(
        recommendationId,
        complianceQuestion,
        complianceNoAction
      );
    }

    const { farmerEventCaptureService } = await import(
      '../intelligence/farmer-event-capture.service.js'
    );
    void farmerEventCaptureService.trackRecommendationMilestone({
      recommendationRecordId: recommendationId,
      farmerId: String(row.farmer_id ?? data.farmer_id),
      milestone: 'communicated',
    });

    return { sent: true, message: text };
  },

  async sendVisitSummary(params: {
    farmerId: string;
    blockName: string;
    issueSummary: string;
    approvedRecCount: number;
    reviewDateLabel?: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    const { data: farmer } = await supabase
      .from('farmers')
      .select('phone, preferred_language')
      .eq('id', params.farmerId)
      .maybeSingle();
    const phone = farmer?.phone?.trim();
    if (!phone) return { sent: false, reason: 'no_phone' };
    if (!env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PROVIDER === 'cloud') {
      return { sent: false, reason: 'whatsapp_not_configured' };
    }

    const lang = String(farmer?.preferred_language ?? 'en').toLowerCase();
    const title = lang === 'ml' ? '🌾 *ഫീൽഡ് വിസിറ്റ് സംഗ്രഹം*' : '🌾 *Field visit summary*';
    const lines = [
      title,
      '',
      lang === 'ml' ? `*ബ്ലോക്ക്:* ${params.blockName}` : `*Block:* ${params.blockName}`,
      lang === 'ml' ? `*പ്രശ്നങ്ങൾ:* ${params.issueSummary}` : `*Issues:* ${params.issueSummary}`,
      params.approvedRecCount > 0
        ? lang === 'ml'
          ? `*അംഗീകരിച്ച ശുപാർശകൾ:* ${params.approvedRecCount}`
          : `*Approved recommendations:* ${params.approvedRecCount}`
        : null,
      params.reviewDateLabel
        ? lang === 'ml'
          ? `*പുനര്പരിശോധന:* ${params.reviewDateLabel}`
          : `*Review date:* ${params.reviewDateLabel}`
        : null,
      '',
      lang === 'ml'
        ? '_മോർബീസ് അഗ്രോണമിസ്റ്റ് നടത്തിയ സന്ദർശനം._'
        : '_Visit recorded by Morbeez agronomist._',
    ].filter(Boolean);

    await whatsappService.sendText(phone, lines.join('\n').slice(0, 4000));
    return { sent: true };
  },

  async sendEvidenceRequest(params: {
    farmerId: string;
    blockId: string;
    diagnosis: string;
    photoTypes: string[];
    questions: Array<{ key: string; text: string; answer?: string }>;
  }): Promise<{ sent: boolean; reason?: string; messageId?: string }> {
    const { data: farmer } = await supabase
      .from('farmers')
      .select('phone, preferred_language')
      .eq('id', params.farmerId)
      .maybeSingle();
    const phone = farmer?.phone?.trim();
    if (!phone) return { sent: false, reason: 'no_phone' };
    if (!env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PROVIDER === 'cloud') {
      return { sent: false, reason: 'whatsapp_not_configured' };
    }

    const lang = String(farmer?.preferred_language ?? 'en').toLowerCase();
    const photoLabels: Record<string, Record<string, string>> = {
      en: {
        whole_plant: 'Whole plant photo',
        lower_leaf: 'Lower leaf photo',
        root_rhizome: 'Root/rhizome photo',
        field_view: 'Field view photo',
      },
      ml: {
        whole_plant: 'മുഴുവൻ ചെടിയുടെ ഫോട്ടോ',
        lower_leaf: 'താഴത്തെ ഇലയുടെ ഫോട്ടോ',
        root_rhizome: 'വേര്/റൈസോം ഫോട്ടോ',
        field_view: 'കൃഷിയിടത്തിന്റെ ഫോട്ടോ',
      },
    };
    const labels = photoLabels[lang] ?? photoLabels.en!;
    const photoLines = params.photoTypes.map((t) => `• ${labels[t] ?? t}`);
    const questionLines = params.questions.map((q) => {
      const ans = q.answer?.trim() ? ` (${q.answer})` : '';
      return `• ${q.text}${ans}`;
    });

    const copy =
      lang === 'ml'
        ? {
            title: '📸 *കൂടുതൽ വിവരങ്ങൾ ആവശ്യമാണ്*',
            intro: `ഞങ്ങളുടെ അഗ്രോണമിസ്റ്റ് നിങ്ങളുടെ കൃഷിയിടത്തിലെ *${params.diagnosis}* പരിശോധിക്കുന്നു.`,
            photos: '*ഈ ഫോട്ടോകൾ അയയ്ക്കുക:*',
            confirm: '*ദയവായി സ്ഥിരീകരിക്കുക:*',
            footer: '_ഫോട്ടോകളും ഉത്തരങ്ങളും വാട്ട്സാപ്പിൽ അയയ്ക്കുക. നന്ദി!_',
          }
        : {
            title: '📸 *More information needed*',
            intro: `Our agronomist is reviewing *${params.diagnosis}* on your field.`,
            photos: '*Please send these photos:*',
            confirm: '*Please confirm:*',
            footer: '_Reply with photos and answers on WhatsApp. Thank you!_',
          };

    const text = [
      copy.title,
      '',
      copy.intro,
      '',
      copy.photos,
      ...photoLines,
      '',
      copy.confirm,
      ...questionLines,
      '',
      copy.footer,
    ].join('\n');

    const result = await whatsappService.sendText(phone, text.slice(0, 4000));
    return { sent: true, messageId: typeof result === 'object' && result && 'id' in result ? String((result as { id?: string }).id) : undefined };
  },

  async previewVisitMessages(input: {
    farmerId: string;
    blockName?: string;
    recommendationGroups?: Array<{
      applicationType: string;
      applicationDay?: number;
      materials: Array<{
        technicalName: string;
        dose?: string;
        method?: string;
        issueIndex?: number;
      }>;
    }>;
    reviewDate?: string;
    monitoringInterval?: string;
    issues: Array<{
      issueName: string;
      finalDiagnosis?: string;
      finalRecommendation?: string;
      initialRecommendation?: { text: string; dose?: string; method?: string };
    }>;
  }) {
    const { data: farmer } = await supabase
      .from('farmers')
      .select('preferred_language')
      .eq('id', input.farmerId)
      .maybeSingle();
    const lang = String(farmer?.preferred_language ?? 'en').toLowerCase();

    const allProducts =
      input.recommendationGroups?.flatMap((g) =>
        g.materials.map((m) => ({
          technicalName: m.technicalName,
          dose: m.dose,
          method: m.method ?? g.applicationType,
          applicationDay: g.applicationDay,
          applicationType: g.applicationType,
          issueIndex: m.issueIndex,
        }))
      ) ?? [];

    return input.issues.map((issue, issueIndex) => {
      const diagnosis = issue.finalDiagnosis ?? issue.issueName;
      const recText = issue.finalRecommendation ?? issue.initialRecommendation?.text ?? 'Recommendation pending';
      const issueProducts = allProducts.filter(
        (p) => p.issueIndex === undefined || p.issueIndex === issueIndex
      );
      const productsForIssue =
        issueProducts.length > 0
          ? issueProducts
          : allProducts.length
            ? allProducts
            : issue.initialRecommendation?.dose
              ? [
                  {
                    technicalName: diagnosis,
                    dose: issue.initialRecommendation.dose,
                    method: issue.initialRecommendation.method,
                  },
                ]
              : [];

      const dosageFromProducts = productsForIssue
        .map((p) => [p.technicalName, p.dose].filter(Boolean).join(': '))
        .filter(Boolean)
        .join('; ');

      const message = buildApprovedRecommendationMessage(
        {
          id: 'preview',
          farmer_id: input.farmerId,
          issue_detected: diagnosis,
          recommendation_text: recText,
          dosage: dosageFromProducts || (issue.initialRecommendation?.dose ?? null),
          application_type: issue.initialRecommendation?.method ?? null,
          weather_warning: null,
          language: lang,
          status: 'approved',
          farmers: { phone: null, name: null, preferred_language: lang },
        },
        {
          blockName: input.blockName,
          products: productsForIssue,
          reviewDate: input.reviewDate,
          monitoringInterval: input.monitoringInterval,
        }
      );
      const complianceQuestion =
        lang === 'ml'
          ? `${diagnosis} ചികിത്സ പൂർത്തിയാക്കിയോ?`
          : `Have you completed ${diagnosis} treatment?`;
      return {
        issueIndex,
        issueLabel: diagnosis,
        message,
        compliancePrompt: `${complianceQuestion} Reply Yes or No.`,
        complianceQuestion,
        complianceNoAction: 'escalate' as const,
      };
    });
  },
};
