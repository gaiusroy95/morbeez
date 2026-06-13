export type EnrollmentOwnerType = 'partner' | 'morbeez' | 'referral' | 'campaign';
export type CustomerOwnerType = 'partner' | 'morbeez';
export type ServiceModel = 'remote_advisory' | 'partner_assisted';

export type PartnerStatus =
  | 'applied'
  | 'verified'
  | 'training'
  | 'certified'
  | 'active'
  | 'suspended'
  | 'inactive';

export type PartnerTier = 'associate' | 'certified' | 'senior' | 'master';

export type PartnerAttributionType =
  | 'enrollment'
  | 'visit'
  | 'meeting'
  | 'soil_collection'
  | 'conversion_assist'
  | 'reactivation';

export type FarmerOwnership = {
  enrollmentOwnerType: EnrollmentOwnerType | null;
  enrollmentOwnerPartnerId: string | null;
  enrollmentSource: string | null;
  enrollmentEventId: string | null;
  customerOwnerType: CustomerOwnerType | null;
  customerOwnerPartnerId: string | null;
  serviceModel: ServiceModel | null;
  assignedPartnerId: string | null;
  assignedTelecallerEmail: string | null;
  assignedExpertEmail: string | null;
  partnerCodeAtEnrollment: string | null;
};
