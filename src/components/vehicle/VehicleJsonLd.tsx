import { Vehicle } from '../../types';
import { vehicleDisplayName } from '../../lib/vehicle';

interface VehicleJsonLdProps {
  vehicle: Vehicle;
  url: string;
}

export default function VehicleJsonLd({ vehicle, url }: VehicleJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: `${vehicleDisplayName(vehicle)} ${vehicle.anoModelo}`,
    brand: { '@type': 'Brand', name: vehicle.marca },
    modelDate: String(vehicle.anoModelo),
    fuelType: vehicle.combustivel,
    offers: {
      '@type': 'Offer',
      price: String(vehicle.valorAtual),
      priceCurrency: 'BRL',
      url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
