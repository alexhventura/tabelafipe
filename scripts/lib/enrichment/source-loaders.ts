/**
 * Loaders das fontes RAW — offline, sem APIs em runtime.
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../fipe-paths.js';
import { manufacturerMatchKey } from './matching-engine.js';
import { marcaSlug } from '../fipe-slug.js';
import { buildInmetroMatchIndex, matchInmetroForVehicleWithMeta, type InmetroMatchable } from './inmetro-match.js';
import type { HistoricoMetricas, HistoricoPonto, InmetroData, MarketData, RecallData, SafetyData, SpecsData, WarrantyData } from './types.js';

interface ManufacturerRecord {
  marca: string;
  modelo: string;
  ano?: number;
  potenciaCv?: number;
  torqueNm?: number;
  cilindradaCc?: number;
  cambio?: string;
  pesoKg?: number;
  comprimentoMm?: number;
  larguraMm?: number;
  alturaMm?: number;
  portaMalasL?: number;
  tanqueL?: number;
  aceleracao0a100?: number;
  velocidadeMaxKmh?: number;
  fonte?: string;
}

interface SafetyRecord {
  marca: string;
  modelo: string;
  ano?: number;
  notaGeral?: number;
  protecaoAdultos?: number;
  protecaoInfantis?: number;
  dataTeste?: string;
}

interface RecallRecord {
  marca: string;
  modelo: string;
  anoInicio?: number;
  anoFim?: number;
  titulo: string;
  status: string;
  data?: string;
  id: string;
}

interface WarrantyRecord {
  marca: string;
  garantiaTotalAnos?: number;
  garantiaAnticorrosaoAnos?: number;
  garantiaMotorAnos?: number;
  fonte?: string;
}

interface MarketRecord {
  vehicleId?: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  precoMedio?: number;
  totalAnuncios?: number;
  fonte?: string;
}

type NormalizedInmetroRow = InmetroMatchable & {
  consumoCidade?: number;
  consumoEstrada?: number;
  consumoCidadeEtanol?: number;
  consumoEstradaEtanol?: number;
  classificacaoEnergetica?: string;
  edicaoId?: string;
  anoReferencia?: number;
};

interface StaticSpecRecord {
  vehicleId: string;
  specs?: {
    potencia?: { valor?: number };
    torque?: { valor?: number };
    cilindrada?: { valor?: number };
    cambio?: string;
    consumo?: {
      cidadeG?: number;
      cidadeE?: number;
      estradaG?: number;
      estradaE?: number;
      fonte?: string;
    };
    classificacaoEnergetica?: string;
    peso?: { valor?: number };
  };
  metadata?: { sources?: string[] };
}

export class SourceRegistry {
  readonly pbevIndex = new Map<string, InmetroMatchable[]>();
  readonly staticById = new Map<string, StaticSpecRecord>();
  readonly manufacturers = new Map<string, ManufacturerRecord>();
  readonly safetyByKey = new Map<string, SafetyRecord>();
  readonly recallsByMarca = new Map<string, RecallRecord[]>();
  readonly warrantyByMarca = new Map<string, WarrantyRecord>();
  readonly marketById = new Map<string, MarketRecord>();
  readonly historyById = new Map<string, { historico: HistoricoPonto[]; metricas: HistoricoMetricas | null }>();

  loadPbev(file = PATHS.normalizedInmetroRecords): number {
    if (!fs.existsSync(file)) return 0;
    const rows = JSON.parse(fs.readFileSync(file, 'utf-8')) as NormalizedInmetroRow[];
    this.pbevIndex.clear();
    const idx = buildInmetroMatchIndex(rows);
    for (const [k, v] of idx) this.pbevIndex.set(k, v);
    return rows.length;
  }

  loadStaticSpecs(file = PATHS.staticSpecsCatalog): number {
    this.staticById.clear();
    if (!fs.existsSync(file)) return 0;
    const catalog = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, StaticSpecRecord>;
    for (const [id, rec] of Object.entries(catalog)) this.staticById.set(id, rec);
    return this.staticById.size;
  }

  loadManufacturers(dir = PATHS.rawManufacturers): number {
    if (!fs.existsSync(dir)) return 0;
    let n = 0;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'crawl-log.json')) {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      const rows = Array.isArray(parsed) ? parsed : [];
      for (const r of rows as ManufacturerRecord[]) {
        const key = manufacturerMatchKey(r.marca, r.modelo, r.ano ?? 0);
        this.manufacturers.set(key, r);
        n++;
      }
    }
    return n;
  }

  loadSafety(file = PATHS.normalizedSafety): number {
    this.safetyByKey.clear();
    if (!fs.existsSync(file)) return 0;
    const rows = JSON.parse(fs.readFileSync(file, 'utf-8')) as SafetyRecord[];
    for (const r of rows) {
      this.safetyByKey.set(manufacturerMatchKey(r.marca, r.modelo, r.ano ?? 0), r);
    }
    return rows.length;
  }

  loadRecalls(file = PATHS.normalizedRecalls): number {
    this.recallsByMarca.clear();
    if (!fs.existsSync(file)) return 0;
    const rows = JSON.parse(fs.readFileSync(file, 'utf-8')) as RecallRecord[];
    for (const r of rows) {
      const mk = r.marca.toUpperCase();
      const list = this.recallsByMarca.get(mk) ?? [];
      list.push(r);
      this.recallsByMarca.set(mk, list);
    }
    return rows.length;
  }

  loadWarranty(file = PATHS.normalizedWarranty): number {
    this.warrantyByMarca.clear();
    if (!fs.existsSync(file)) return 0;
    const rows = JSON.parse(fs.readFileSync(file, 'utf-8')) as WarrantyRecord[];
    for (const r of rows) {
      this.warrantyByMarca.set(r.marca.toUpperCase(), r);
      const slug = marcaSlug(r.marca);
      if (slug === 'chevrolet') this.warrantyByMarca.set('GM - Chevrolet'.toUpperCase(), r);
      if (slug === 'volkswagen') this.warrantyByMarca.set('VW - VolksWagen'.toUpperCase(), r);
    }
    return rows.length;
  }

  loadMarketplace(dir = PATHS.rawMarketplace): number {
    const file = path.join(dir, 'listings-summary.json');
    if (!fs.existsSync(file)) return 0;
    const rows = JSON.parse(fs.readFileSync(file, 'utf-8')) as MarketRecord[];
    for (const r of rows) {
      if (r.vehicleId) this.marketById.set(r.vehicleId, r);
    }
    return this.marketById.size;
  }

  loadHistory(historyRoot = PATHS.historyRoot, limit = 0): number {
    if (!fs.existsSync(historyRoot)) return 0;
    const files = fs.readdirSync(historyRoot).filter((f) => f.endsWith('.json'));
    const slice = limit > 0 ? files.slice(0, limit) : files;
    for (const f of slice) {
      const raw = JSON.parse(fs.readFileSync(path.join(historyRoot, f), 'utf-8')) as {
        id: string;
        historico?: HistoricoPonto[];
        metricas?: HistoricoMetricas;
      };
      this.historyById.set(raw.id, {
        historico: raw.historico ?? [],
        metricas: raw.metricas ?? null,
      });
    }
    return this.historyById.size;
  }

  matchInmetro(marca: string, modelo: string): InmetroData | null {
    const hit = matchInmetroForVehicleWithMeta(marca, modelo, this.pbevIndex) as {
      record: NormalizedInmetroRow;
      meta: { matchKey: string; tier: 'exact' | 'trim' | 'family_prefix'; confidence: number; matchedBy: string };
    } | null;
    if (!hit) return null;
    const p = hit.record;
    return {
      consumoCidade: p.consumoCidade ?? null,
      consumoEstrada: p.consumoEstrada ?? null,
      consumoCidadeEtanol: p.consumoCidadeEtanol ?? null,
      consumoEstradaEtanol: p.consumoEstradaEtanol ?? null,
      potenciaCv: null,
      cilindradaCc: null,
      classificacaoEnergetica: p.classificacaoEnergetica ?? null,
      fonte: 'inmetro-pbev',
      matchKey: hit.meta.matchKey,
      edicaoId: p.edicaoId,
      anoReferencia: p.anoReferencia,
      matchTier: hit.meta.tier,
      confidence: hit.meta.confidence,
      matchedBy: hit.meta.matchedBy,
    };
  }

  matchStaticSpecs(vehicleId: string): { inmetro: InmetroData | null; specs: SpecsData | null } {
    const s = this.staticById.get(vehicleId);
    if (!s?.specs) return { inmetro: null, specs: null };

    const c = s.specs.consumo;
    const inmetro: InmetroData | null = c
      ? {
          consumoCidade: c.cidadeG ?? null,
          consumoEstrada: c.estradaG ?? null,
          consumoCidadeEtanol: c.cidadeE ?? null,
          consumoEstradaEtanol: c.estradaE ?? null,
          potenciaCv: s.specs.potencia?.valor ?? null,
          cilindradaCc: s.specs.cilindrada?.valor ?? null,
          classificacaoEnergetica: s.specs.classificacaoEnergetica ?? null,
          fonte: 'inmetro-pbev',
        }
      : null;

    const specs: SpecsData | null =
      s.specs.potencia?.valor || s.specs.cilindrada?.valor || s.specs.cambio || s.specs.peso?.valor
        ? {
            potenciaCv: s.specs.potencia?.valor ?? null,
            torqueNm: s.specs.torque?.valor ?? null,
            cilindradaCc: s.specs.cilindrada?.valor ?? null,
            cambio: s.specs.cambio ?? null,
            pesoKg: s.specs.peso?.valor ?? null,
            comprimentoMm: null,
            larguraMm: null,
            alturaMm: null,
            portaMalasL: null,
            tanqueL: null,
            aceleracao0a100: null,
            velocidadeMaxKmh: null,
            fonte: s.metadata?.sources?.includes('FABRICANTE') ? 'manufacturer' : 'static-catalog',
          }
        : null;

    return { inmetro, specs };
  }

  matchManufacturer(marca: string, modelo: string, ano: number): SpecsData | null {
    const m = this.manufacturers.get(manufacturerMatchKey(marca, modelo, ano));
    if (!m) return null;
    return {
      potenciaCv: m.potenciaCv ?? null,
      torqueNm: m.torqueNm ?? null,
      cilindradaCc: m.cilindradaCc ?? null,
      cambio: m.cambio ?? null,
      pesoKg: m.pesoKg ?? null,
      comprimentoMm: m.comprimentoMm ?? null,
      larguraMm: m.larguraMm ?? null,
      alturaMm: m.alturaMm ?? null,
      portaMalasL: m.portaMalasL ?? null,
      tanqueL: m.tanqueL ?? null,
      aceleracao0a100: m.aceleracao0a100 ?? null,
      velocidadeMaxKmh: m.velocidadeMaxKmh ?? null,
      fonte: m.fonte ?? 'manufacturer',
    };
  }

  matchSafety(marca: string, modelo: string, ano: number): SafetyData | null {
    const key = manufacturerMatchKey(marca, modelo, ano);
    let s = this.safetyByKey.get(key);
    if (!s) {
      const modeloTok = modelo.toLowerCase().split(/\s+/)[0];
      for (const [k, v] of this.safetyByKey) {
        if (k.startsWith(marcaSlug(marca)) && k.toLowerCase().includes(modeloTok)) {
          s = v;
          break;
        }
      }
    }
    if (!s || (s.notaGeral == null && s.protecaoAdultos == null)) return null;
    return {
      notaGeral: s.notaGeral ?? null,
      protecaoAdultos: s.protecaoAdultos ?? null,
      protecaoInfantis: s.protecaoInfantis ?? null,
      dataTeste: s.dataTeste ?? null,
      fonte: 'latin-ncap',
    };
  }

  matchRecalls(marca: string, modelo: string, ano: number): RecallData | null {
    const list = this.recallsByMarca.get(marca.toUpperCase()) ?? [];
    const hits = list.filter((r) => {
      const modeloNorm = modelo.toLowerCase();
      const matchModel = modeloNorm.includes(r.modelo.toLowerCase()) || r.modelo.toLowerCase().includes(modeloNorm.split(' ')[0]);
      const inRange = (!r.anoInicio || ano >= r.anoInicio) && (!r.anoFim || ano <= r.anoFim);
      return matchModel && inRange;
    });
    if (!hits.length) return null;
    const ativos = hits.filter((h) => h.status === 'ativo').length;
    return {
      ativos,
      encerrados: hits.length - ativos,
      total: hits.length,
      campanhas: hits.map((h) => ({ id: h.id, titulo: h.titulo, status: h.status, data: h.data })),
      fonte: 'senatran',
    };
  }

  matchWarranty(marca: string): WarrantyData | null {
    const w =
      this.warrantyByMarca.get(marca.toUpperCase()) ??
      this.warrantyByMarca.get(marcaSlug(marca).toUpperCase());
    if (!w) return null;
    return {
      garantiaTotalAnos: w.garantiaTotalAnos ?? null,
      garantiaAnticorrosaoAnos: w.garantiaAnticorrosaoAnos ?? null,
      garantiaMotorAnos: w.garantiaMotorAnos ?? null,
      fonte: w.fonte ?? 'fabricante',
    };
  }

  matchMarket(vehicleId: string): MarketData | null {
    const m = this.marketById.get(vehicleId);
    if (!m) return null;
    return {
      precoMedioAnuncio: m.precoMedio ?? null,
      totalAnuncios: m.totalAnuncios ?? null,
      fonte: m.fonte ?? 'marketplace',
    };
  }

  getHistory(vehicleId: string): { historico: HistoricoPonto[]; metricas: HistoricoMetricas | null } {
    return this.historyById.get(vehicleId) ?? { historico: [], metricas: null };
  }
}
