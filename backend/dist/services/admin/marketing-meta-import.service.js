import { leadService } from '../crm/lead.service.js';
import { farmerService } from '../farmer/farmer.service.js';
import { normalizePhone } from '../../lib/phone.js';
function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (ch === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    cells.push(current.trim());
    return cells;
}
function normalizeHeader(h) {
    return h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function pickField(row, keys) {
    for (const key of keys) {
        const val = row[key]?.trim();
        if (val)
            return val;
    }
    return null;
}
export const marketingMetaImportService = {
    async importCsv(csvText, defaults = {}) {
        const lines = csvText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        if (lines.length < 2) {
            return { imported: 0, skipped: 0, errors: ['CSV must include a header row and at least one data row'] };
        }
        const headers = parseCsvLine(lines[0]).map(normalizeHeader);
        const rows = [];
        for (let i = 1; i < lines.length; i += 1) {
            const cells = parseCsvLine(lines[i]);
            const row = {};
            headers.forEach((h, idx) => {
                row[h] = cells[idx] ?? '';
            });
            rows.push(row);
        }
        let imported = 0;
        let skipped = 0;
        const errors = [];
        for (const row of rows) {
            const phoneRaw = pickField(row, ['phone', 'phone_number', 'mobile', 'contact_number']) ??
                pickField(row, ['phone_number_1']);
            if (!phoneRaw) {
                skipped += 1;
                continue;
            }
            let phone;
            try {
                phone = normalizePhone(phoneRaw);
            }
            catch {
                skipped += 1;
                errors.push(`Invalid phone: ${phoneRaw}`);
                continue;
            }
            const name = pickField(row, ['full_name', 'name', 'first_name']) ??
                ([row.first_name, row.last_name].filter(Boolean).join(' ').trim() || undefined);
            const campaign = pickField(row, ['campaign_name', 'campaign', 'utm_campaign', 'ad_name']) ??
                defaults.campaignSource ??
                null;
            const utmSource = pickField(row, ['utm_source', 'platform']);
            const utmMedium = pickField(row, ['utm_medium']);
            const utmCampaign = pickField(row, ['utm_campaign']) ?? campaign;
            try {
                const farmer = await farmerService.upsertByPhone({
                    phone,
                    name: name ?? undefined,
                    source: 'web',
                });
                await leadService.ensureLeadForFarmer({
                    farmerId: farmer.id,
                    intent: 'general',
                    source: 'web',
                    status: 'new',
                    stage: 'new_lead',
                    lead_channel: defaults.leadChannel ?? 'meta',
                    campaign_source: campaign,
                    marketing_owner_id: defaults.marketingOwnerId ?? null,
                    marketing_owner_name: defaults.marketingOwnerName ?? null,
                    utm_campaign: utmCampaign,
                    utm_source: utmSource,
                    utm_medium: utmMedium,
                    notes: 'Imported from Meta lead export',
                    mergeNotes: true,
                });
                imported += 1;
            }
            catch (err) {
                skipped += 1;
                errors.push(err instanceof Error ? err.message : `Failed row for ${phone}`);
            }
        }
        return { imported, skipped, errors: errors.slice(0, 20) };
    },
};
//# sourceMappingURL=marketing-meta-import.service.js.map