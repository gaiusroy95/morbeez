import { AppError } from '../../lib/errors.js';
import { shopifyGraphql } from './shopify.graphql.js';
/** Upload a publicly reachable image URL into Shopify Files and return the CDN URL. */
export async function uploadShopifyImageFromUrl(sourceUrl, fileName) {
    const data = await shopifyGraphql(`mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          ... on MediaImage {
            image { url }
          }
        }
        userErrors { field message }
      }
    }`, {
        files: [
            {
                alt: fileName,
                contentType: 'IMAGE',
                originalSource: sourceUrl,
            },
        ],
    });
    const errors = data.fileCreate.userErrors;
    if (errors?.length) {
        throw new AppError(`Shopify file upload failed: ${errors.map((e) => e.message).join('; ')}`, 502, 'SHOPIFY_FILE_UPLOAD_FAILED');
    }
    const url = data.fileCreate.files[0]?.image?.url;
    if (!url) {
        throw new AppError('Shopify file upload returned no image URL', 502, 'SHOPIFY_FILE_UPLOAD_FAILED');
    }
    return url;
}
//# sourceMappingURL=shopify-files.service.js.map