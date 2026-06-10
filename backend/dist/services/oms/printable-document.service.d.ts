export type PrintableDocType = 'picking_slip' | 'packing_slip' | 'tax_invoice' | 'courier_label' | 'return_inspection';
export declare const printableDocumentService: {
    getDocument(type: PrintableDocType, entityId: string): Promise<{
        type: "picking_slip";
        company: {
            companyName: string;
            formattedAddress: string;
            gstin: string;
            customerCareNumber: string;
            whatsappNumber: string;
            quotationLogoUrl: string;
            termsAndConditions: string;
        };
        document: {
            title: string;
            orderId: any;
            pickListId: any;
            pickerId: any;
            status: any;
            printedAt: string;
            lines: {
                sku: unknown;
                productTitle: unknown;
                barcode: unknown;
                batchCode: unknown;
                rackLocation: unknown;
                qty: unknown;
                qrPayload: string;
            }[];
        };
    } | {
        type: "packing_slip";
        company: {
            companyName: string;
            formattedAddress: string;
            gstin: string;
            customerCareNumber: string;
            whatsappNumber: string;
            quotationLogoUrl: string;
            termsAndConditions: string;
        };
        document: {
            title: string;
            orderId: unknown;
            customerName: unknown;
            phone: unknown;
            shippingAddress: string[];
            specialInstructions: null;
            totalWeightKg: any;
            printedAt: string;
            lines: {
                productTitle: any;
                sku: any;
                batchCode: any;
                qty: any;
            }[];
        };
    } | {
        type: "tax_invoice";
        company: {
            companyName: string;
            formattedAddress: string;
            gstin: string;
            customerCareNumber: string;
            whatsappNumber: string;
            quotationLogoUrl: string;
            termsAndConditions: string;
        };
        document: {
            title: string;
            invoiceNumber: any;
            documentType: any;
            issuedAt: any;
            invoiceDate: string;
            orderDate: string;
            orderName: {} | null;
            customerName: any;
            customerGstin: any;
            customerState: any;
            placeOfSupply: any;
            companyGstin: any;
            companyState: string;
            orderSource: {};
            paymentMethod: {};
            paymentTerms: string;
            termsOfDelivery: string;
            codAmount: number;
            subtotal: number;
            subtotalInclusive: number;
            cgst: number;
            sgst: number;
            igst: number;
            freight: any;
            total: number;
            balanceDue: number;
            totalInWords: string;
            pricingMode: string;
            taxBreakup: {
                sameState: boolean;
                cgst: number;
                sgst: number;
                igst: number;
            };
            billTo: string[];
            shipTo: string[];
            bankDetails: {
                accountName: string | null;
                accountNumber: string | null;
                bankName: string | null;
                branch: string | null;
                ifsc: string | null;
            };
            lines: {
                description: unknown;
                hsnCode: unknown;
                sku: string | null;
                qty: number;
                unitPrice: number;
                lineTotal: number;
                taxableAmount: number;
                gstPercent: number;
                halfGstPercent: number;
                cgst: number;
                sgst: number;
                igst: number;
                gstAmount: number;
                batchCode: unknown;
            }[];
            gstSlabSummary: {
                gstPercent: number;
                halfPercent: number;
                cgst: number;
                sgst: number;
                igst: number;
                totalTax: number;
            }[];
            hsnSummary: {
                hsn: string;
                gstPercent: number;
                halfPercent: number;
                taxableAmount: number;
                cgst: number;
                sgst: number;
                igst: number;
                totalTax: number;
            }[];
            companySnapshot: Record<string, unknown>;
            jurisdictionNote: string;
        };
    } | {
        type: "courier_label";
        company: {
            companyName: string;
            formattedAddress: string;
            gstin: string;
            customerCareNumber: string;
            whatsappNumber: string;
            quotationLogoUrl: string;
            termsAndConditions: string;
        };
        document: {
            title: string;
            orderId: any;
            awbCode: any;
            courierName: any;
            dispatchRack: any;
            deliveryAddress: string[];
            contactNumber: any;
            codAmount: number;
            barcodePayload: string | null;
            qrPayload: string | null;
            assignedEmployee: string | null;
            printSequence: any;
            shiprocketLabelUrl: string | null;
            printedAt: string;
        };
    } | {
        type: "return_inspection";
        company: {
            companyName: string;
            formattedAddress: string;
            gstin: string;
            customerCareNumber: string;
            whatsappNumber: string;
            quotationLogoUrl: string;
            termsAndConditions: string;
        };
        document: {
            title: string;
            returnNumber: any;
            status: any;
            orderId: unknown;
            reason: any;
            customerComplaint: any;
            verificationCallDone: any;
            verifiedBy: any;
            verifiedAt: any;
            receivedAt: any;
            productCondition: any;
            inspectionNotes: any;
            refundType: any;
            refundAmount: any;
            approvedBy: any;
            approvedAt: any;
            stockAction: any;
            lines: any;
            printedAt: string;
        };
    }>;
    buildPickingSlip(pickListId: string): Promise<{
        title: string;
        orderId: any;
        pickListId: any;
        pickerId: any;
        status: any;
        printedAt: string;
        lines: {
            sku: unknown;
            productTitle: unknown;
            barcode: unknown;
            batchCode: unknown;
            rackLocation: unknown;
            qty: unknown;
            qrPayload: string;
        }[];
    }>;
    buildPackingSlip(pickListId: string): Promise<{
        title: string;
        orderId: unknown;
        customerName: unknown;
        phone: unknown;
        shippingAddress: string[];
        specialInstructions: null;
        totalWeightKg: any;
        printedAt: string;
        lines: {
            productTitle: any;
            sku: any;
            batchCode: any;
            qty: any;
        }[];
    }>;
    buildTaxInvoice(invoiceId: string): Promise<{
        title: string;
        invoiceNumber: any;
        documentType: any;
        issuedAt: any;
        invoiceDate: string;
        orderDate: string;
        orderName: {} | null;
        customerName: any;
        customerGstin: any;
        customerState: any;
        placeOfSupply: any;
        companyGstin: any;
        companyState: string;
        orderSource: {};
        paymentMethod: {};
        paymentTerms: string;
        termsOfDelivery: string;
        codAmount: number;
        subtotal: number;
        subtotalInclusive: number;
        cgst: number;
        sgst: number;
        igst: number;
        freight: any;
        total: number;
        balanceDue: number;
        totalInWords: string;
        pricingMode: string;
        taxBreakup: {
            sameState: boolean;
            cgst: number;
            sgst: number;
            igst: number;
        };
        billTo: string[];
        shipTo: string[];
        bankDetails: {
            accountName: string | null;
            accountNumber: string | null;
            bankName: string | null;
            branch: string | null;
            ifsc: string | null;
        };
        lines: {
            description: unknown;
            hsnCode: unknown;
            sku: string | null;
            qty: number;
            unitPrice: number;
            lineTotal: number;
            taxableAmount: number;
            gstPercent: number;
            halfGstPercent: number;
            cgst: number;
            sgst: number;
            igst: number;
            gstAmount: number;
            batchCode: unknown;
        }[];
        gstSlabSummary: {
            gstPercent: number;
            halfPercent: number;
            cgst: number;
            sgst: number;
            igst: number;
            totalTax: number;
        }[];
        hsnSummary: {
            hsn: string;
            gstPercent: number;
            halfPercent: number;
            taxableAmount: number;
            cgst: number;
            sgst: number;
            igst: number;
            totalTax: number;
        }[];
        companySnapshot: Record<string, unknown>;
        jurisdictionNote: string;
    }>;
    buildCourierLabel(commerceOrderId: string): Promise<{
        title: string;
        orderId: any;
        awbCode: any;
        courierName: any;
        dispatchRack: any;
        deliveryAddress: string[];
        contactNumber: any;
        codAmount: number;
        barcodePayload: string | null;
        qrPayload: string | null;
        assignedEmployee: string | null;
        printSequence: any;
        shiprocketLabelUrl: string | null;
        printedAt: string;
    }>;
    buildReturnInspection(returnId: string): Promise<{
        title: string;
        returnNumber: any;
        status: any;
        orderId: unknown;
        reason: any;
        customerComplaint: any;
        verificationCallDone: any;
        verifiedBy: any;
        verifiedAt: any;
        receivedAt: any;
        productCondition: any;
        inspectionNotes: any;
        refundType: any;
        refundAmount: any;
        approvedBy: any;
        approvedAt: any;
        stockAction: any;
        lines: any;
        printedAt: string;
    }>;
    getDocumentsForOrder(commerceOrderId: string): Promise<{
        pickListId: any;
        invoices: {
            id: any;
            document_type: any;
            invoice_number: any;
            status: any;
            issued_at: any;
        }[];
        returns: {
            id: any;
            return_number: any;
            status: any;
        }[];
        printables: ({
            type: "tax_invoice";
            id: any;
            label: string;
        } | {
            type: "return_inspection";
            id: any;
            label: string;
        } | {
            type: "picking_slip";
            id: any;
            label: string;
        } | {
            type: "packing_slip";
            id: any;
            label: string;
        } | {
            type: "courier_label";
            id: string;
            label: string;
        } | null)[];
    }>;
};
//# sourceMappingURL=printable-document.service.d.ts.map