export declare function clearShiprocketTokenCache(): void;
export type ShiprocketAuthStatus = {
    configured: boolean;
    ok: boolean;
    error: string | null;
    hint: string | null;
};
export declare function verifyShiprocketAuth(opts?: {
    force?: boolean;
}): Promise<ShiprocketAuthStatus>;
export declare function getShiprocketToken(): Promise<string>;
export declare function shiprocketRequest<T>(path: string, init?: RequestInit, retried?: boolean): Promise<T>;
//# sourceMappingURL=shiprocket.client.d.ts.map