export declare const farmerPortalService: {
    getProfile(farmerId: string): Promise<{
        id: unknown;
        email: unknown;
        firstName: unknown;
        lastName: unknown;
        name: unknown;
        phone: unknown;
        village: unknown;
        district: {} | null;
        state: {} | null;
        pincode: {} | null;
        shippingAddress: {} | null;
        deliveryPincode: {} | null;
        newsletterSubscribed: unknown;
        createdAt: unknown;
    }>;
    getSummary(farmerId: string): Promise<{
        greetingName: {};
        crop: {
            name: string;
            variety: string | null;
            fieldSize: string | null;
            blockName: string;
            stage: string;
            daysAfterPlanting: number | null;
        } | null;
        shippingAddress: {
            name: unknown;
            phone: unknown;
            lines: unknown[];
            verified: boolean;
        };
        atAGlance: {
            activeOrders: number;
            nextAdvisory: string;
            nextAdvisoryHint: string | null;
            newReports: number;
            estimatedProfitInr: number;
        };
        quickAccess: {
            ordersCount: number;
            hasAdvisory: boolean;
            reportsCount: number;
            roiBalance: number;
        };
        latestRecommendation: {
            id: string;
            cropName: any;
            stage: string | null;
            dateLabel: string;
            dayLabel: string | null;
            bullets: string[];
            summary: string | null;
        } | null;
        recentOrder: {
            id: string;
            orderNumber: string;
            productTitle: string;
            productImageUrl: string | null;
            quantity: number;
            amountInr: number;
            status: string;
            statusLabel: string;
            statusTone: string;
            orderedOn: string;
            deliveredOn: string;
            trackingAwb: string | null;
            trackingUrl: string | null;
            lineItems: {
                title: string;
                quantity: number;
                imageUrl: string | null;
            }[];
        } | null;
        notifications: {
            id: string;
            type: string;
            message: string;
            atLabel: string;
            tone: string;
        }[];
    }>;
    listOrders(farmerId: string): Promise<{
        orders: {
            id: string;
            orderNumber: string;
            productTitle: string;
            productImageUrl: string | null;
            quantity: number;
            amountInr: number;
            status: string;
            statusLabel: string;
            statusTone: string;
            orderedOn: string;
            deliveredOn: string;
            trackingAwb: string | null;
            trackingUrl: string | null;
            lineItems: {
                title: string;
                quantity: number;
                imageUrl: string | null;
            }[];
        }[];
    }>;
    getOrderTracking(farmerId: string, orderId: string): Promise<{
        order: {
            id: string;
            orderNumber: string;
            productTitle: string;
            productImageUrl: string | null;
            quantity: number;
            amountInr: number;
            status: string;
            statusLabel: string;
            statusTone: string;
            orderedOn: string;
            deliveredOn: string;
            trackingAwb: string | null;
            trackingUrl: string | null;
            lineItems: {
                title: string;
                quantity: number;
                imageUrl: string | null;
            }[];
        };
        tracking: {
            courier: string;
            trackingAwb: string | null;
            trackingUrl: string | null | undefined;
            expectedDelivery: string | null;
            deliveryBy: string;
            paymentLabel: string;
            paymentSubtext: string;
            deliveryAddress: string | null;
            shiprocketNote: string | null;
            omsStatus: string | null;
        };
        timeline: {
            key: string;
            label: string;
            at: string | null;
            done: boolean;
            pending?: boolean;
        }[];
        lineItems: import("../admin/telecaller-farmer-orders.service.js").TelecallerOrderLine[];
        canReview: boolean;
        reviewLines: import("./farmer-product-review.service.js").ReviewableLineItem[];
    }>;
    submitOrderReview(farmerId: string, orderId: string, input: {
        productKey: string;
        rating: number;
        reviewText?: string;
    }): Promise<{
        id: string;
        rating: number;
        reviewText: string | null;
        createdAt: string;
        productKey: string;
        productTitle: string;
    }>;
    getAdvisory(farmerId: string): Promise<{
        crop: {
            name: string;
            fieldSize: string | null;
            stage: string;
            daysAfterPlanting: number | null;
        } | null;
        recommendations: {
            id: string;
            dateLabel: string;
            cropName: any;
            blockName: string | null;
            stage: string | null;
            dayLabel: string | null;
            title: string;
            bullets: string[];
            applicationMethod: string | null;
            followUpLabel: string | null;
            status: string;
        }[];
        schedule: {
            id: string;
            dueLabel: string;
            type: string;
            notes: string | null;
        }[];
        alerts: {
            message: string;
            dueLabel: string;
        }[];
    }>;
    listSoilReports(farmerId: string): Promise<{
        reports: {
            id: string;
            blockName: string;
            dateLabel: string;
            health: "good" | "critical" | "monitor";
            healthLabel: string;
            pdfUrl: string | null;
            highlights: string[];
        }[];
    }>;
    getRoi(farmerId: string): Promise<{
        summary: {
            inputCostInr: number;
            estimatedYieldIncomeInr: number;
            estimatedProfitInr: number;
            acreage: number | null;
            marketNote: string;
        };
        recentEntries: {
            id: string;
            dateLabel: string;
            category: string;
            amountInr: number;
            type: string;
            note: string | null;
        }[];
    }>;
    listNotifications(farmerId: string, limit?: number): Promise<{
        id: string;
        type: string;
        message: string;
        atLabel: string;
        tone: string;
    }[]>;
    listFieldPhotos(farmerId: string): Promise<{
        photos: {
            id: string;
            uploadedAt: string;
            crop: string | null;
            status: string;
            previewUrl: string | null;
        }[];
    }>;
    uploadFieldPhoto(farmerId: string, input: {
        photoType: "field" | "leaf" | "rhizome";
        imageData: string;
        mimeType?: string;
        notes?: string;
    }): Promise<{
        ok: boolean;
        imageId: string | null;
        message: string;
    }>;
    updateShippingAddress(farmerId: string, input: {
        address1?: string;
        address2?: string;
        city?: string;
        state?: string;
        pincode?: string;
    }): Promise<{
        id: unknown;
        email: unknown;
        firstName: unknown;
        lastName: unknown;
        name: unknown;
        phone: unknown;
        village: unknown;
        district: {} | null;
        state: {} | null;
        pincode: {} | null;
        shippingAddress: {} | null;
        deliveryPincode: {} | null;
        newsletterSubscribed: unknown;
        createdAt: unknown;
    }>;
};
//# sourceMappingURL=farmer-portal.service.d.ts.map