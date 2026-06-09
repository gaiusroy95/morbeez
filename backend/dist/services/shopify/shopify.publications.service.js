import { logger } from '../../lib/logger.js';
import { shopifyAdmin } from './shopify.client.js';
import { shopifyGraphql } from './shopify.graphql.js';
let cachedOnlineStorePublicationId = null;
function productGid(productId) {
    return `gid://shopify/Product/${productId}`;
}
async function resolveOnlineStorePublicationId() {
    if (cachedOnlineStorePublicationId)
        return cachedOnlineStorePublicationId;
    try {
        const data = await shopifyGraphql(`{
      publications(first: 25) {
        edges {
          node {
            id
            name
          }
        }
      }
    }`);
        const match = data.publications.edges.find((e) => String(e.node.name ?? '')
            .toLowerCase()
            .includes('online store')) ?? data.publications.edges[0];
        if (match?.node.id) {
            cachedOnlineStorePublicationId = match.node.id;
            return cachedOnlineStorePublicationId;
        }
    }
    catch (err) {
        logger.warn({ err }, 'Could not load Shopify publications via GraphQL');
    }
    return null;
}
async function publishViaRest(productId) {
    await shopifyAdmin(`/products/${productId}.json`, {
        method: 'PUT',
        body: JSON.stringify({
            product: {
                id: Number(productId),
                status: 'active',
                published_at: new Date().toISOString(),
            },
        }),
    });
}
async function unpublishViaRest(productId) {
    await shopifyAdmin(`/products/${productId}.json`, {
        method: 'PUT',
        body: JSON.stringify({
            product: {
                id: Number(productId),
                published_at: null,
            },
        }),
    });
}
export const shopifyPublicationsService = {
    async publishToOnlineStore(productId) {
        const publicationId = await resolveOnlineStorePublicationId();
        if (!publicationId) {
            await publishViaRest(productId);
            return;
        }
        try {
            const data = await shopifyGraphql(`mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
          publishablePublish(id: $id, input: $input) {
            publishable { ... on Product { id } }
            userErrors { field message }
          }
        }`, {
                id: productGid(productId),
                input: [{ publicationId }],
            });
            const errors = data.publishablePublish.userErrors;
            if (errors?.length) {
                throw new Error(errors.map((e) => e.message).join('; '));
            }
        }
        catch (err) {
            logger.warn({ err, productId }, 'GraphQL publish failed; trying REST published_at');
            await publishViaRest(productId);
        }
    },
    async unpublishFromOnlineStore(productId) {
        const publicationId = await resolveOnlineStorePublicationId();
        if (!publicationId) {
            await unpublishViaRest(productId);
            return;
        }
        try {
            const data = await shopifyGraphql(`mutation publishableUnpublish($id: ID!, $input: [PublicationInput!]!) {
          publishableUnpublish(id: $id, input: $input) {
            publishable { ... on Product { id } }
            userErrors { field message }
          }
        }`, {
                id: productGid(productId),
                input: [{ publicationId }],
            });
            const errors = data.publishableUnpublish.userErrors;
            if (errors?.length) {
                throw new Error(errors.map((e) => e.message).join('; '));
            }
        }
        catch (err) {
            logger.warn({ err, productId }, 'GraphQL unpublish failed; trying REST');
            await unpublishViaRest(productId);
        }
    },
    async syncProductVisibility(productId, status) {
        if (status === 'active') {
            await this.publishToOnlineStore(productId);
        }
        else {
            await this.unpublishFromOnlineStore(productId);
        }
    },
    async getConnectionStatus() {
        const { env } = await import('../../config/env.js');
        const storeDomain = env.SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const storefrontUrl = (env.SHOPIFY_STOREFRONT_URL ?? `https://${storeDomain}`).replace(/\/$/, '');
        const storeHost = storeDomain.split('.')[0]?.toLowerCase() ?? '';
        const storefrontHost = new URL(storefrontUrl).hostname.split('.')[0]?.toLowerCase() ?? '';
        const storeMismatch = storeHost !== storefrontHost && storefrontHost.length > 0;
        try {
            const res = await shopifyAdmin('/products/count.json');
            const productCount = res.count ?? 0;
            return {
                connected: true,
                storeDomain,
                storefrontUrl,
                productCount,
                storeMismatch,
                message: storeMismatch
                    ? `API is connected to ${storeDomain} but storefront URL is ${storefrontUrl}. Products are created on a different Shopify store than your live theme.`
                    : productCount === 0
                        ? 'Shopify is connected but no products exist yet.'
                        : `Connected to ${storeDomain} (${productCount} product${productCount === 1 ? '' : 's'}).`,
            };
        }
        catch {
            return {
                connected: false,
                storeDomain,
                storefrontUrl,
                productCount: 0,
                storeMismatch,
                message: `Cannot reach Shopify store ${storeDomain}. Check SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_ACCESS_TOKEN on the API server.`,
            };
        }
    },
};
//# sourceMappingURL=shopify.publications.service.js.map