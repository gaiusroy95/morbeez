import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { normalizeIndianState } from '../../lib/gst.js';
const ROW_ID = 'default';
function mapRow(row) {
    const companyName = String(row?.company_name ?? env.COMPANY_LEGAL_NAME ?? 'Morbeez Agri Sciences').trim();
    const addressLine = String(row?.address_line ?? '').trim();
    const district = String(row?.district ?? '').trim();
    const state = normalizeIndianState(String(row?.state ?? env.COMPANY_STATE ?? 'Karnataka'));
    const country = String(row?.country ?? 'India').trim() || 'India';
    const pincode = String(row?.pincode ?? '').trim();
    const cin = String(row?.cin ?? '').trim();
    const gstin = String(row?.gstin ?? env.COMPANY_GSTIN ?? '').trim();
    const licenceNumber = String(row?.licence_number ?? '').trim();
    const customerCareNumber = String(row?.customer_care_number ?? '').trim();
    const whatsappNumber = String(row?.whatsapp_number ?? '').trim();
    const termsAndConditions = String(row?.terms_and_conditions ?? '').trim();
    const quotationLogoUrl = String(row?.quotation_logo_url ?? '').trim();
    const bankAccountName = String(row?.bank_account_name ?? '').trim();
    const bankAccountNumber = String(row?.bank_account_number ?? '').trim();
    const bankName = String(row?.bank_name ?? '').trim();
    const bankBranch = String(row?.bank_branch ?? '').trim();
    const bankIfsc = String(row?.bank_ifsc ?? '').trim();
    const locality = [district, state, country].filter(Boolean).join(', ');
    const formattedAddress = [addressLine, locality, pincode ? `PIN ${pincode}` : '']
        .filter(Boolean)
        .join('\n');
    return {
        companyName,
        addressLine,
        district,
        state,
        country,
        pincode,
        cin,
        gstin,
        licenceNumber,
        customerCareNumber,
        whatsappNumber,
        termsAndConditions,
        quotationLogoUrl,
        bankAccountName,
        bankAccountNumber,
        bankName,
        bankBranch,
        bankIfsc,
        formattedAddress,
        updatedAt: row?.updated_at ? String(row.updated_at) : null,
    };
}
export const companySettingsService = {
    async get() {
        const { data, error } = await supabase
            .from('company_settings')
            .select('*')
            .eq('id', ROW_ID)
            .maybeSingle();
        throwIfSupabaseError(error, 'Company settings');
        return mapRow(data);
    },
    async update(input, adminId) {
        const patch = {
            updated_at: new Date().toISOString(),
            updated_by: adminId ?? null,
        };
        if (input.companyName !== undefined)
            patch.company_name = input.companyName.trim();
        if (input.addressLine !== undefined)
            patch.address_line = input.addressLine.trim();
        if (input.district !== undefined)
            patch.district = input.district.trim();
        if (input.state !== undefined)
            patch.state = input.state.trim();
        if (input.country !== undefined)
            patch.country = input.country.trim() || 'India';
        if (input.pincode !== undefined)
            patch.pincode = input.pincode.trim();
        if (input.cin !== undefined)
            patch.cin = input.cin.trim();
        if (input.gstin !== undefined)
            patch.gstin = input.gstin.trim();
        if (input.licenceNumber !== undefined)
            patch.licence_number = input.licenceNumber.trim();
        if (input.customerCareNumber !== undefined)
            patch.customer_care_number = input.customerCareNumber.trim();
        if (input.whatsappNumber !== undefined)
            patch.whatsapp_number = input.whatsappNumber.trim();
        if (input.termsAndConditions !== undefined) {
            patch.terms_and_conditions = input.termsAndConditions.trim() || null;
        }
        if (input.quotationLogoUrl !== undefined) {
            patch.quotation_logo_url = input.quotationLogoUrl?.trim() || null;
        }
        if (input.bankAccountName !== undefined)
            patch.bank_account_name = input.bankAccountName.trim();
        if (input.bankAccountNumber !== undefined) {
            patch.bank_account_number = input.bankAccountNumber.trim();
        }
        if (input.bankName !== undefined)
            patch.bank_name = input.bankName.trim();
        if (input.bankBranch !== undefined)
            patch.bank_branch = input.bankBranch.trim();
        if (input.bankIfsc !== undefined)
            patch.bank_ifsc = input.bankIfsc.trim();
        const { data, error } = await supabase
            .from('company_settings')
            .upsert({ id: ROW_ID, ...patch }, { onConflict: 'id' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Update company settings');
        return mapRow(data);
    },
    /** Snapshot stored on invoices and exposed to storefront */
    async snapshot() {
        const s = await this.get();
        return {
            ...s,
            companySnapshot: {
                companyName: s.companyName,
                addressLine: s.addressLine,
                district: s.district,
                state: s.state,
                country: s.country,
                pincode: s.pincode,
                cin: s.cin,
                gstin: s.gstin,
                licenceNumber: s.licenceNumber,
                customerCareNumber: s.customerCareNumber,
                whatsappNumber: s.whatsappNumber,
                termsAndConditions: s.termsAndConditions,
                quotationLogoUrl: s.quotationLogoUrl,
                bankAccountName: s.bankAccountName,
                bankAccountNumber: s.bankAccountNumber,
                bankName: s.bankName,
                bankBranch: s.bankBranch,
                bankIfsc: s.bankIfsc,
                formattedAddress: s.formattedAddress,
            },
        };
    },
};
//# sourceMappingURL=company-settings.service.js.map