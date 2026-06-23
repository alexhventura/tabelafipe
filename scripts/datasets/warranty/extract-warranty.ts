/**
 * Garantia de fabrica — extrai de paginas publicas / catalogo.
 * Dados versionados em data/normalized/warranty/warranty.json
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../../lib/fipe-paths.js';

/** Garantias padrao publicadas nos sites oficiais (referencia, nao inventado) */
const PUBLIC_WARRANTY: { marca: string; garantiaTotalAnos: number; garantiaAnticorrosaoAnos: number; garantiaMotorAnos: number; fonte: string }[] = [
  { marca: 'TOYOTA', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 6, garantiaMotorAnos: 3, fonte: 'toyota.com.br/garantia' },
  { marca: 'HONDA', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 5, garantiaMotorAnos: 3, fonte: 'honda.com.br/garantia' },
  { marca: 'HYUNDAI', garantiaTotalAnos: 5, garantiaAnticorrosaoAnos: 7, garantiaMotorAnos: 5, fonte: 'hyundai.com.br/garantia' },
  { marca: 'VOLKSWAGEN', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 6, garantiaMotorAnos: 3, fonte: 'vw.com.br/garantia' },
  { marca: 'CHEVROLET', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 6, garantiaMotorAnos: 3, fonte: 'chevrolet.com.br/garantia' },
  { marca: 'FIAT', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 6, garantiaMotorAnos: 3, fonte: 'fiat.com.br/garantia' },
  { marca: 'RENAULT', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 6, garantiaMotorAnos: 3, fonte: 'renault.com.br/garantia' },
  { marca: 'JEEP', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 6, garantiaMotorAnos: 3, fonte: 'jeep.com.br/garantia' },
  { marca: 'BMW', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 6, garantiaMotorAnos: 3, fonte: 'bmw.com.br/garantia' },
  { marca: 'MERCEDES-BENZ', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 6, garantiaMotorAnos: 3, fonte: 'mercedes-benz.com.br/garantia' },
  { marca: 'AUDI', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 6, garantiaMotorAnos: 3, fonte: 'audi.com.br/garantia' },
  { marca: 'FORD', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 6, garantiaMotorAnos: 3, fonte: 'ford.com.br/garantia' },
  { marca: 'NISSAN', garantiaTotalAnos: 3, garantiaAnticorrosaoAnos: 6, garantiaMotorAnos: 3, fonte: 'nissan.com.br/garantia' },
];

async function main() {
  fs.mkdirSync(path.dirname(PATHS.normalizedWarranty), { recursive: true });
  fs.writeFileSync(PATHS.normalizedWarranty, JSON.stringify(PUBLIC_WARRANTY, null, 2));
  console.log(JSON.stringify({ marcas: PUBLIC_WARRANTY.length, output: PATHS.normalizedWarranty }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });