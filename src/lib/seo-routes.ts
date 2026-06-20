export function marcaPath(marcaSlug: string): string {
  return `/marca/${marcaSlug}`;
}

export function modeloPath(marcaSlug: string, modeloSlug: string): string {
  return `/modelo/${marcaSlug}/${modeloSlug}`;
}

export function historicoPath(marcaSlug: string, modeloSlug: string): string {
  return `/historico/${marcaSlug}/${modeloSlug}`;
}

export function compararPath(slug: string): string {
  return slug ? `/comparar/${slug}` : '/comparar';
}

export function anoPath(ano: number | string): string {
  return `/ano/${ano}`;
}

export function modeloDataFile(marcaSlug: string, modeloSlug: string): string {
  return `/data/seo/modelos/${marcaSlug}-${modeloSlug}.json`;
}

export type SemanticIntentSlug =
  | 'preco'
  | 'fipe-atualizada'
  | 'vale-a-pena'
  | 'comparativo'
  | 'consumo'
  | 'manutencao'
  | 'problemas'
  | 'seguro';

function anoSlug(ano: number): string {
  return ano === 0 ? 'zero-km' : String(ano);
}

export function intentPath(
  marcaSlug: string,
  modeloSlug: string,
  ano: number,
  intent: SemanticIntentSlug,
): string {
  return `/${marcaSlug}/${modeloSlug}-${anoSlug(ano)}-${intent}`;
}

export function decisaoValeAPenaPath(marcaSlug: string, modeloSlug: string, ano: number): string {
  return `/vale-a-pena-comprar-${marcaSlug}-${modeloSlug}-${anoSlug(ano)}`;
}

export function decisaoMelhoresPath(segmento: string, ano: number): string {
  return `/melhores-${segmento}-${ano}`;
}

export function decisaoOuPath(modeloSlugA: string, modeloSlugB: string): string {
  const [a, b] = [modeloSlugA, modeloSlugB].sort();
  return `/${a}-ou-${b}`;
}

export type MarcaClusterSlug =
  | 'confiabilidade'
  | 'mais-vendidos'
  | 'problematicos'
  | 'manutencao'
  | 'comparacao';

export function clusterPath(marcaSlug: string, cluster: MarcaClusterSlug): string {
  return `/marca/${marcaSlug}/${cluster}`;
}
export function decisaoPath(slug: string): string {
  return slug.startsWith('/') ? slug : `/${slug}`;
}
