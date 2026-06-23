import fs from 'fs';
import { PATHS } from '../lib/fipe-paths.js';
import { normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';

function norm(s: string) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }

async function main() {
  const file = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  const vehicles = JSON.parse(fs.readFileSync(file, 'utf-8')).map((v: NormalizedVehicle) => (v.vehicleId ? v : normalizeVehicle(v)));
  const staticCat = fs.existsSync(PATHS.staticSpecsCatalog) ? JSON.parse(fs.readFileSync(PATHS.staticSpecsCatalog, 'utf-8')) : {};
  const items = vehicles.map(v => {
    const s = staticCat[v.vehicleId]?.specs;
    const nome = v.marca + ' ' + v.modelo + ' (' + v.ano + ')';
    return { id: v.vehicleId, vehicleUid: v.vehicleUid, slug: v.slug, nome, marca: v.marca, modelo: v.modelo, ano: v.ano, combustivel: v.combustivel, tipo: v.tipo, valor: v.valor, searchText: norm(nome + ' ' + v.combustivel), resumoTecnico: [s?.cilindrada?.valor && s.cilindrada.valor + ' cc', s?.potencia?.valor && s.potencia.valor + ' cv', s?.cambio, v.combustivel].filter(Boolean).join(' · ') };
  });
  fs.mkdirSync(PATHS.indexesRoot, { recursive: true });
  fs.writeFileSync(PATHS.vehicleSearchIndex, JSON.stringify({ geradoEm: new Date().toISOString(), total: items.length, veiculos: items }));
  console.log(JSON.stringify({ total: items.length, output: PATHS.vehicleSearchIndex }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });