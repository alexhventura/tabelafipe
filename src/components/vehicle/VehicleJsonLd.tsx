import { Vehicle } from '../../types';
import { formatYearLabel, resolveDisplayYear } from '../../lib/displayYear';
import { vehicleDisplayName } from '../../lib/vehicle';

interface VehicleJsonLdProps {
  vehicle: Vehicle;
  url: string;
}

export default function VehicleJsonLd({ vehicle, url }: VehicleJsonLdProps) {
  const dy = resolveDisplayYear(vehicle.anoModelo);
  const display = vehicleDisplayName(vehicle);
  const name = dy.label ? `${display} ${dy.label}` : display;

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name,
    brand: { '@type': 'Brand', name: vehicle.marca },
    fuelType: vehicle.combustivel,
    offers: {
      '@type': 'Offer',
      price: String(vehicle.valorAtual),
      priceCurrency: 'BRL',
      url,
    },
  };

  if (dy.kind === 'year' && dy.year) {
    data.modelDate = String(dy.year);
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
