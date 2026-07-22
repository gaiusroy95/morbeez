import type { CheckoutLineInput } from './checkout.service.js';
export type ValidatedCheckoutLine = CheckoutLineInput & {
    title: string;
    price: number;
};
export declare const checkoutPricingService: {
    validateLineItems(lineItems: CheckoutLineInput[]): Promise<ValidatedCheckoutLine[]>;
};
//# sourceMappingURL=checkout-pricing.service.d.ts.map