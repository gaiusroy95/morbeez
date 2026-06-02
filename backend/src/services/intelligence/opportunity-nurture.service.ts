import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { createTelecallerTask } from '../whatsapp/pipeline/telecaller-tasks.service.js';
import { opportunityIntelligenceConfigService } from './opportunity-intelligence-config.service.js';

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const NURTURE_TASK_TITLE = 'Re-engagement nurture (opportunity intelligence)';

/**
 * Step 14 — low-opportunity / quiet farmers: CRM tasks + optional WhatsApp education nudge.
 */
export const opportunityNurtureService = {
  async enqueueLowOpportunityNurture(opts?: {
    limit?: number;
    maxScore?: number;
    silentDays?: number;
  }): Promise<{ tasksCreated: number; whatsappSent: number; skipped: number }> {
    const config = await opportunityIntelligenceConfigService.get();
    if (!config.alertThresholds.autoNurtureLowScore) {
      return { tasksCreated: 0, whatsappSent: 0, skipped: 0 };
    }

    const limit = Math.min(opts?.limit ?? 30, 100);
    const maxScore = opts?.maxScore ?? config.alertThresholds.lowOpportunityMax ?? 35;
    const silentDays = opts?.silentDays ?? 14;
    const since = daysAgoIso(silentDays);

    const { data: lowScores, error } = await supabase
      .from('farmer_scores')
      .select('farmer_id, opportunity_score, farmers(id, phone, preferred_language, name)')
      .lte('opportunity_score', maxScore)
      .order('opportunity_score', { ascending: true })
      .limit(limit * 3);

    if (error) {
      logger.warn({ err: error }, 'Could not load low-opportunity farmers for nurture');
      return { tasksCreated: 0, whatsappSent: 0, skipped: 0 };
    }

    let tasksCreated = 0;
    let whatsappSent = 0;
    let skipped = 0;

    for (const row of lowScores ?? []) {
      if (tasksCreated >= limit) break;

      const farmerId = String(row.farmer_id);
      const score = Number(row.opportunity_score);

      const { count: recentInbound } = await supabase
        .from('farmer_events')
        .select('id', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .in('event_type', ['MESSAGE_REPLY', 'IMAGE_UPLOAD', 'VOICE_NOTE'])
        .gte('occurred_at', since);

      if ((recentInbound ?? 0) > 0) {
        skipped += 1;
        continue;
      }

      const { count: pendingNurture } = await supabase
        .from('crm_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .eq('status', 'pending')
        .ilike('title', '%nurture%');

      if ((pendingNurture ?? 0) > 0) {
        skipped += 1;
        continue;
      }

      const { data: lead } = await supabase
        .from('leads')
        .select('id, assigned_to')
        .eq('farmer_id', farmerId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      await createTelecallerTask({
        farmerId,
        leadId: lead?.id ? String(lead.id) : undefined,
        title: NURTURE_TASK_TITLE,
        notes: `Opportunity score ${score}/100 — farmer quiet ${silentDays}+ days. Share crop tips or schedule a check-in.`,
        priority: 'normal',
      });
      tasksCreated += 1;

      if (env.ENABLE_OPPORTUNITY_NURTURE_WHATSAPP !== false) {
        const farmer = row.farmers as {
          phone?: string;
          preferred_language?: string;
          name?: string;
        } | null;
        const phone = farmer?.phone ? String(farmer.phone) : '';
        if (phone) {
          try {
            const { whatsappService } = await import('../whatsapp/whatsapp.service.js');
            const lang = farmer?.preferred_language === 'ml' ? 'ml' : 'en';
            const name = farmer?.name ? String(farmer.name).split(' ')[0] : '';
            const text =
              lang === 'ml'
                ? `${name ? `${name}, ` : ''}നിങ്ങളുടെ കൃഷിയെക്കുറിച്ച് സഹായം വേണമെങ്ക് ഈ ചാറ്റിൽ മറുപടി നൽകുക. മോർബീസ് കമാൻഡ്: *menu*`
                : `${name ? `${name}, ` : ''}We're here to help with your crop. Reply to this chat for free tips, or send *menu* for options. — Morbeez`;
            await whatsappService.sendText(phone, text);
            whatsappSent += 1;
          } catch (err) {
            logger.warn({ err, farmerId }, 'Nurture WhatsApp failed');
          }
        }
      }
    }

    logger.info({ tasksCreated, whatsappSent, skipped }, 'Low-opportunity nurture batch completed');
    return { tasksCreated, whatsappSent, skipped };
  },
};
