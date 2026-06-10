import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { billingWeightKg, buildCourierPayload, volumetricWeightKg } from '../../lib/courier-payload.js';
import { shippingBoxService } from './shipping-box.service.js';
import { packagingCategoryService } from './packaging-category.service.js';
import { packageRuleService } from './package-rule.service.js';
import { packagingSettingsService } from './packaging-settings.service.js';
import { orderPackageService } from './order-package.service.js';
async function resolveBoxFromRules(totalContentWeightKg, dominantCategoryId, preferredBoxId) {
    if (preferredBoxId) {
        try {
            const preferred = await shippingBoxService.getById(preferredBoxId);
            if (preferred.active && preferred.maxWeightKg >= totalContentWeightKg) {
                return { box: preferred, ruleId: null, source: 'product_preferred_box' };
            }
        }
        catch {
            /* fall through to rules */
        }
    }
    const primary = await packageRuleService.matchRule(dominantCategoryId, totalContentWeightKg);
    if (primary) {
        return { box: primary.box, ruleId: primary.rule.id, source: 'package_rule' };
    }
    const general = await packagingCategoryService.getGeneralCategory();
    const fallback = await packageRuleService.matchRule(general.id, totalContentWeightKg);
    if (fallback) {
        return { box: fallback.box, ruleId: fallback.rule.id, source: 'general_rule' };
    }
    const boxes = await shippingBoxService.listActive();
    if (!boxes.length)
        throw new AppError('No active shipping boxes configured', 409, 'NO_BOXES');
    const largest = [...boxes].sort((a, b) => b.maxWeightKg - a.maxWeightKg)[0];
    return { box: largest, ruleId: null, source: 'largest_box_fallback' };
}
export const packageRuleEngineService = {
    async estimateForOrder(commerceOrderId) {
        const { data: order, error: orderErr } = await supabase
            .from('commerce_orders')
            .select('id')
            .eq('id', commerceOrderId)
            .maybeSingle();
        if (orderErr)
            throw new AppError(orderErr.message, 500, 'DB_ERROR');
        if (!order)
            throw new NotFoundError('Order not found');
        const settings = await packagingSettingsService.getSettings();
        const { data: lines, error: lineErr } = await supabase
            .from('commerce_order_lines')
            .select(`id, product_title, variant_title, sku, qty_ordered, qty_cancelled, inventory_item_id,
         inventory_items(
           item_weight_kg, packaging_category_id, preferred_box_id,
           is_fragile, is_liquid, stackable,
           packaging_categories(id, name, priority)
         )`)
            .eq('commerce_order_id', commerceOrderId);
        throwIfSupabaseError(lineErr, 'Load order lines');
        const activeLines = (lines ?? []).filter((l) => Number(l.qty_ordered) - Number(l.qty_cancelled ?? 0) > 0);
        if (!activeLines.length) {
            throw new AppError('Order has no shippable lines', 409, 'NO_LINES');
        }
        const generalCategory = await packagingCategoryService.getGeneralCategory();
        const analyses = [];
        let contentWeight = 0;
        let dominantCategoryId = generalCategory.id;
        let dominantCategoryName = generalCategory.name;
        let dominantLineWeight = -1;
        let preferredBoxId = null;
        for (const line of activeLines) {
            const qty = Number(line.qty_ordered) - Number(line.qty_cancelled ?? 0);
            const invRaw = line.inventory_items;
            const inv = Array.isArray(invRaw) ? (invRaw[0] ?? null) : invRaw;
            const catRaw = inv?.packaging_categories;
            const cat = Array.isArray(catRaw) ? (catRaw[0] ?? null) : catRaw;
            let unitWeight = inv?.item_weight_kg != null && Number(inv.item_weight_kg) > 0
                ? Number(inv.item_weight_kg)
                : settings.defaultUnitWeightKg;
            const weightSource = inv?.item_weight_kg != null && Number(inv.item_weight_kg) > 0
                ? 'catalog'
                : 'settings_default';
            const lineWeight = unitWeight * qty;
            contentWeight += lineWeight;
            const categoryId = cat?.id ? String(cat.id) : inv?.packaging_category_id ? String(inv.packaging_category_id) : generalCategory.id;
            const categoryName = cat?.name ? String(cat.name) : generalCategory.name;
            if (lineWeight > dominantLineWeight) {
                dominantLineWeight = lineWeight;
                dominantCategoryId = categoryId;
                dominantCategoryName = categoryName;
            }
            const linePreferredBoxId = inv?.preferred_box_id ? String(inv.preferred_box_id) : null;
            if (linePreferredBoxId && !preferredBoxId)
                preferredBoxId = linePreferredBoxId;
            analyses.push({
                lineId: String(line.id),
                productTitle: String(line.product_title),
                sku: line.sku ? String(line.sku) : null,
                qty,
                unitWeightKg: unitWeight,
                lineWeightKg: lineWeight,
                packagingCategoryId: categoryId,
                packagingCategoryName: categoryName,
                preferredBoxId: linePreferredBoxId,
                isFragile: Boolean(inv?.is_fragile),
                isLiquid: Boolean(inv?.is_liquid),
                stackable: inv?.stackable !== false,
                weightSource,
            });
        }
        const { box, ruleId, source } = await resolveBoxFromRules(contentWeight, dominantCategoryId, preferredBoxId);
        const packageWeight = contentWeight + box.tareWeightKg;
        const volKg = volumetricWeightKg(box.lengthCm, box.breadthCm, box.heightCm, settings.volumetricDivisorCm);
        const billKg = billingWeightKg(packageWeight, box.lengthCm, box.breadthCm, box.heightCm, settings);
        const courierPayload = buildCourierPayload({
            length: box.lengthCm,
            breadth: box.breadthCm,
            height: box.heightCm,
            weight: packageWeight,
            billingWeight: billKg,
        }, settings);
        return {
            commerceOrderId,
            suggestedBox: box,
            packagingCategoryId: dominantCategoryId,
            packagingCategoryName: dominantCategoryName,
            matchedRuleId: ruleId,
            lengthCm: box.lengthCm,
            breadthCm: box.breadthCm,
            heightCm: box.heightCm,
            estimatedWeightKg: Math.round(contentWeight * 1000) / 1000,
            packageWeightKg: Math.round(packageWeight * 1000) / 1000,
            billingWeightKg: billKg,
            volumetricWeightKg: volKg,
            courierPayload: {
                length: courierPayload.length,
                breadth: courierPayload.breadth,
                height: courierPayload.height,
                weight: courierPayload.billingWeight,
            },
            lines: analyses,
            meta: {
                boxSelectionSource: source,
                matchedRuleId: ruleId,
                packagingCategoryId: dominantCategoryId,
                volumetricWeightKg: volKg,
                settings,
            },
        };
    },
    async persistEstimate(commerceOrderId, estimate) {
        const { data: current, error: curErr } = await supabase
            .from('commerce_orders')
            .select('oms_status')
            .eq('id', commerceOrderId)
            .single();
        throwIfSupabaseError(curErr, 'Load order status');
        const omsStatus = String(current?.oms_status ?? 'pending');
        const patch = {
            package_status: 'estimated',
            suggested_box_id: estimate.suggestedBox.id,
            package_length_cm: estimate.lengthCm,
            package_breadth_cm: estimate.breadthCm,
            package_height_cm: estimate.heightCm,
            estimated_weight_kg: estimate.estimatedWeightKg,
            package_weight_kg: estimate.packageWeightKg,
            billing_weight_kg: estimate.billingWeightKg,
            package_overridden: false,
            package_estimate_meta: {
                lines: estimate.lines,
                courierPayload: estimate.courierPayload,
                packagingCategoryId: estimate.packagingCategoryId,
                packagingCategoryName: estimate.packagingCategoryName,
                matchedRuleId: estimate.matchedRuleId,
                ...estimate.meta,
            },
            updated_at: new Date().toISOString(),
        };
        if (['pending', 'assigned', 'confirmed', 'packaging_estimated'].includes(omsStatus)) {
            patch.oms_status = 'packaging_estimated';
        }
        const { error } = await supabase.from('commerce_orders').update(patch).eq('id', commerceOrderId);
        throwIfSupabaseError(error, 'Persist package estimate');
        await orderPackageService.upsertFromEstimate(commerceOrderId, estimate, {
            status: 'estimated',
            matchedRuleId: estimate.matchedRuleId,
            packagingCategoryId: estimate.packagingCategoryId,
        });
    },
    async ensureEstimated(commerceOrderId) {
        const { data: order, error } = await supabase
            .from('commerce_orders')
            .select('id, package_status, suggested_box_id, package_length_cm, package_breadth_cm, package_height_cm, estimated_weight_kg, package_weight_kg, billing_weight_kg, package_estimate_meta, package_overridden, confirmed_box_id')
            .eq('id', commerceOrderId)
            .single();
        throwIfSupabaseError(error, 'Load order package');
        if (order?.package_status === 'confirmed' ||
            order?.package_status === 'label_generated') {
            return this.buildEstimateFromOrder(order);
        }
        if (order?.package_status === 'estimated' && order.suggested_box_id) {
            return this.buildEstimateFromOrder(order);
        }
        const estimate = await this.estimateForOrder(commerceOrderId);
        await this.persistEstimate(commerceOrderId, estimate);
        return estimate;
    },
    async buildEstimateFromOrder(order) {
        const boxId = String(order.confirmed_box_id ?? order.suggested_box_id ?? '');
        const box = boxId ? await shippingBoxService.getById(boxId) : (await shippingBoxService.listActive())[0];
        const meta = (order.package_estimate_meta ?? {});
        const settings = await packagingSettingsService.getSettings();
        const lengthCm = Number(order.package_length_cm ?? box.lengthCm);
        const breadthCm = Number(order.package_breadth_cm ?? box.breadthCm);
        const heightCm = Number(order.package_height_cm ?? box.heightCm);
        const packageWeightKg = Number(order.package_weight_kg ?? 0.2);
        const billing = Number(order.billing_weight_kg ?? packageWeightKg);
        const volKg = volumetricWeightKg(lengthCm, breadthCm, heightCm, settings.volumetricDivisorCm);
        const courierPayload = buildCourierPayload({
            length: lengthCm,
            breadth: breadthCm,
            height: heightCm,
            weight: packageWeightKg,
            billingWeight: billing,
        }, settings);
        return {
            commerceOrderId: String(order.id),
            suggestedBox: box,
            packagingCategoryId: meta.packagingCategoryId ? String(meta.packagingCategoryId) : null,
            packagingCategoryName: meta.packagingCategoryName ? String(meta.packagingCategoryName) : null,
            matchedRuleId: meta.matchedRuleId ? String(meta.matchedRuleId) : null,
            lengthCm,
            breadthCm,
            heightCm,
            estimatedWeightKg: Number(order.estimated_weight_kg ?? packageWeightKg),
            packageWeightKg,
            billingWeightKg: billing,
            volumetricWeightKg: volKg,
            courierPayload: {
                length: courierPayload.length,
                breadth: courierPayload.breadth,
                height: courierPayload.height,
                weight: courierPayload.billingWeight,
            },
            lines: meta.lines ?? [],
            meta,
        };
    },
    async confirmPackage(commerceOrderId, actorEmail) {
        const estimate = await this.ensureEstimated(commerceOrderId);
        const now = new Date().toISOString();
        const { error } = await supabase
            .from('commerce_orders')
            .update({
            package_status: 'confirmed',
            confirmed_box_id: estimate.suggestedBox.id,
            package_length_cm: estimate.lengthCm,
            package_breadth_cm: estimate.breadthCm,
            package_height_cm: estimate.heightCm,
            package_weight_kg: estimate.packageWeightKg,
            billing_weight_kg: estimate.billingWeightKg,
            package_confirmed_at: now,
            package_confirmed_by: actorEmail ?? null,
            package_overridden: false,
            oms_status: 'ready_for_courier',
            updated_at: now,
        })
            .eq('id', commerceOrderId);
        throwIfSupabaseError(error, 'Confirm package');
        await orderPackageService.upsertFromEstimate(commerceOrderId, estimate, {
            status: 'confirmed',
            matchedRuleId: estimate.matchedRuleId,
            packagingCategoryId: estimate.packagingCategoryId,
            confirmedBy: actorEmail ?? null,
            confirmedAt: now,
            selectedBoxId: estimate.suggestedBox.id,
        });
        return estimate;
    },
    async overridePackage(commerceOrderId, input) {
        const settings = await packagingSettingsService.getSettings();
        let box = null;
        if (input.boxId) {
            box = await shippingBoxService.getById(input.boxId);
        }
        const volKg = volumetricWeightKg(input.lengthCm, input.breadthCm, input.heightCm, settings.volumetricDivisorCm);
        const billKg = billingWeightKg(input.weightKg, input.lengthCm, input.breadthCm, input.heightCm, settings);
        const courierPayload = buildCourierPayload({
            length: input.lengthCm,
            breadth: input.breadthCm,
            height: input.heightCm,
            weight: input.weightKg,
            billingWeight: billKg,
        }, settings);
        const now = new Date().toISOString();
        const { error } = await supabase
            .from('commerce_orders')
            .update({
            package_status: 'confirmed',
            suggested_box_id: box?.id ?? null,
            confirmed_box_id: box?.id ?? null,
            package_length_cm: input.lengthCm,
            package_breadth_cm: input.breadthCm,
            package_height_cm: input.heightCm,
            package_weight_kg: input.weightKg,
            billing_weight_kg: billKg,
            package_overridden: true,
            package_confirmed_at: now,
            package_confirmed_by: input.actorEmail ?? null,
            package_estimate_meta: {
                overridden: true,
                courierPayload,
                volumetricWeightKg: volKg,
            },
            oms_status: 'ready_for_courier',
            updated_at: now,
        })
            .eq('id', commerceOrderId);
        throwIfSupabaseError(error, 'Override package');
        const fallbackBox = box ??
            {
                id: '',
                code: 'CUSTOM',
                name: 'Custom dimensions',
                lengthCm: input.lengthCm,
                breadthCm: input.breadthCm,
                heightCm: input.heightCm,
                maxWeightKg: input.weightKg,
                tareWeightKg: 0,
                liquidFriendly: true,
                packagingType: 'custom',
                sortOrder: 999,
                active: true,
            };
        const estimate = {
            commerceOrderId,
            suggestedBox: fallbackBox,
            packagingCategoryId: null,
            packagingCategoryName: null,
            matchedRuleId: null,
            lengthCm: input.lengthCm,
            breadthCm: input.breadthCm,
            heightCm: input.heightCm,
            estimatedWeightKg: input.weightKg,
            packageWeightKg: input.weightKg,
            billingWeightKg: billKg,
            volumetricWeightKg: volKg,
            courierPayload: {
                length: courierPayload.length,
                breadth: courierPayload.breadth,
                height: courierPayload.height,
                weight: courierPayload.billingWeight,
            },
            lines: [],
            meta: { overridden: true, volumetricWeightKg: volKg },
        };
        await orderPackageService.upsertFromEstimate(commerceOrderId, estimate, {
            status: 'confirmed',
            overrideUsed: true,
            confirmedBy: input.actorEmail ?? null,
            confirmedAt: now,
            selectedBoxId: box?.id ?? null,
        });
        return estimate;
    },
    async resolveCourierDimensions(commerceOrderId) {
        const { data: order, error } = await supabase
            .from('commerce_orders')
            .select('package_status, package_length_cm, package_breadth_cm, package_height_cm, package_weight_kg, billing_weight_kg')
            .eq('id', commerceOrderId)
            .single();
        throwIfSupabaseError(error, 'Load order dimensions');
        if (order?.package_length_cm &&
            order.package_breadth_cm &&
            order.package_height_cm &&
            (order.package_weight_kg || order.billing_weight_kg)) {
            const weight = Number(order.billing_weight_kg ?? order.package_weight_kg ?? 0.2);
            return {
                length: Number(order.package_length_cm),
                breadth: Number(order.package_breadth_cm),
                height: Number(order.package_height_cm),
                weight,
                billingWeight: weight,
                packageStatus: String(order.package_status ?? 'confirmed'),
            };
        }
        const estimate = await this.ensureEstimated(commerceOrderId);
        return {
            length: estimate.courierPayload.length,
            breadth: estimate.courierPayload.breadth,
            height: estimate.courierPayload.height,
            weight: estimate.courierPayload.weight,
            billingWeight: estimate.billingWeightKg,
            packageStatus: 'estimated',
        };
    },
};
//# sourceMappingURL=package-rule-engine.service.js.map