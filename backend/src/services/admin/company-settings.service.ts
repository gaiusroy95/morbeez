import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { normalizeIndianState } from '../../lib/gst.js';

export type CompanySettings = {
  companyName: string;
  addressLine: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  cin: string;
  gstin: string;
  licenceNumber: string;
  customerCareNumber: string;
  whatsappNumber: string;
  formattedAddress: string;
  updatedAt: string | null;
};

const ROW_ID = 'default';

function mapRow(row: Record<string, unknown> | null): CompanySettings {
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
    formattedAddress,
    updatedAt: row?.updated_at ? String(row.updated_at) : null,
  };
}

export const companySettingsService = {
  async get(): Promise<CompanySettings> {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', ROW_ID)
      .maybeSingle();
    throwIfSupabaseError(error, 'Company settings');
    return mapRow(data as Record<string, unknown> | null);
  },

  async update(
    input: Partial<{
      companyName: string;
      addressLine: string;
      district: string;
      state: string;
      country: string;
      pincode: string;
      cin: string;
      gstin: string;
      licenceNumber: string;
      customerCareNumber: string;
      whatsappNumber: string;
    }>,
    adminId?: string
  ): Promise<CompanySettings> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: adminId ?? null,
    };
    if (input.companyName !== undefined) patch.company_name = input.companyName.trim();
    if (input.addressLine !== undefined) patch.address_line = input.addressLine.trim();
    if (input.district !== undefined) patch.district = input.district.trim();
    if (input.state !== undefined) patch.state = input.state.trim();
    if (input.country !== undefined) patch.country = input.country.trim() || 'India';
    if (input.pincode !== undefined) patch.pincode = input.pincode.trim();
    if (input.cin !== undefined) patch.cin = input.cin.trim();
    if (input.gstin !== undefined) patch.gstin = input.gstin.trim();
    if (input.licenceNumber !== undefined) patch.licence_number = input.licenceNumber.trim();
    if (input.customerCareNumber !== undefined) patch.customer_care_number = input.customerCareNumber.trim();
    if (input.whatsappNumber !== undefined) patch.whatsapp_number = input.whatsappNumber.trim();

    const { data, error } = await supabase
      .from('company_settings')
      .upsert({ id: ROW_ID, ...patch }, { onConflict: 'id' })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Update company settings');
    return mapRow(data as Record<string, unknown>);
  },

  /** Snapshot stored on invoices and exposed to storefront */
  async snapshot(): Promise<CompanySettings & { companySnapshot: Record<string, string> }> {
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
        formattedAddress: s.formattedAddress,
      },
    };
  },
};
