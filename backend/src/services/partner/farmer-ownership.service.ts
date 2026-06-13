import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ValidationError } from '../../lib/errors.js';
import type {
  CustomerOwnerType,
  EnrollmentOwnerType,
  FarmerOwnership,
  ServiceModel,
} from './partner.types.js';

export type SetEnrollmentOwnershipInput = {
  farmerId: string;
  enrollmentOwnerType: EnrollmentOwnerType;
  enrollmentOwnerPartnerId?: string | null;
  enrollmentSource: string;
  enrollmentEventId?: string | null;
  partnerCodeAtEnrollment?: string | null;
  serviceModel?: ServiceModel;
  customerOwnerType?: CustomerOwnerType;
  customerOwnerPartnerId?: string | null;
  assignedPartnerId?: string | null;
};

export type ChangeCustomerOwnerInput = {
  farmerId: string;
  customerOwnerType: CustomerOwnerType;
  customerOwnerPartnerId?: string | null;
  serviceModel: ServiceModel;
  assignedPartnerId?: string | null;
  reason: string;
  changedBy?: string | null;
};

function rowToOwnership(row: Record<string, unknown>): FarmerOwnership {
  return {
    enrollmentOwnerType: (row.enrollment_owner_type as EnrollmentOwnerType) ?? null,
    enrollmentOwnerPartnerId: row.enrollment_owner_partner_id
      ? String(row.enrollment_owner_partner_id)
      : null,
    enrollmentSource: row.enrollment_source ? String(row.enrollment_source) : null,
    enrollmentEventId: row.enrollment_event_id ? String(row.enrollment_event_id) : null,
    customerOwnerType: (row.customer_owner_type as CustomerOwnerType) ?? null,
    customerOwnerPartnerId: row.customer_owner_partner_id
      ? String(row.customer_owner_partner_id)
      : null,
    serviceModel: (row.service_model as ServiceModel) ?? null,
    assignedPartnerId: row.assigned_partner_id ? String(row.assigned_partner_id) : null,
    assignedTelecallerEmail: row.assigned_telecaller_email
      ? String(row.assigned_telecaller_email)
      : null,
    assignedExpertEmail: row.assigned_expert_email ? String(row.assigned_expert_email) : null,
    partnerCodeAtEnrollment: row.partner_code_at_enrollment
      ? String(row.partner_code_at_enrollment)
      : null,
  };
}

export const farmerOwnershipService = {
  async getOwnership(farmerId: string): Promise<FarmerOwnership | null> {
    const { data, error } = await supabase
      .from('farmers')
      .select(
        'enrollment_owner_type, enrollment_owner_partner_id, enrollment_source, enrollment_event_id, customer_owner_type, customer_owner_partner_id, service_model, assigned_partner_id, assigned_telecaller_email, assigned_expert_email, partner_code_at_enrollment'
      )
      .eq('id', farmerId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load farmer ownership');
    if (!data) return null;
    return rowToOwnership(data);
  },

  /** Set immutable enrollment ownership — only when not already set. */
  async setEnrollmentOwnership(input: SetEnrollmentOwnershipInput): Promise<FarmerOwnership> {
    const existing = await this.getOwnership(input.farmerId);
    if (existing?.enrollmentOwnerType) {
      return existing;
    }

    const customerOwnerType =
      input.customerOwnerType ??
      (input.enrollmentOwnerType === 'partner' && input.enrollmentOwnerPartnerId
        ? 'partner'
        : 'morbeez');
    const customerOwnerPartnerId =
      input.customerOwnerPartnerId ??
      (customerOwnerType === 'partner' ? input.enrollmentOwnerPartnerId ?? null : null);
    const serviceModel =
      input.serviceModel ??
      (customerOwnerType === 'partner' ? 'partner_assisted' : 'remote_advisory');
    const assignedPartnerId =
      input.assignedPartnerId ??
      (customerOwnerType === 'partner' ? customerOwnerPartnerId : null);

    const patch = {
      enrollment_owner_type: input.enrollmentOwnerType,
      enrollment_owner_partner_id: input.enrollmentOwnerPartnerId ?? null,
      enrollment_source: input.enrollmentSource,
      enrollment_event_id: input.enrollmentEventId ?? null,
      partner_code_at_enrollment: input.partnerCodeAtEnrollment ?? null,
      customer_owner_type: customerOwnerType,
      customer_owner_partner_id: customerOwnerPartnerId,
      service_model: serviceModel,
      assigned_partner_id: assignedPartnerId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('farmers')
      .update(patch)
      .eq('id', input.farmerId)
      .select(
        'enrollment_owner_type, enrollment_owner_partner_id, enrollment_source, enrollment_event_id, customer_owner_type, customer_owner_partner_id, service_model, assigned_partner_id, assigned_telecaller_email, assigned_expert_email, partner_code_at_enrollment'
      )
      .single();
    throwIfSupabaseError(error, 'Could not set enrollment ownership');

    await supabase.from('farmer_ownership_history').insert({
      farmer_id: input.farmerId,
      customer_owner_type: customerOwnerType,
      customer_owner_partner_id: customerOwnerPartnerId,
      service_model: serviceModel,
      assigned_partner_id: assignedPartnerId,
      reason: 'initial_enrollment',
      changed_by: 'system',
    });

    return rowToOwnership(data);
  },

  async changeCustomerOwner(input: ChangeCustomerOwnerInput): Promise<FarmerOwnership> {
    if (input.customerOwnerType === 'partner' && !input.customerOwnerPartnerId) {
      throw new ValidationError('Partner customer owner requires partner id');
    }

    const patch = {
      customer_owner_type: input.customerOwnerType,
      customer_owner_partner_id:
        input.customerOwnerType === 'partner' ? input.customerOwnerPartnerId : null,
      service_model: input.serviceModel,
      assigned_partner_id:
        input.assignedPartnerId ??
        (input.customerOwnerType === 'partner' ? input.customerOwnerPartnerId : null),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('farmers')
      .update(patch)
      .eq('id', input.farmerId)
      .select(
        'enrollment_owner_type, enrollment_owner_partner_id, enrollment_source, enrollment_event_id, customer_owner_type, customer_owner_partner_id, service_model, assigned_partner_id, assigned_telecaller_email, assigned_expert_email, partner_code_at_enrollment'
      )
      .single();
    throwIfSupabaseError(error, 'Could not change customer owner');

    await supabase.from('farmer_ownership_history').insert({
      farmer_id: input.farmerId,
      customer_owner_type: input.customerOwnerType,
      customer_owner_partner_id: patch.customer_owner_partner_id,
      service_model: input.serviceModel,
      assigned_partner_id: patch.assigned_partner_id,
      reason: input.reason,
      changed_by: input.changedBy ?? 'system',
    });

    return rowToOwnership(data);
  },

  async syncTelecallerAssignment(farmerId: string, telecallerEmail: string | null): Promise<void> {
    const { error } = await supabase
      .from('farmers')
      .update({
        assigned_telecaller_email: telecallerEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', farmerId);
    throwIfSupabaseError(error, 'Could not sync telecaller assignment');
  },
};
