/**
 * Normaliza registros PBEV extraidos para data/normalized/inmetro/
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../../lib/fipe-paths.js';
import { inmetroMatchKey, normalizeVersao } from '../../lib/enrichment/matching-engine.js';
import { marcaSlug, combustivelSlug } from '../../lib/fipe-slug.js';

interface PbevRawRecord {
  edicaoId: string;
  anoReferencia: number;
  categoria: string | null;
  marca: string;
  modelo: string;
  versao: string;
  combustivel: string | null;
  consumoCidadeGasolina: number | null;
  consumoEstradaGasolina: number | null;
  consumoCidadeEtanol: number | null;
  consumoEstradaEtanol: number | null;
  classificacaoPbe: string | null;
  eficienciaMjKm: number | null;
}

export interface NormalizedInmetroRecord {
  id: string;
  matchKey: string;
  marca: string;
  marcaSlug: string;
  modelo: string;
  versao: string;
  versaoNormalizada: string;
  anoReferencia: number;
  combustivel: string | null;
  combustivelSlug: string | null;
  categoria: string | null;
  consumoCidade: number | null;
  consumoEstrada: number | null;
  consumoCidadeEtanol: number | null;
  consumoEstradaEtanol: number | null;
  classificacaoEnergetica: string | null;
  eficienciaMjKm: number | null;
  fonte: 'inmetro-pbev';
  edicaoId: string;
  confiabilidade: 'alta';
}

function normalizeRecord(raw: PbevRawRecord): NormalizedInmetroRecord {
  const modeloCompleto = `${raw.modelo} ${raw.versao}`.trim();
  const matchKey = inmetroMatchKey(raw.marca, modeloCompleto);
  return {
    id: `${marcaSlug(raw.marca)}-${normalizeVersao(modeloCompleto).replace(/\s+/g, '-')}-${raw.edicaoId}`,
    matchKey,
    marca: raw.marca,
    marcaSlug: marcaSlug(raw.marca),
    modelo: raw.modelo,
    versao: raw.versao,
    versaoNormalizada: normalizeVersao(modeloCompleto),
    anoReferencia: raw.anoReferencia,
    combustivel: raw.combustivel,
    combustivelSlug: raw.combustivel ? combustivelSlug(raw.combustivel) : null,
    categoria: raw.categoria,
    consumoCidade: raw.consumoCidadeGasolina,
    consumoEstrada: raw.consumoEstradaGasolina,
    consumoCidadeEtanol: raw.consumoCidadeEtanol,
    consumoEstradaEtanol: raw.consumoEstradaEtanol,
    classificacaoEnergetica: raw.classificacaoPbe,
    eficienciaMjKm: raw.eficienciaMjKm,
    fonte: 'inmetro-pbev',
    edicaoId: raw.edicaoId,
    confiabilidade: 'alta',
  };
}

async function main() {
  const input = path.join(PATHS.rawInmetro, 'pbev-extracted.json');
  if (!fs.existsSync(input)) {
    console.error('Execute extract primeiro:', input);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(input, 'utf-8')) as PbevRawRecord[];
  const byKey = new Map<string, NormalizedInmetroRecord>();
  for (const r of raw) {
    const n = normalizeRecord(r);
    if (!byKey.has(n.matchKey) || (n.anoReferencia ?? 0) > (byKey.get(n.matchKey)?.anoReferencia ?? 0)) {
      byKey.set(n.matchKey, n);
    }
  }
  const records = [...byKey.values()];

  fs.mkdirSync(PATHS.normalizedInmetro, { recursive: true });
  fs.writeFileSync(PATHS.normalizedInmetroRecords, JSON.stringify(records, null, 2));
  fs.writeFileSync(path.join(PATHS.rawInmetro, 'pbev-latest.json'), JSON.stringify(records.map((r) => ({
    marca: r.marca,
    modelo: `${r.modelo} ${r.versao}`.trim(),
    consumoCidade: r.consumoCidade,
    consumoEstrada: r.consumoEstrada,
    classificacao: r.classificacaoEnergetica,
    potenciaCv: null,
    cilindradaCc: null,
  })), null, 2));

  const report = {
    geradoEm: new Date().toISOString(),
    totalRegistros: records.length,
    marcasUnicas: new Set(records.map((r) => r.marca)).size,
    comConsumoCidade: records.filter((r) => r.consumoCidade != null).length,
    comConsumoEstrada: records.filter((r) => r.consumoEstrada != null).length,
    comClassificacao: records.filter((r) => r.classificacaoEnergetica).length,
    porMarca: Object.fromEntries(
      [...records.reduce((m, r) => m.set(r.marca, (m.get(r.marca) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 30),
    ),
  };

  fs.writeFileSync(PATHS.normalizedInmetroManifest, JSON.stringify(report, null, 2));
  fs.writeFileSync(PATHS.inmetroCoverageReport, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });