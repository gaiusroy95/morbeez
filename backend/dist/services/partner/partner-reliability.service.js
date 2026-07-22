import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { partnerSettingsService } from './partner-settings.service.js';
const SIGNAL_WEIGHTS = {
    gps_compliant: 2,
    gps_missing: -5,
    visit_authentic: 3,
    photo_quality_ok: 2,
    photo_quality_low: -3,
    data_complete: 2,
    data_incomplete: -4,
    complaint: -10,
    late_checkout: -2,
    response_slow: -3,
    fraud_flag: -25,
};
export const partnerReliabilityService = {
    async recordSignal(input) {
        const { error } = await supabase.from('partner_reliability_signals').insert({
            partner_id: input.partnerId,
            farmer_id: input.farmerId ?? null,
            signal_type: input.signalType,
            signal_value: input.signalValue ?? SIGNAL_WEIGHTS[input.signalType] ?? 0,
            metadata: input.metadata ?? {},
        });
        throwIfSupabaseError(error, 'Could not record reliability signal');
    },
    async recomputeScore(partnerId) {
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data: signals, error } = await supabase
            .from('partner_reliability_signals')
            .select('signal_type, signal_value')
            .eq('partner_id', partnerId)
            .gte('created_at', since);
        throwIfSupabaseError(error, 'Could not load reliability signals');
        let delta = 0;
        const breakdown = {};
        for (const s of signals ?? []) {
            const v = Number(s.signal_value ?? SIGNAL_WEIGHTS[String(s.signal_type)] ?? 0);
            delta += v;
            breakdown[String(s.signal_type)] = (breakdown[String(s.signal_type)] ?? 0) + v;
        }
        const base = 70;
        const score = Math.max(0, Math.min(100, base + delta));
        await supabase.from('partner_reliability_scores').insert({
            partner_id: partnerId,
            score,
            breakdown,
        });
        await supabase
            .from('partners')
            .update({ reliability_score: score, updated_at: new Date().toISOString() })
            .eq('id', partnerId);
        const rules = await partnerSettingsService.get('customer_owner_rules');
        const threshold = Number(rules.reliabilitySuspendThreshold ?? 40);
        if (score < threshold) {
            await supabase
                .from('partners')
                .update({ commission_eligible: false })
                .eq('id', partnerId);
        }
        return { score, breakdown };
    },
    async captureVisitSignals(input) {
        await this.recordSignal({
            partnerId: input.partnerId,
            farmerId: input.farmerId,
            signalType: input.hasGps ? 'gps_compliant' : 'gps_missing',
        });
        await this.recordSignal({
            partnerId: input.partnerId,
            farmerId: input.farmerId,
            signalType: input.photoCount >= input.issueCount ? 'photo_quality_ok' : 'photo_quality_low',
            metadata: { photoCount: input.photoCount, issueCount: input.issueCount },
        });
        await this.recordSignal({
            partnerId: input.partnerId,
            farmerId: input.farmerId,
            signalType: input.issueCount > 0 ? 'data_complete' : 'data_incomplete',
        });
        if (input.durationMinutes != null && input.durationMinutes < 5) {
            await this.recordSignal({
                partnerId: input.partnerId,
                farmerId: input.farmerId,
                signalType: 'late_checkout',
                metadata: { durationMinutes: input.durationMinutes },
            });
        }
        return this.recomputeScore(input.partnerId);
    },
};
//# sourceMappingURL=partner-reliability.service.js.map