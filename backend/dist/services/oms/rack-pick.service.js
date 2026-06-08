import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { inventoryService } from '../wms/inventory.service.js';
import { invoiceService } from './invoice.service.js';
import { packService } from './pack.service.js';
function normalizeRack(rack) {
    const r = String(rack ?? '').trim();
    return r || 'UNASSIGNED';
}
function sortRacks(racks) {
    return [...new Set(racks)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function pickedQty(line, counts) {
    if (line.manually_verified)
        return Number(line.qty_required);
    return Math.max(Number(line.qty_picked), counts[line.id] ?? 0);
}
function isLineComplete(line, counts) {
    return pickedQty(line, counts) >= Number(line.qty_required);
}
function rackLines(lines, rack) {
    return lines.filter((l) => normalizeRack(l.rack_location) === rack);
}
function isRackComplete(rack, lines, counts) {
    const subset = rackLines(lines, rack);
    return subset.length > 0 && subset.every((l) => isLineComplete(l, counts));
}
function allRacksComplete(lines, counts) {
    const racks = sortRacks(lines.map((l) => normalizeRack(l.rack_location)));
    return racks.length > 0 && racks.every((r) => isRackComplete(r, lines, counts));
}
function nextIncompleteRack(lines, counts, completed) {
    const racks = sortRacks(lines.map((l) => normalizeRack(l.rack_location)));
    for (const rack of racks) {
        if (completed.includes(rack))
            continue;
        if (!isRackComplete(rack, lines, counts))
            return rack;
    }
    return null;
}
function resolveCurrentRack(session, lines, counts) {
    if (Boolean(session.scan_complete))
        return null;
    const completed = (session.completed_racks ?? []);
    const stored = session.verified_rack ? String(session.verified_rack) : null;
    if (stored && !completed.includes(stored) && !isRackComplete(stored, lines, counts)) {
        return stored;
    }
    return nextIncompleteRack(lines, counts, completed);
}
function buildWorkflowPayload(ctx) {
    const step = ctx.stage === 'print' ? 3 : 1;
    return {
        stage: ctx.stage,
        step,
        currentRack: ctx.currentRack,
        racks: ctx.racks,
        currentRackLines: ctx.currentRackLines,
        printEnabled: ctx.printEnabled,
    };
}
async function loadSessionContext(packSessionId) {
    const { data: session, error } = await supabase
        .from('pack_sessions')
        .select('*, pick_lists(*, pick_list_lines(*))')
        .eq('id', packSessionId)
        .single();
    throwIfSupabaseError(error, 'Pack session');
    if (!session)
        throw new NotFoundError('Pack session not found');
    const lines = (session.pick_lists?.pick_list_lines ?? []);
    const counts = (session.line_scan_counts ?? {});
    const completed = (session.completed_racks ?? []);
    const currentRack = resolveCurrentRack(session, lines, counts);
    const stage = session.scan_complete ? 'print' : 'picking';
    const racks = sortRacks(lines.map((l) => normalizeRack(l.rack_location))).map((rack) => {
        const subset = rackLines(lines, rack);
        const totalQty = subset.reduce((s, l) => s + Number(l.qty_required), 0);
        const picked = subset.reduce((s, l) => s + pickedQty(l, counts), 0);
        const complete = isRackComplete(rack, lines, counts);
        return {
            rack,
            lineCount: subset.length,
            totalQty,
            pickedQty: picked,
            complete,
            active: rack === currentRack,
        };
    });
    const currentRackLines = currentRack
        ? rackLines(lines, currentRack).map((line, idx) => {
            const picked = pickedQty(line, counts);
            return {
                row: idx + 1,
                id: line.id,
                productTitle: line.product_title,
                sku: line.sku,
                batchCode: line.batch_code,
                qtyRequired: Number(line.qty_required),
                qtyPicked: picked,
                remaining: Math.max(0, Number(line.qty_required) - picked),
                complete: isLineComplete(line, counts),
            };
        })
        : [];
    return {
        session,
        lines,
        counts,
        completed,
        currentRack,
        stage: stage,
        racks,
        currentRackLines,
        printEnabled: Boolean(session.scan_complete),
    };
}
async function initSessionRack(packSessionId) {
    const ctx = await loadSessionContext(packSessionId);
    if (!ctx.lines.length || !ctx.currentRack)
        return ctx;
    if (ctx.session.verified_rack !== ctx.currentRack) {
        await supabase
            .from('pack_sessions')
            .update({ verified_rack: ctx.currentRack })
            .eq('id', packSessionId);
    }
    return loadSessionContext(packSessionId);
}
async function lookupBarcode(packSessionId, scannedCode) {
    const ctx = await loadSessionContext(packSessionId);
    if (ctx.stage === 'print') {
        return { ok: false, error: 'All racks picked — proceed to print' };
    }
    if (!ctx.currentRack) {
        return { ok: false, error: 'No active rack for this order' };
    }
    const productResult = await packService.scanBarcode(packSessionId, scannedCode.trim());
    if (!productResult.ok || !productResult.line) {
        return { ok: false, error: productResult.error ?? 'Barcode not recognized' };
    }
    const line = productResult.line;
    const lineRack = normalizeRack(line.rack_location);
    if (lineRack !== ctx.currentRack) {
        return {
            ok: false,
            error: `Product belongs to rack ${lineRack}, not current rack ${ctx.currentRack}`,
        };
    }
    const picked = pickedQty(line, ctx.counts);
    const required = Number(line.qty_required);
    const remaining = Math.max(0, required - picked);
    if (remaining <= 0) {
        return { ok: false, error: `${line.product_title} is already fully picked` };
    }
    return {
        ok: true,
        lineId: line.id,
        productTitle: line.product_title,
        sku: line.sku,
        batchCode: line.batch_code ?? productResult.batchCode ?? null,
        qtyRequired: required,
        qtyPicked: picked,
        remaining,
        defaultQty: Math.min(1, remaining),
    };
}
async function confirmPick(packSessionId, lineId, qty) {
    if (!Number.isInteger(qty) || qty <= 0) {
        throw new AppError('Quantity must be a positive integer', 400, 'VALIDATION');
    }
    const ctx = await loadSessionContext(packSessionId);
    if (ctx.stage === 'print') {
        throw new AppError('Picking already complete', 409, 'PICKING_DONE');
    }
    if (!ctx.currentRack) {
        throw new AppError('No active rack', 409, 'NO_RACK');
    }
    const line = ctx.lines.find((l) => l.id === lineId);
    if (!line)
        throw new NotFoundError('Pick line not found');
    if (normalizeRack(line.rack_location) !== ctx.currentRack) {
        throw new AppError('Line is not on the current rack', 409, 'WRONG_RACK');
    }
    const picked = pickedQty(line, ctx.counts);
    const required = Number(line.qty_required);
    const remaining = required - picked;
    if (remaining <= 0) {
        throw new AppError('Product already fully picked', 409, 'ALREADY_PICKED');
    }
    if (qty > remaining) {
        throw new AppError(`Cannot pick ${qty} — only ${remaining} remaining`, 400, 'QTY_EXCEEDS');
    }
    const counts = { ...ctx.counts };
    const next = picked + qty;
    counts[lineId] = next;
    const lineUpdates = { qty_picked: next };
    if (next >= required) {
        lineUpdates.manually_verified = true;
    }
    if (line.allocation_id) {
        await inventoryService.pickAllocation(String(line.allocation_id), qty);
    }
    await supabase.from('pick_list_lines').update(lineUpdates).eq('id', lineId);
    let completed = [...ctx.completed];
    let currentRack = ctx.currentRack;
    let scanComplete = false;
    let advancedRack = null;
    if (currentRack && isRackComplete(currentRack, ctx.lines, counts)) {
        if (!completed.includes(currentRack))
            completed.push(currentRack);
        const nextRack = nextIncompleteRack(ctx.lines, counts, completed);
        if (nextRack) {
            currentRack = nextRack;
            advancedRack = nextRack;
        }
        else if (allRacksComplete(ctx.lines, counts)) {
            scanComplete = true;
            const commerceOrderId = ctx.session.pick_lists?.commerce_order_id;
            if (commerceOrderId) {
                await invoiceService.generateTaxInvoice(String(commerceOrderId)).catch(() => undefined);
            }
        }
    }
    const verifiedRack = scanComplete ? null : currentRack;
    await supabase
        .from('pack_sessions')
        .update({
        line_scan_counts: counts,
        completed_racks: completed,
        verified_rack: verifiedRack,
        scan_complete: scanComplete,
    })
        .eq('id', packSessionId);
    const refreshed = await loadSessionContext(packSessionId);
    return {
        ok: true,
        lineComplete: next >= required,
        rackComplete: advancedRack != null || scanComplete,
        advancedToRack: advancedRack,
        stage: refreshed.stage,
        printEnabled: refreshed.printEnabled,
        workflow: buildWorkflowPayload(refreshed),
        message: scanComplete
            ? 'All racks complete — print label & invoice'
            : advancedRack
                ? `Rack complete — moved to ${advancedRack}`
                : `${line.product_title}: ${next}/${required} picked`,
    };
}
export const rackPickService = {
    normalizeRack,
    loadSessionContext,
    initSessionRack,
    buildWorkflowPayload,
    lookupBarcode,
    confirmPick,
};
//# sourceMappingURL=rack-pick.service.js.map