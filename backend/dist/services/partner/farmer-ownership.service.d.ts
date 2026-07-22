import type { CustomerOwnerType, EnrollmentOwnerType, FarmerOwnership, ServiceModel } from './partner.types.js';
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
export declare const farmerOwnershipService: {
    getOwnership(farmerId: string): Promise<FarmerOwnership | null>;
    /** Set immutable enrollment ownership — only when not already set. */
    setEnrollmentOwnership(input: SetEnrollmentOwnershipInput): Promise<FarmerOwnership>;
    changeCustomerOwner(input: ChangeCustomerOwnerInput): Promise<FarmerOwnership>;
    syncTelecallerAssignment(farmerId: string, telecallerEmail: string | null): Promise<void>;
};
//# sourceMappingURL=farmer-ownership.service.d.ts.map