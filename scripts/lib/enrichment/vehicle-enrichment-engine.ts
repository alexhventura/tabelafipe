/**
 * VehicleEnrichmentEngine — merge offline de todas as fontes por vehicle_id.
 */
import type {
  EnrichedVehicle,
  GeneratedVehicle,
  NormalizedVehicle,
  SourceAttribution,
  SourceId,
} from './types.js';
import { inferCategoriaPecas } from './derived-metrics.js';
import { buildDerivedMetrics, buildSegmentPriceIndex } from './derived-metrics.js';
import { buildVehicleRelationIndex } from './derived-attributes.js';
import { SourceRegistry } from './source-loaders.js';
import { formatVehicleDisplayName } from '../../../src/lib/display.ts';

const PIPELINE_VERSION = 1;

export class VehicleEnrichmentEngine {
  private readonly registry: SourceRegistry;
  private readonly priceIndex: ReturnType<typeof buildSegmentPriceIndex>;
  private readonly relationIndex: ReturnType<typeof buildVehicleRelationIndex>;
  private readonly lastUpdated: string;

  constructor(
    private readonly vehicles: NormalizedVehicle[],
    registry?: SourceRegistry,
  ) {
    this.registry = registry ?? new SourceRegistry();
    this.priceIndex = buildSegmentPriceIndex(vehicles);
    this.relationIndex = buildVehicleRelationIndex(vehicles);
    const now = new Date();
    this.lastUpdated = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  get registryRef(): SourceRegistry {
    return this.registry;
  }

  enrichOne(vehicle: NormalizedVehicle): EnrichedVehicle {
    const attributions: SourceAttribution[] = [];
    const sources = new Set<SourceId>(['FIPE']);

    attributions.push({ source: 'FIPE', field: 'vehicle', confidence: 'high' });

    const { historico, metricas } = this.registry.getHistory(vehicle.vehicleId);
    if (historico.length > 0) {
      sources.add('FIPE');
      attributions.push({ source: 'FIPE', field: 'historico', confidence: 'high' });
    }

    const staticMatch = this.registry.matchStaticSpecs(vehicle.vehicleId);
    let inmetro = staticMatch.inmetro ?? this.registry.matchInmetro(vehicle.marca, vehicle.modelo);
    let specs = staticMatch.specs ?? this.registry.matchManufacturer(vehicle.marca, vehicle.modelo, vehicle.ano);

    if (inmetro) {
      sources.add('INMETRO');
      attributions.push({ source: 'INMETRO', field: 'inmetro', confidence: 'medium', matchedBy: 'static-or-pbev' });
    }

    if (specs) {
      sources.add('MANUFACTURER');
      attributions.push({ source: 'MANUFACTURER', field: 'specs', confidence: 'medium', matchedBy: staticMatch.specs ? 'static-catalog' : 'manufacturerMatchKey' });
    }

    const market = this.registry.matchMarket(vehicle.vehicleId);
    if (market) {
      sources.add('MARKETPLACE');
      attributions.push({ source: 'MARKETPLACE', field: 'market', confidence: 'low' });
    }

    const safety = this.registry.matchSafety(vehicle.marca, vehicle.modelo, vehicle.ano);
    if (safety) attributions.push({ source: 'INMETRO', field: 'safety', confidence: 'high' });

    const recalls = this.registry.matchRecalls(vehicle.marca, vehicle.modelo, vehicle.ano);
    const warranty = this.registry.matchWarranty(vehicle.marca);

    const derived = buildDerivedMetrics(vehicle, historico, inmetro, this.priceIndex, this.relationIndex, specs);
    sources.add('DERIVED');
    attributions.push({ source: 'DERIVED', field: 'derived', confidence: 'medium' });

    const categoriaPecas = inferCategoriaPecas(vehicle.marca, vehicle.valor);

    return {
      vehicleId: vehicle.vehicleId,
      vehicleUid: vehicle.vehicleUid ?? vehicle.vehicleId,
      vehicle,
      historico,
      historicoMetricas: metricas,
      inmetro,
      specs,
      safety,
      recalls,
      warranty,
      market,
      derived,
      categoriaPecas,
      attributions,
      metadata: {
        sources: [...sources],
        last_updated: this.lastUpdated,
        pipeline_version: PIPELINE_VERSION,
      },
    };
  }

  enrichAll(): EnrichedVehicle[] {
    return this.vehicles.map((v) => this.enrichOne(v));
  }

  toGenerated(enriched: EnrichedVehicle): GeneratedVehicle {
    const v = enriched.vehicle;
    const flex = v.combustivel.toLowerCase().includes('flex');
    const consumo = {
      cidadeG: enriched.inmetro?.consumoCidade ?? null,
      cidadeE: flex ? (enriched.inmetro?.consumoCidadeEtanol ?? null) : null,
      estradaG: enriched.inmetro?.consumoEstrada ?? null,
      estradaE: flex ? (enriched.inmetro?.consumoEstradaEtanol ?? null) : null,
    };

    const historicoPrecos = enriched.historico.length
      ? enriched.historico.map((h) => ({ mes: h.referencia, valor: h.valor }))
      : [{ mes: v.mesReferencia, valor: v.valor }];

    return {
      vehicle: {
        ...v,
        nome: formatVehicleDisplayName(v.marca, v.modelo, `${v.marca} ${v.modelo} (${v.ano === 0 ? 'Zero KM' : v.ano})`),
        anoModelo: v.ano,
        valorAtual: v.valor,
        historicoPrecos,
        categoriaPecas: enriched.categoriaPecas,
        consumo,
      },
      inmetro: enriched.inmetro,
      specs: enriched.specs,
      safety: enriched.safety,
      recalls: enriched.recalls,
      warranty: enriched.warranty,
      market: enriched.market,
      derived: enriched.derived,
      metadata: enriched.metadata,
    };
  }
}