interface ProductJsonLdProps {
  name: string;
  brand: string;
  description: string;
  url: string;
  lowPrice?: number | null;
  highPrice?: number | null;
  offerCount?: number;
}

export default function ProductJsonLd({
  name,
  brand,
  description,
  url,
  lowPrice,
  highPrice,
  offerCount,
}: ProductJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    brand: { '@type': 'Brand', name: brand },
    description,
    url,
    ...(lowPrice != null && highPrice != null
      ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'BRL',
            lowPrice: String(lowPrice),
            highPrice: String(highPrice),
            offerCount: offerCount ?? 1,
            url,
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
