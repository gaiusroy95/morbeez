export interface PartnerTokenPayload {
    sub: string;
    phone: string;
    typ: 'partner';
    exp: number;
}
export declare function createPartnerToken(partnerId: string, phone: string, ttlDays?: number): string;
export declare function verifyPartnerToken(token: string): PartnerTokenPayload;
export declare function generatePartnerCode(name: string): string;
export declare function generateQrToken(partnerCode: string): string;
//# sourceMappingURL=partner-jwt.d.ts.map