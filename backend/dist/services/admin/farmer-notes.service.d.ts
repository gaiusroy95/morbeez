export declare const farmerNotesService: {
    list(farmerId: string, limit?: number): Promise<{
        id: string;
        noteText: string;
        authorEmail: string | null;
        createdAt: string;
    }[]>;
    create(farmerId: string, authorEmail: string, noteText: string): Promise<any>;
};
//# sourceMappingURL=farmer-notes.service.d.ts.map