import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { consumeProductReward, restoreProductReward } from '../../domain/remuneration/product-reward.js';
export const productRewardService = {
    async applyToOrder(input) {
        const purchase = Math.max(0, Number(input.grossInr) || 0);
        if (purchase <= 0)
            return { consumed: 0 };
        const { data: intro } = await supabase
            .from('farmer_introductions')
            .select('id, partner_id, farmer_id, product_reward_max, product_reward_used, product_reward_eligible')
            .eq('farmer_id', input.farmerId)
            .eq('qualification_status', 'eligible')
            .eq('product_reward_eligible', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
        if (!intro?.id)
            return { consumed: 0 };
        const { data: already } = await supabase
            .from('farmer_product_reward_ledger')
            .select('id')
            .eq('introduction_id', intro.id)
            .eq('commerce_order_id', input.orderId)
            .eq('kind', 'use')
            .maybeSingle();
        if (already?.id)
            return { consumed: 0 };
        const next = consumeProductReward({
            maxInr: Number(intro.product_reward_max ?? 0),
            usedInr: Number(intro.product_reward_used ?? 0),
            purchaseInr: purchase,
        });
        if (next.consumeInr <= 0)
            return { consumed: 0 };
        const { error } = await supabase.from('farmer_product_reward_ledger').insert({
            introduction_id: intro.id,
            farmer_id: input.farmerId,
            partner_id: intro.partner_id,
            commerce_order_id: input.orderId,
            kind: 'use',
            amount_inr: next.consumeInr,
            notes: 'Eligible product purchase',
        });
        if (error && error.code !== '23505') {
            logger.warn({ err: error, orderId: input.orderId }, 'Product reward use skipped');
            return { consumed: 0 };
        }
        await supabase
            .from('farmer_introductions')
            .update({
            product_reward_used: next.usedInr,
            product_reward_balance: next.balanceInr,
            reward_status: next.balanceInr > 0 ? 'partial' : 'eligible',
            updated_at: new Date().toISOString(),
        })
            .eq('id', intro.id);
        await supabase
            .from('commerce_orders')
            .update({ product_reward_applied_inr: next.consumeInr })
            .eq('id', input.orderId);
        return { consumed: next.consumeInr };
    },
    async restoreOrder(orderId) {
        const { data: uses } = await supabase
            .from('farmer_product_reward_ledger')
            .select('id, introduction_id, farmer_id, partner_id, amount_inr')
            .eq('commerce_order_id', orderId)
            .eq('kind', 'use');
        let restored = 0;
        for (const use of uses ?? []) {
            const { data: already } = await supabase
                .from('farmer_product_reward_ledger')
                .select('id')
                .eq('introduction_id', use.introduction_id)
                .eq('commerce_order_id', orderId)
                .eq('kind', 'restore')
                .maybeSingle();
            if (already?.id)
                continue;
            const { data: intro } = await supabase
                .from('farmer_introductions')
                .select('id, product_reward_max, product_reward_used')
                .eq('id', use.introduction_id)
                .maybeSingle();
            if (!intro?.id)
                continue;
            const next = restoreProductReward({
                maxInr: Number(intro.product_reward_max ?? 0),
                usedInr: Number(intro.product_reward_used ?? 0),
                restoreInr: Number(use.amount_inr ?? 0),
            });
            if (next.restoreInr <= 0)
                continue;
            await supabase.from('farmer_product_reward_ledger').insert({
                introduction_id: use.introduction_id,
                farmer_id: use.farmer_id,
                partner_id: use.partner_id,
                commerce_order_id: orderId,
                kind: 'restore',
                amount_inr: next.restoreInr,
                notes: 'Return restored product reward',
            });
            await supabase
                .from('farmer_introductions')
                .update({
                product_reward_used: next.usedInr,
                product_reward_balance: next.balanceInr,
                reward_status: next.usedInr > 0 ? 'partial' : 'eligible',
                updated_at: new Date().toISOString(),
            })
                .eq('id', intro.id);
            restored += next.restoreInr;
        }
        return { restored };
    },
};
//# sourceMappingURL=product-reward.service.js.map