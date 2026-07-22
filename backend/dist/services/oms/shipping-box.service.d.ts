export type ShippingBox = {
    id: string;
    code: string;
    name: string;
    lengthCm: number;
    breadthCm: number;
    heightCm: number;
    maxWeightKg: number;
    tareWeightKg: number;
    liquidFriendly: boolean;
    packagingType: string | null;
    sortOrder: number;
    active: boolean;
};
export declare const shippingBoxService: {
    listActive(): Promise<ShippingBox[]>;
    listAll(): Promise<ShippingBox[]>;
    getById(id: string): Promise<ShippingBox>;
    getByCode(code: string): Promise<ShippingBox | null>;
    create(input: {
        code: string;
        name: string;
        lengthCm: number;
        breadthCm: number;
        heightCm: number;
        maxWeightKg: number;
        tareWeightKg?: number;
        liquidFriendly?: boolean;
        packagingType?: string | null;
        sortOrder?: number;
    }): Promise<ShippingBox>;
    update(id: string, patch: Partial<{
        code: string;
        name: string;
        lengthCm: number;
        breadthCm: number;
        heightCm: number;
        maxWeightKg: number;
        tareWeightKg: number;
        liquidFriendly: boolean;
        packagingType: string | null;
        sortOrder: number;
        active: boolean;
    }>): Promise<ShippingBox>;
};
//# sourceMappingURL=shipping-box.service.d.ts.map