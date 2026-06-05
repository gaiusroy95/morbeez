import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { inventoryService } from '../wms/inventory.service.js';
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
    async scanBarcode(packSessionId, scannedCode) {
        const { data: session, error: sessErr } = await supabase
            .from('pack_sessions')
            .select('*, pick_lists(*)')
            .eq('id', packSessionId)
            .single();
        throwIfSupabaseError(sessErr, 'Pack session');
        if (!session)
            throw new NotFoundError('Pack session not found');
        const item = await inventoryService.findByBarcode(scannedCode);
        if (!item) {
            await this.logScan(packSessionId, scannedCode, null, null, 'unknown', 'Unknown barcode');
            return { ok: false, error: 'Unknown barcode — product not found' };
        }
        const { data: lines } = await supabase
            .from('pick_list_lines')
            .select('*')
            .eq('pick_list_id', session.pick_list_id)
            .eq('inventory_item_id', item.id);
        if (!lines?.length) {
            await this.logScan(packSessionId, scannedCode, String(item.id), null, 'wrong_product', 'Scanned product is not on this pick list');
            return { ok: false, error: 'Wrong product — not on pick list' };
        }
        const line = lines[0];
        await this.logScan(packSessionId, scannedCode, String(item.id), line.batch_id ? String(line.batch_id) : null, 'ok', 'Scan verified');
        return { ok: true, line, productTitle: item.product_title, sku: item.sku };
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