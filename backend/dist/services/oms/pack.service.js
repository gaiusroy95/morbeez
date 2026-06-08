import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { inventoryService } from '../wms/inventory.service.js';
import { invoiceService } from './invoice.service.js';
export const packService = {
    async startSession(pickListId, mode = 'manual') {
        const { data: existing } = await supabase
            .from('pack_sessions')
            .select('*')
            .eq('pick_list_id', pickListId)
            .eq('status', 'open')
            .maybeSingle();
        if (existing)
            return existing;
        const { data, error } = await supabase
            .from('pack_sessions')
            .insert({
            pick_list_id: pickListId,
            verification_mode: mode,
            status: 'open',
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Pack session');
        return data;
    },
    async scanFulfillment(packSessionId, scannedCode) {
        const { data: session, error: sessErr } = await supabase
            .from('pack_sessions')
            .select('*, pick_lists(*, pick_list_lines(*))')
            .eq('id', packSessionId)
            .single();
        throwIfSupabaseError(sessErr, 'Pack session');
        if (!session)
            throw new NotFoundError('Pack session not found');
        const trimmed = scannedCode.trim();
        const lines = (session.pick_lists?.pick_list_lines ?? []);
        if (!session.verified_rack) {
            const racks = lines
                .map((l) => String(l.rack_location ?? '').trim())
                .filter(Boolean);
            const match = racks.find((r) => r.toLowerCase() === trimmed.toLowerCase() || r === trimmed);
            if (!match) {
                await this.logScan(packSessionId, trimmed, null, null, 'rack_mismatch', 'Scan rack first');
                return { ok: false, phase: 'rack', error: 'Scan rack location first (e.g. A-02)' };
            }
            await supabase
                .from('pack_sessions')
                .update({ verified_rack: match })
                .eq('id', packSessionId);
            await this.logScan(packSessionId, trimmed, null, null, 'rack_ok', `Rack ${match} verified`);
            return { ok: true, phase: 'rack', rack: match, message: `Rack ${match} OK — scan products` };
        }
        const productResult = await this.scanBarcode(packSessionId, trimmed);
        if (!productResult.ok || !productResult.line) {
            return { ...productResult, phase: 'product' };
        }
        const lineId = String(productResult.line.id);
        const counts = (session.line_scan_counts ?? {});
        const next = (counts[lineId] ?? 0) + 1;
        const required = Number(productResult.line.qty_required);
        counts[lineId] = next;
        const lineUpdates = {};
        if (next >= required) {
            lineUpdates.manually_verified = true;
            lineUpdates.qty_picked = required;
            const allocId = productResult.line.allocation_id;
            if (allocId) {
                await inventoryService.pickAllocation(String(allocId), required);
            }
        }
        if (Object.keys(lineUpdates).length) {
            await supabase.from('pick_list_lines').update(lineUpdates).eq('id', lineId);
        }
        const allDone = lines.every((l) => {
            const id = String(l.id);
            const req = Number(l.qty_required);
            if (id === lineId)
                return next >= req;
            return Boolean(l.manually_verified) || (counts[id] ?? 0) >= req;
        });
        await supabase
            .from('pack_sessions')
            .update({
            line_scan_counts: counts,
            scan_complete: allDone,
        })
            .eq('id', packSessionId);
        if (allDone) {
            const commerceOrderId = session.pick_lists?.commerce_order_id;
            if (commerceOrderId) {
                await invoiceService.generateTaxInvoice(String(commerceOrderId)).catch(() => undefined);
            }
        }
        return {
            ok: true,
            phase: 'product',
            productTitle: productResult.productTitle,
            scannedQty: next,
            requiredQty: required,
            scanComplete: allDone,
            printEnabled: allDone,
            message: allDone
                ? 'All items verified — print label & invoice'
                : `${productResult.productTitle}: ${next}/${required}`,
        };
    },
    async scanBarcode(packSessionId, scannedCode) {
        const { data: session, error: sessErr } = await supabase
            .from('pack_sessions')
            .select('*, pick_lists(*)')
            .eq('id', packSessionId)
            .single();
        throwIfSupabaseError(sessErr, 'Pack session');
        if (!session)
            throw new NotFoundError('Pack session not found');
        const trimmed = scannedCode.trim();
        const batch = await inventoryService.findBatchByCode(trimmed);
        let item = batch
            ? await supabase
                .from('inventory_items')
                .select('*')
                .eq('id', batch.inventory_item_id)
                .single()
                .then((r) => r.data)
            : null;
        if (!item) {
            item = await inventoryService.findByBarcode(trimmed);
        }
        if (!item) {
            await this.logScan(packSessionId, trimmed, null, null, 'unknown', 'Unknown barcode');
            return { ok: false, error: 'Unknown barcode — product not found' };
        }
        const { data: lines } = await supabase
            .from('pick_list_lines')
            .select('*')
            .eq('pick_list_id', session.pick_list_id)
            .eq('inventory_item_id', item.id);
        if (!lines?.length) {
            await this.logScan(packSessionId, trimmed, String(item.id), null, 'wrong_product', 'Scanned product is not on this pick list');
            return { ok: false, error: 'Wrong product — not on pick list' };
        }
        const line = lines[0];
        if (batch && line.batch_id && String(batch.id) !== String(line.batch_id)) {
            await this.logScan(packSessionId, trimmed, String(item.id), String(batch.id), 'wrong_batch', `Expected batch ${line.batch_code ?? line.batch_id}`);
            return {
                ok: false,
                error: `Wrong batch — expected ${line.batch_code ?? 'allocated batch'}`,
            };
        }
        if (!batch && line.batch_code) {
            const expectedBatch = await inventoryService.findBatchByCode(String(line.batch_code), String(item.id));
            if (expectedBatch && line.batch_id && String(expectedBatch.id) !== String(line.batch_id)) {
                await this.logScan(packSessionId, trimmed, String(item.id), null, 'wrong_batch', 'Batch verification required — scan batch barcode');
                return { ok: false, error: 'Scan batch barcode to verify allocation' };
            }
        }
        await this.logScan(packSessionId, trimmed, String(item.id), line.batch_id ? String(line.batch_id) : batch?.id ? String(batch.id) : null, 'ok', batch ? 'Batch verified' : 'Product scan verified');
        return {
            ok: true,
            line,
            productTitle: item.product_title,
            sku: item.sku,
            batchCode: line.batch_code ?? batch?.batch_code ?? null,
        };
    },
    async logScan(packSessionId, code, itemId, batchId, result, message) {
        await supabase.from('pack_scan_logs').insert({
            pack_session_id: packSessionId,
            scanned_code: code,
            inventory_item_id: itemId,
            batch_id: batchId,
            result,
            message,
        });
    },
    async completePack(pickListId, verifiedBy) {
        const { data: pickList, error } = await supabase
            .from('pick_lists')
            .select('*, pick_list_lines(*)')
            .eq('id', pickListId)
            .single();
        throwIfSupabaseError(error, 'Pick list pack');
        if (!pickList)
            throw new NotFoundError('Pick list not found');
        const lines = (pickList.pick_list_lines ?? []);
        if (!lines.length)
            throw new AppError('Pick list has no lines', 400, 'VALIDATION');
        const { data: openSession } = await supabase
            .from('pack_sessions')
            .select('verification_mode, scan_complete')
            .eq('pick_list_id', pickListId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (openSession?.verification_mode === 'barcode' && !openSession.scan_complete) {
            throw new AppError('Complete barcode scan verification before packing', 400, 'SCAN_INCOMPLETE');
        }
        for (const line of lines) {
            if (!line.manually_verified && Number(line.qty_picked) < Number(line.qty_required)) {
                throw new AppError(`Line ${line.product_title} not fully picked/verified`, 400, 'PACK_INCOMPLETE');
            }
            if (line.allocation_id) {
                await inventoryService.finalizePack(String(line.allocation_id));
            }
        }
        const { data: session } = await supabase
            .from('pack_sessions')
            .select('id')
            .eq('pick_list_id', pickListId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (session) {
            await supabase
                .from('pack_sessions')
                .update({
                status: 'verified',
                verified_by: verifiedBy ?? null,
                verified_at: new Date().toISOString(),
            })
                .eq('id', session.id);
        }
        await supabase
            .from('pick_lists')
            .update({
            status: 'packed',
            packed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', pickListId);
        return pickList;
    },
};
//# sourceMappingURL=pack.service.js.map