import { seoSyncService } from './seo-sync.service.js';

export const seoSchemaService = {
  buildProductSchema(input: {
    name: string;
    description: string;
    sku?: string;
    image?: string;
    price?: number;
    url: string;
    brand?: string;
  }) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: input.name,
      description: input.description,
      sku: input.sku,
      image: input.image,
      brand: { '@type': 'Brand', name: input.brand ?? 'Morbeez Agri Sciences' },
      offers: input.price
        ? {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: input.price,
            availability: 'https://schema.org/InStock',
            url: input.url,
          }
        : undefined,
    };
  },

  buildFaqSchema(faqs: Array<{ question: string; answer: string }>) {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    };
  },

  buildBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    };
  },

  buildArticleSchema(input: { title: string; description: string; url: string; datePublished?: string }) {
    const base = seoSyncService.storefrontBase();
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: input.title,
      description: input.description,
      url: `${base}${input.url.startsWith('/') ? input.url : `/${input.url}`}`,
      datePublished: input.datePublished ?? new Date().toISOString(),
      author: { '@type': 'Organization', name: 'Morbeez Agri Sciences' },
    };
  },

  buildReviewSchema(input: { productName: string; rating: number; reviewCount: number }) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: input.productName,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: input.rating,
        reviewCount: input.reviewCount,
      },
    };
  },

  bundleForProduct(input: {
    product: {
      name: string;
      description: string;
      sku?: string;
      image?: string;
      price?: number;
      url: string;
      brand?: string;
    };
    faqs?: Array<{ question: string; answer: string }>;
    breadcrumbs?: Array<{ name: string; url: string }>;
  }) {
    const graphs: Record<string, unknown>[] = [this.buildProductSchema(input.product)];
    if (input.faqs?.length) graphs.push(this.buildFaqSchema(input.faqs));
    if (input.breadcrumbs?.length) graphs.push(this.buildBreadcrumbSchema(input.breadcrumbs));
    return { '@context': 'https://schema.org', '@graph': graphs };
  },
};
