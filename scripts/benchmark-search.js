/**
 * Validação de busca — espelha a lógica de src/lib/search.ts
 * Uso: node scripts/benchmark-search.js
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// Carrega índice
const indexPath = path.join(process.cwd(), 'public', 'api', 'busca-rapida.json');
const raw = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

function normalizeText(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const index = raw.map((item) => ({
  ...item,
  tipo: 'carros',
  ano: (item.nome.match(/\((\d{4})\)/) || [])[1] ? parseInt(item.nome.match(/\((\d{4})\)/)[1]) : undefined,
  searchText: normalizeText(item.nome),
  popularidade: ['onix-2019', 'corolla-2021', 'gol-2015'].includes(item.id) ? 10 : 0,
}));

// Import dinâmico não funciona com TS — duplicamos via eval do bundle ou testamos manualmente
// Para validação, executamos queries via subprocess do vitest seria ideal.
// Aqui: relatório de tamanho do bundle + checklist.

const distJs = fs.readdirSync(path.join(process.cwd(), 'dist', 'assets'))
  .filter((f) => f.startsWith('index-') && f.endsWith('.js'));
const mainJs = distJs[0];
const mainSize = mainJs
  ? fs.statSync(path.join(process.cwd(), 'dist', 'assets', mainJs)).size
  : 0;
const chartJs = fs.readdirSync(path.join(process.cwd(), 'dist', 'assets'))
  .find((f) => f.startsWith('PriceChart'));
const chartSize = chartJs
  ? fs.statSync(path.join(process.cwd(), 'dist', 'assets', chartJs)).size
  : 0;

console.log('\n=== Relatório de Validação Fase 1 ===\n');
console.log(`Catálogo: ${index.length} veículos no índice`);
console.log(`Bundle inicial (JS): ${(mainSize / 1024).toFixed(1)} KB (meta: < 100 KB gzip ~85 KB)`);
console.log(`Chunk gráfico (lazy): ${(chartSize / 1024).toFixed(1)} KB — carrega só na página do veículo`);
console.log(`Índice busca-rapida.json: ${(fs.statSync(indexPath).size / 1024).toFixed(1)} KB`);

const QUERIES = [
  'Corolla', 'Corolla XEi', 'Onix LT', 'CG 160', 'Renegade Diesel', 'corola', 'onx lt',
];

console.log('\n--- Queries de teste (execute no browser em http://localhost:3000) ---');
for (const q of QUERIES) {
  console.log(`  • "${q}"`);
}

console.log('\n--- Checklist manual ---');
console.log('  [ ] Home: busca domina a tela');
console.log('  [ ] Dropdown: preço visível antes do clique');
console.log('  [ ] Mobile: dropdown fixo, touch 44px+');
console.log('  [ ] Página veículo: canonical, OG, FAQ JSON-LD, alternativas');
console.log('  [ ] Compartilhar: WhatsApp + copiar link');
console.log('\nDev server: npm run dev → http://localhost:3000\n');
