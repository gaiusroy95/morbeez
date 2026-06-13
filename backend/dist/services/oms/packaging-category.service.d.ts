export type PackagingCategory = {
    id: string;
    name: string;
    description: string | null;
    priority: number;
    active: boolean;
};
export declare const packagingCategoryService: {
    listAll(): Promise<PackagingCategory[]>;
    listActive(): Promise<PackagingCategory[]>;
    getById(id: string): Promise<PackagingCategory>;
    getGeneralCategory(): Promise<PackagingCategory>;
    create(input: {
        name: string;
        description?: string;
        priority?: number;
    }): Promise<PackagingCategory>;
    update(id: string, patch: Partial<{
        name: string;
        description: string | null;
        priority: number;
        active: boolean;
    }>): Promise<PackagingCategory>;
    remove(id: string): Promise<void>;
};
//# sourceMappingURL=packaging-category.service.d.ts.map