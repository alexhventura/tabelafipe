/**
 * Valida regras de similaridade para concorrentes.
 * Uso: npx tsx scripts/validate-similarity.ts
 */
import {
  inferComparableBodyType,
  similarityScore,
  type SimilarityVehicleInput,
} from '../src/lib/vehicleSimilarity.ts';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const hatch: SimilarityVehicleInput = {
  tipo: 'carros',
  modelo: 'Onix Hatch 1.0 5p',
  marca: 'Chevrolet',
  ano: 2022,
  valorAtual: 65000,
};

const sedan: SimilarityVehicleInput = {
  tipo: 'carros',
  modelo: 'Corolla Sedan 2.0 4p',
  marca: 'Toyota',
  ano: 2022,
  valorAtual: 140000,
};

const pickup: SimilarityVehicleInput = {
  tipo: 'carros',
  modelo: 'Hilux CD 4x4',
  marca: 'Toyota',
  ano: 2022,
  valorAtual: 250000,
};

const suv: SimilarityVehicleInput = {
  tipo: 'carros',
  modelo: 'Creta 1.0 TGDI',
  marca: 'Hyundai',
  ano: 2022,
  valorAtual: 120000,
};

const hatchSimilar: SimilarityVehicleInput = {
  tipo: 'carros',
  modelo: 'Polo Track 1.0 5p',
  marca: 'Volkswagen',
  ano: 2023,
  valorAtual: 70000,
};

console.log('=== Validacao Similaridade ===');

assert(inferComparableBodyType('carros', hatch.modelo) === 'hatch', 'Onix deve ser hatch');
assert(inferComparableBodyType('carros', sedan.modelo) === 'sedan', 'Corolla sedan');
assert(inferComparableBodyType('carros', pickup.modelo) === 'pickup', 'Hilux pickup');
assert(inferComparableBodyType('carros', suv.modelo) === 'suv', 'Creta suv');

assert(similarityScore(hatch, sedan) === 0, 'hatch vs sedan = 0');
assert(similarityScore(hatch, pickup) === 0, 'hatch vs pickup = 0');
assert(similarityScore(hatch, suv) === 0, 'hatch vs suv = 0');

const hatchVsHatch = similarityScore(hatch, hatchSimilar);
assert(hatchVsHatch >= 50, `hatch vs hatch deve pontuar (obteve ${hatchVsHatch})`);

const sameBrandHatch: SimilarityVehicleInput = {
  ...hatchSimilar,
  marca: 'Chevrolet',
  modelo: 'Onix Plus 1.0 5p',
  valorAtual: 66000,
};
assert(
  similarityScore(hatch, sameBrandHatch) > hatchVsHatch,
  'mesma marca deve aumentar score',
);

console.log('OK — regras de tipo e score validadas');
