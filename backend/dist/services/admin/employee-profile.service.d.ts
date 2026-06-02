export declare const employeeProfileService: {
    list(filters?: {
        role?: string;
        status?: string;
        search?: string;
        limit?: number;
    }): Promise<any[]>;
    getById(id: string): Promise<any>;
    create(input: {
        fullName: string;
        email?: string;
        role: string;
        status?: "active" | "inactive";
        personalMobile?: string;
        companyWhatsapp?: string;
        alternateMobile?: string;
        gender?: string;
        dateOfBirth?: string;
        joiningDate?: string;
        department?: string;
        reportingManagerId?: string | null;
        employmentType?: string;
        state?: string;
        district?: string;
        taluk?: string;
        pincodeId?: string | null;
        address?: string;
        languages?: string[];
        cropsExpertise?: string[];
        diseaseKnowledgeRating?: number;
        whatsappSkillRating?: number;
        customerHandlingRating?: number;
        fieldExperienceYears?: number;
        agronomistTier?: "new" | "experienced";
        compensation?: Record<string, unknown>;
        attendanceRules?: Record<string, unknown>;
        adminUserId?: string | null;
    }): Promise<any>;
    update(id: string, input: {
        fullName?: string;
        email?: string;
        role?: string;
        status?: "active" | "inactive";
        personalMobile?: string;
        companyWhatsapp?: string;
        alternateMobile?: string;
        gender?: string;
        dateOfBirth?: string;
        joiningDate?: string;
        department?: string;
        reportingManagerId?: string | null;
        employmentType?: string;
        state?: string;
        district?: string;
        taluk?: string;
        pincodeId?: string | null;
        address?: string;
        languages?: string[];
        cropsExpertise?: string[];
        diseaseKnowledgeRating?: number;
        whatsappSkillRating?: number;
        customerHandlingRating?: number;
        fieldExperienceYears?: number;
        agronomistTier?: "new" | "experienced";
        compensation?: Record<string, unknown>;
        attendanceRules?: Record<string, unknown>;
    }): Promise<any>;
    /** Accept employee_profiles.id or linked admin_users.id. */
    resolveStaffReference(id: string): Promise<{
        profileId: string | null;
        adminUserId: string | null;
    }>;
    syncAdminActive(profileId: string, active: boolean): Promise<void>;
};
//# sourceMappingURL=employee-profile.service.d.ts.map