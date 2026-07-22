import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
const graphqlUrl = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`;
export async function shopifyGraphql(query, variables) {
    const res = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    let payload;
    try {
        payload = JSON.parse(text);
    }
    catch {
        throw new AppError(`Shopify GraphQL error: ${res.status}`, res.status, 'SHOPIFY_API_ERROR', text);
    }
    if (!res.ok || payload.errors?.length) {
        const msg = payload.errors?.map((e) => e.message).join('; ') || text.slice(0, 200);
        throw new AppError(`Shopify GraphQL error: ${msg}`, res.status, 'SHOPIFY_API_ERROR', text);
    }
    if (!payload.data) {
        throw new AppError('Shopify GraphQL returned no data', 502, 'SHOPIFY_API_ERROR');
    }
    return payload.data;
}
//# sourceMappingURL=shopify.graphql.js.map