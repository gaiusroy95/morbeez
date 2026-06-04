import { supabase } from '../../../lib/supabase.js';
import { throwIfSupabaseError } from '../../../lib/supabase-errors.js';
import { pincodeService, type PincodeRow } from '../../core/pincode.service.js';

export type FarmerPincodeRegion = {
  pincode: string;
  village: string | null;
  taluk: string;
  district: string;
  state: string;
  lat: number | null;
  lon: number | null;
  /** Local mandi label for the card header */
  marketDisplayLabel: string;
};

function marketLabelFromPin(row: PincodeRow): string {
  const place = row.village?.trim() || row.taluk?.trim() || row.district;
  return `${place} Market, ${row.district}`;
}

export const marketInsightRegionService = {
  async resolveForFarmer(farmerId: string): Promise<FarmerPincodeRegion | null> {
    const { data: farmer, error } = await supabase
      .from('farmers')
      .select(
        'pincode_id, delivery_pincode, district, pincode_master(pincode, village, taluk, district, state, latitude, longitude)'
      )
      .eq('id', farmerId)
      .maybeSingle();

    throwIfSupabaseError(error, 'Could not load farmer pincode');

    const pm = farmer?.pincode_master as {
      pincode?: string;
      village?: string | null;
      taluk?: string;
      district?: string;
      state?: string;
      latitude?: number | null;
      longitude?: number | null;
    } | null;

    if (pm?.pincode && pm.taluk && pm.district && pm.state) {
      return {
        pincode: String(pm.pincode),
        village: pm.village ? String(pm.village) : null,
        taluk: String(pm.taluk),
        district: String(pm.district),
        state: String(pm.state),
        lat: pm.latitude != null ? Number(pm.latitude) : null,
        lon: pm.longitude != null ? Number(pm.longitude) : null,
        marketDisplayLabel: marketLabelFromPin({
          id: '',
          pincode: String(pm.pincode),
          village: pm.village ? String(pm.village) : null,
          taluk: String(pm.taluk),
          district: String(pm.district),
          state: String(pm.state),
          latitude: pm.latitude != null ? Number(pm.latitude) : null,
          longitude: pm.longitude != null ? Number(pm.longitude) : null,
        }),
      };
    }

    const delivery = farmer?.delivery_pincode
      ? String(farmer.delivery_pincode).replace(/\D/g, '').slice(0, 6)
      : '';
    if (delivery.length === 6) {
      const row = await pincodeService.lookupByPincode(delivery);
      if (row) {
        return {
          pincode: row.pincode,
          village: row.village,
          taluk: row.taluk,
          district: row.district,
          state: row.state,
          lat: row.latitude,
          lon: row.longitude,
          marketDisplayLabel: marketLabelFromPin(row),
        };
      }
    }

    return null;
  },
};
