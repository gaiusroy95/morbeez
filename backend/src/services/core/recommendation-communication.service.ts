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

function pickSummary(text: string): string {
  return text.trim();
}

export function buildApprovedRecommendationMessage(row: RecRow): string {
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
  const lines = [
    t.title,
    '',
    row.issue_detected ? `${t.issue} ${row.issue_detected}` : null,
    `${t.advice} ${pickSummary(row.recommendation_text)}`,
    row.dosage ? `${t.dosage} ${row.dosage}` : null,
    row.application_type ? `${t.app} ${row.application_type}` : null,
    row.weather_warning ? `⚠️ ${row.weather_warning}` : null,
    '',
    t.footer,
  ].filter(Boolean);

  return lines.join('\n');
}

export const recommendationCommunicationService = {
  async sendApprovedRecommendation(
    recommendationId: string,
    options?: { force?: boolean }
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

    const text = buildApprovedRecommendationMessage(row);
    await whatsappService.sendText(phone, text.slice(0, 4000));

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('recommendation_records')
      .update({
        status: 'communicated',
        communicated_at: now,
        updated_at: now,
        metadata: { ...(row.metadata ?? {}), whatsapp_sent_at: now },
      })
      .eq('id', recommendationId);

    throwIfSupabaseError(updErr, 'Could not mark recommendation communicated');

    await recommendationFollowUpService.onRecommendationCommunicated(recommendationId);

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
};
