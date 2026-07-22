import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { cropPackLoaderService } from '../crop-pack/crop-pack-loader.service.js';
import { messageFatigueService } from '../whatsapp/pipeline/message-fatigue.service.js';
function addHours(hours) {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    return d.toISOString();
}
export const proactiveAlertService = {
    enabled() {
        return env.ENABLE_MAIOS_V12 !== false;
    },
    async scheduleDailyScan() {
        if (!this.enabled())
            return { scheduled: 0 };
        const since = new Date();
        since.setDate(since.getDate() - 7);
        const { data: sessions } = await supabase
            .from('ai_advisory_sessions')
            .select('id, farmer_id, metadata')
            .gte('created_at', since.toISOString())
            .not('metadata->maiosCase', 'is', null)
            .limit(100);
        let scheduled = 0;
        for (const s of sessions ?? []) {
            const meta = s.metadata ?? {};
            const maiosCase = meta.maiosCase;
            if (!maiosCase)
                continue;
            const diseaseRisk = maiosCase.predictiveRisk?.disease ?? 0;
            const weatherRisk = maiosCase.predictiveRisk?.weather ?? 0;
            const highRisk = diseaseRisk >= 65 ||
                weatherRisk >= 70 ||
                (maiosCase.riskTags ?? []).some((t) => ['FUNGAL_PRESSURE', 'HEAT_STRESS', 'WATERLOG_RISK'].includes(t));
            if (!highRisk)
                continue;
            const reduce = await messageFatigueService.shouldReduceProactiveMessages(s.farmer_id);
            if (reduce)
                continue;
            const { count } = await supabase
                .from('advisory_automation_jobs')
                .select('id', { count: 'exact', head: true })
                .eq('farmer_id', s.farmer_id)
                .eq('job_type', 'maios_proactive_alert')
                .gte('created_at', since.toISOString());
            if ((count ?? 0) > 0)
                continue;
            const cropType = maiosCase.identity?.cropType ?? '_default';
            const pack = await cropPackLoaderService.load(cropType);
            const message = `MAIOS alert (${pack.displayName}): elevated crop risk detected. Send a fresh field photo or reply HELP for guidance.`;
            const { data: farmer } = await supabase
                .from('farmers')
                .select('preferred_language')
                .eq('id', s.farmer_id)
                .maybeSingle();
            await supabase.from('advisory_automation_jobs').insert({
                farmer_id: s.farmer_id,
                session_id: s.id,
                job_type: 'maios_proactive_alert',
                scheduled_at: addHours(2),
                payload: {
                    message,
                    sessionId: s.id,
                    cropType,
                    language: (farmer?.preferred_language ?? 'en'),
                    riskScore: Math.max(diseaseRisk, weatherRisk),
                },
            });
            scheduled++;
        }
        if (scheduled > 0) {
            logger.info({ scheduled }, 'MAIOS proactive alert scan complete');
        }
        else {
            logger.debug({ scheduled }, 'MAIOS proactive alert scan complete');
        }
        return { scheduled };
    },
};
//# sourceMappingURL=proactive-alert.service.js.map