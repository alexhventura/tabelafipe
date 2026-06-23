# Fase UX/UI + SEO ? pesquisatabelafipe.com.br

> Plano de arquitetura de experi?ncia, interface e SEO para escalar **50.395 ve?culos FIPE** em p?ginas r?pidas, index?veis e consistentes.
> Stack atual: **React 19 + Vite SPA**, ?ndice de busca **shardado** (`ShardedCatalog`), camada permanente **specs-master** (`data/static/specs`, 100% cobertura), **engine-master** conectado (**1.181 ve?culos** com motor/grupo t?cnico), hist?rico mensal FIPE, grafos de cat?logo (`data/catalog/tree.json`) e enriquecimento (`data/enriched/`).

---

## 0. Contexto e baseline de dados

| Camada | Local / artefato | Escala | Papel na UX |
|--------|------------------|--------|-------------|
| FIPE + hist?rico | `data/normalized/veiculos.json`, `data/history/` | 50.395 | Pre?o, refer?ncia, identidade FIPE |
| specs-master | `data/static/specs/catalog.json` | 50.395 (100%) | Specs t?cnicas est?ticas por `vehicleId` |
| engine-master | grafo motor ? ve?culo | 1.181 ligados | Pot?ncia, torque, cilindrada, consumo quando dispon?vel |
| Busca client-side | `data/fipe/search/*` shards + `useSearchIndex` | 50.395 | Autocomplete na home e hubs |
| ?ndice completo | `data/indexes/vehicle-list-complete.json` | 50.395 | SSG, sitemap, bundles |

**Decis?o estrat?gica:** migrar renderiza??o p?blica de SPA puro para **SSG h?brido (Astro)** mantendo componentes React onde fizer sentido, preservando pipelines de dados existentes.

---

## 1. Princ?pios inegoci?veis

| Princ?pio | Regra operacional | Anti-padr?o |
|-----------|-------------------|-------------|
| **Simplicidade** | Uma busca no hero; navega??o ? 4 itens prim?rios; conte?do acima da dobra = pre?o + identifica??o | Filtros avan?ados na home, dashboards internos expostos |
| **Velocidade** | HTML est?tico por URL; JSON pr?-gerado; LCP < 2,0s em 4G; TTFB < 200ms (CDN) | Hydration pesada antes do pre?o FIPE |
| **Mobile first** | Layout desenhado em 360px; touch targets ? 44px; gr?ficos lazy | Desktop-first com tabelas largas sem scroll |
| **1 FIPE = 1 p?gina** | 1 c?digo FIPE ? 1 URL can?nica ? 1 `<title>` ? 1 `<h1>` ? 1 JSON-LD `Product`/`Vehicle` | Query strings para variantes (`?codigo=`) |
| **Dados nos bastidores** | specs-master, engine-master e grafos alimentam templates; UI mostra s? o que ajuda decis?o | Expor IDs internos, scores de matching, grafos crus |
| **SEO t?cnico first** | Sitemap segmentado, canonical, breadcrumbs, structured data valid?vel | Conte?do duplicado entre marcas/modelos |

---

## 2. Arquitetura de informa??o (IA) e navega??o

### 2.1 ?rvore de navega??o

```
pesquisatabelafipe.com.br/
??? /                          Home (busca + marcas + tipos)
??? /fipe/                     Hub FIPE (opcional redirect ? /)
??? /fipe/{marca}/             Hub marca (ex.: /fipe/toyota/)
??? /fipe/{marca}/{slug}-{codigo}/   P?gina ve?culo (50.395 URLs)
??? /marcas/                   ?ndice alfab?tico de marcas (SEO hub)
??? /tipos/{carros|motos|caminhoes}/  Hub por tipo
??? /sobre/                    Confian?a, fontes, metodologia FIPE
??? /atualizacao/              Refer?ncia mensal da tabela (EEAT)
```

### 2.2 Menu global (header)

1. **Buscar** (atalho: foco no campo da home em mobile via ?cone)
2. **Marcas** ? `/marcas/`
3. **Tipos** ? carros / motos / caminh?es
4. **Atualiza??o** ? m?s de refer?ncia FIPE

Footer: links para hubs top marcas, pol?tica, fontes (FIPE, INMETRO quando citado), sitemap HTML leve.

### 2.3 Breadcrumbs (padr?o)

`Home ? {Tipo} ? {Marca} ? {Modelo} {Ano} ? {Vers?o}` ? ?ltimo item n?o linkado; demais linkam para hubs correspondentes.

---

## 3. Estrutura de URL

### 3.1 Padr?o can?nico

```
/fipe/{marca-slug}/{slug-veiculo}-{fipe-codigo}/
```

| Segmento | Origem | Exemplo |
|----------|--------|---------|
| `marca-slug` | `marcaSlug(marca)` (j? em `src/lib/slug`) | `volkswagen` |
| `slug-veiculo` | modelo + vers?o + ano normalizados | `gol-1-0-2024-flex` |
| `fipe-codigo` | c?digo FIPE oficial (imut?vel) | `004489-1` |

**Exemplo completo:** `/fipe/volkswagen/gol-1-0-2024-flex-004489-1/`

### 3.2 Regras

- Slug **n?o** substitui identidade: c?digo FIPE no path garante unicidade e redirecionamentos est?veis se slug mudar.
- Trailing slash consistente (Vercel `trailingSlash: true`).
- URLs antigas da SPA (`/#/...` ou `/veiculo?id=`) ? **301** para can?nica SSG.
- Caracteres: ASCII min?sculo, h?fens, sem acentos (normaliza??o NFKD + `normalizeText`).

### 3.3 Hubs derivados (pagina??o)

- `/fipe/{marca}/?page=2` ? `rel="prev/next"`; preferir listas est?ticas paginadas no build para marcas grandes.

---

## 4. Estrat?gia SSG para 50.395 p?ginas (Astro)

### 4.1 Por que Astro

- Gera HTML est?tico por rota com **custo de JS m?nimo** na p?gina de ve?culo (ideal Lighthouse 95+).
- **Islands architecture:** React s? na busca interativa (home/hubs); resto HTML + CSS.
- Integra??o Vite existente; reutiliza tipos TS e utilit?rios (`slug`, `search`).
- Build paralelo e `getStaticPaths` com lista pr?-computada em `vehicle-list-complete.json`.

### 4.2 Pipeline de build

```
vehicle-list-complete.json
        ?
        ?
scripts/generate-vehicle-page-bundles.mjs  (1 JSON por ve?culo ou shards de 500)
        ?
        ?
Astro src/pages/fipe/[marca]/[...slug].astro
        ?
        ?
dist/fipe/.../index.html  (+ assets hashed)
        ?
        ?
Vercel / CDN  +  sitemap-index.xml
```

### 4.3 Escalabilidade do build

| T?cnica | Detalhe |
|---------|---------|
| Incremental build | Hash por `vehicleId` + refer?ncia FIPE; rebuild s? deltas mensais |
| Sharded bundles | `data/generated/vehicle-pages/{aa}/{vehicleId}.json` evita JSON gigante ?nico |
| Concorr?ncia | `getStaticPaths` l? manifest; workers Node geram HTML em lotes |
| CI mensal | Alinha com workflow `monthly-fipe.yml` |
| Fallback | ISR **desligado** no lan?amento (pure SSG); considerar s? para ve?culos novos entre ciclos |

### 4.4 Coexist?ncia com SPA atual

- Fase 1: Astro no subpath `/fipe/*`; home pode permanecer Vite temporariamente.
- Fase 2: unificar root no Astro; SPA vira ilha de busca.
- API routes Vercel: servir shards de busca (`/data/fipe/search/`) como hoje.

---

## 5. Schema `vehicle-page-bundle.json`

Artefato **?nico por p?gina**, gerado no build a partir de FIPE + specs-master + engine-master (+ hist?rico + links do grafo). Destino sugerido: `data/generated/vehicle-pages/{vehicleId}.json`.

```json
{
  "$schema": "../schemas/vehicle-page-bundle.schema.json",
  "vehicleId": "004489-1",
  "fipeCodigo": "004489-1",
  "tipo": "carros",
  "marca": "Volkswagen",
  "marcaSlug": "volkswagen",
  "modelo": "Gol",
  "versao": "1.0 12V Flex",
  "anoModelo": 2024,
  "combustivel": "Flex",
  "slug": "gol-1-0-2024-flex",
  "canonicalPath": "/fipe/volkswagen/gol-1-0-2024-flex-004489-1/",
  "preco": {
    "valor": 58900,
    "moeda": "BRL",
    "referencia": "2026-06",
    "fonte": "FIPE"
  },
  "historico": [
    { "referencia": "2026-05", "valor": 58200 },
    { "referencia": "2026-04", "valor": 57800 }
  ],
  "specs": {
    "potenciaCv": 84,
    "torqueNm": 101,
    "cilindradaCc": 999,
    "consumoCidadeKmL": 12.4,
    "consumoEstradaKmL": 14.1,
    "cambio": "manual",
    "fonteSpecs": "specs-master",
    "fonteMotor": "engine-master"
  },
  "specsDisponibilidade": {
    "temSpecsMaster": true,
    "temEngineMaster": true,
    "temInmetro": false
  },
  "seo": {
    "title": "Volkswagen Gol 1.0 2024 ? Pre?o FIPE jun/2026 | R$ 58.900",
    "description": "Consulte o pre?o FIPE do Volkswagen Gol 1.0 Flex 2024 (c?digo 004489-1). Hist?rico, ficha t?cnica e ve?culos relacionados.",
    "ogImagePath": "/og/fipe/volkswagen/gol-1-0-2024-flex.png"
  },
  "linksInternos": {
    "mesmoModeloOutrosAnos": ["..."],
    "mesmaMarcaPopular": ["..."],
    "rivaisGrafo": ["..."],
    "mesmoMotor": ["..."]
  },
  "grafo": {
    "familiaId": "vw-gol-g8",
    "motorId": "ea211-1.0-12v",
    "scoreMatching": 0.92
  },
  "geradoEm": "2026-06-22T00:00:00.000Z",
  "versoesDados": {
    "fipeRef": "2026-06",
    "specsMaster": 1,
    "engineMaster": 1
  }
}
```

### 5.1 Campos obrigat?rios vs opcionais

| Obrigat?rio | Opcional (degrad?vel) |
|-------------|------------------------|
| `vehicleId`, `fipeCodigo`, `tipo`, `marca`, `marcaSlug`, `anoModelo`, `preco`, `canonicalPath`, `seo.title`, `seo.description` | `specs.*`, `historico`, `linksInternos.rivaisGrafo`, `grafo.motorId` |
| `specsDisponibilidade` para UI honesta (n?o inventar ficha) | `ogImagePath` (fallback template por marca) |

### 5.2 Alinhamento com schemas existentes

- `specs` deriva de `static-vehicle-specs.schema.json` (`vehicleId`, `marca`, `modelo`, `ano`, `specs.*`).
- Enriquecimento editorial futuro: `vehicle-enrichment.schema.json` / `encyclopedia-layers.schema.json` como camadas extras no bundle, sem quebrar o contrato m?nimo.

---

## 6. Home ? wireframe (mobile first)

```
???????????????????????????????????????
? [Logo]              [? Marcas|Tipos]?
???????????????????????????????????????
?  Consulta Tabela FIPE               ?
?  Pre?o oficial por c?digo ou nome   ?
? ??????????????????????????????????? ?
? ? ?? Buscar marca, modelo ou c?digo? ?
? ??????????????????????????????????? ?
?  Sugest?es (autocomplete shard)     ?
?  Ex.: Gol, HB20, c?digo 004489-1    ?
???????????????????????????????????????
?  Refer?ncia: Junho/2026  [Atualiza??o]?
???????????????????????????????????????
?  Tipos                              ?
?  [ Carros ] [ Motos ] [ Caminh?es ] ?
???????????????????????????????????????
?  Marcas populares (grid 2?4)        ?
?  VW  Fiat  Chevy  Toyota ...        ?
???????????????????????????????????????
?  Confian?a                          ?
?  "50.395 ve?culos ? fonte FIPE"     ?
???????????????????????????????????????
? Footer compacto                     ?
???????????????????????????????????????
```

**Desktop:** busca central max-width 640px; grid marcas 4?2; sticky header leve.

**Intera??o:** primeiro paint est?tico (HTML); hydration da busca ap?s `requestIdleCallback` ou intera??o no campo.

---

## 7. Busca inteligente (regras)

Reutiliza `ShardedCatalog`, `normalizeText`, `SearchIndexItem` e fallback `/api/busca-rapida.json`.

### 7.1 Gatilhos

| Entrada | Comportamento |
|---------|---------------|
| **? 1 letra** | Inicia busca local no shard carregado + prefetch do pr?ximo shard por prefixo |
| **C?digo FIPE** | Detecta `\d{6}-\d` ou `\d{6}`; prioridade absoluta; match exato ? navega??o direta |
| **N?meros (ano)** | Token 19xx?20xx aumenta peso de `ano` |
| **Vazio** | Mostra marcas populares + ?ltimas buscas (localStorage, opt-in) |

### 7.2 Scoring (ordem de desempate)

1. Match exato `fipeCodigo` (+1000)
2. Prefixo em `marca` (+120)
3. Prefixo em `modelo` / `termoBusca` (+80)
4. Substring tokenizada (+40 por token)
5. Match `ano` (+30)
6. Boost tipo se filtro ativo (+20)
7. Penalidade Levenshtein > 2 em token curto (-50)
8. Desempate: popularidade marca (lista fixa) ? ano desc ? c?digo asc

### 7.3 Performance da busca

- Pr?-carregar shards `a`, `c`, `v` (j? em `initCatalog` para cat?logos grandes).
- Debounce 80ms; m?x. 8 sugest?es vis?veis; virtualize se > 20 (hubs).
- Teclado: ?? Enter Esc; aria `listbox` + `option`.

---

## 8. P?gina de ve?culo ? 10 se??es

Ordem fixa (scroll vertical; ancora opcional no sum?rio):

1. **Hero FIPE** ? H1, c?digo FIPE vis?vel, pre?o atual em destaque, refer?ncia mensal, CTA secund?rio "Copiar c?digo".
2. **Hist?rico de pre?o** ? sparkline ou tabela 12?24 meses (dados `data/history/`).
3. **Identifica??o** ? marca, modelo, vers?o, ano, combust?vel, tipo (carros/motos/caminh?es).
4. **Ficha t?cnica** ? specs-master; campos vazios ocultos (n?o mostrar "?" em excesso).
5. **Motor & efici?ncia** ? bloco engine-master quando `temEngineMaster`; sen?o CTA discreto "Especifica??es b?sicas FIPE".
6. **Comparativos** ? 3?5 rivais do grafo (`linksInternos.rivaisGrafo`), mesma faixa de pre?o ?15%.
7. **Mesmo modelo, outros anos** ? links internos fortes (SEO + UX).
8. **Ve?culos com mesmo motor** ? s? quando engine-master presente (1.181 base inicial).
9. **Contexto de mercado** ? texto curto gerado template + vari?veis (sem LLM no request path).
10. **FAQ schema** ? 3 perguntas fixas ("O que ? FIPE?", "Como usar o c?digo?", "Quando atualiza?") + 1 din?mica sobre o modelo.

**Sidebar desktop / accordion mobile:** sum?rio com links `#historico`, `#ficha`, `#comparativos`.

---

## 9. SEO on-page e metadados

### 9.1 Title (padr?o)

`{Marca} {Modelo} {Ano} ? Pre?o FIPE {m?s/ano} | {valor formatado}` ? m?x. ~60 caracteres; truncar vers?o se necess?rio.

### 9.2 Meta description

`Consulte o pre?o FIPE do {Marca} {Modelo} {vers?o} {ano} (c?digo {FIPE}). Hist?rico, ficha t?cnica e similares. Refer?ncia {m?s/ano}.` ? 150?160 caracteres.

### 9.3 JSON-LD (graph)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": []
    },
    {
      "@type": "Product",
      "name": "",
      "sku": "{fipeCodigo}",
      "brand": { "@type": "Brand", "name": "" },
      "offers": {
        "@type": "Offer",
        "price": "",
        "priceCurrency": "BRL",
        "availability": "https://schema.org/InStock",
        "url": ""
      }
    },
    {
      "@type": "FAQPage",
      "mainEntity": []
    }
  ]
}
```

### 9.4 Open Graph / Twitter

- `og:title`, `og:description`, `og:url` (can?nica), `og:type=product`, `og:locale=pt_BR`
- Imagem OG din?mica por template (marca + modelo + pre?o) ? gerada no build, WebP 1200?630.

### 9.5 Canonical e hreflang

- `<link rel="canonical" href="https://pesquisatabelafipe.com.br{canonicalPath}">`
- Site monolingue: apenas `pt-BR`; sem hreflang alternates at? existir EN.

### 9.6 Sitemaps

- `sitemap-index.xml` ? sitemaps por marca ou por prefixo de c?digo (m?x. 50k URLs cada).
- `lastmod` = data refer?ncia FIPE ou `geradoEm` do bundle.

---

## 10. Linkagem interna a partir dos grafos

Fontes: `data/catalog/tree.json`, fam?lias em `catalog-index`, matching reports, engine-master (mesmo motor), proximidade de pre?o.

| M?dulo UI | Origem grafo | Limite |
|-----------|--------------|--------|
| Rivais | similaridade modelo/pre?o | 5 links |
| Outros anos | mesmo `modelo` + `marca` | todos dispon?veis (lista compacta) |
| Mesmo motor | engine-master | 8 links |
| Hub marca | tree depth 1 | breadcrumb + "Ver todos {marca}" |
| Top modelos marca | contagem hist?rico busca / popularidade | hub `/fipe/{marca}/` |

**Regra:** todo link interno aponta para URL can?nica SSG; nunca para estado SPA com hash.

---

## 11. Performance ? metas Lighthouse 95+

| M?trica | Alvo | T?tica |
|---------|------|--------|
| Performance | ? 95 mobile | SSG, CSS cr?tico inline leve, fonte system stack ou 1 woff2 subset |
| LCP | < 2,0s | Pre?o + H1 no HTML inicial; sem await de JS |
| INP | < 200ms | Ilha React pequena; busca fora da rota ve?culo |
| CLS | < 0,1 | reservar altura para gr?fico hist?rico |
| TBT | < 150ms | zero analytics s?ncrono |

**Assets:** imagens OG fora do critical path; gr?fico hist?rico lazy (canvas ap?s vis?vel).

**CDN:** cache imut?vel para `/assets/*`; HTML `s-maxage` alinhado ao ciclo FIPE mensal.

**Medi??o:** CI com Lighthouse em amostra (home + 3 ve?culos: carro popular, moto, caminh?o) ? artefato como `lighthouse-home.json` estendido.

---

## 12. Mobile first e acessibilidade (a11y)

### 12.1 Mobile

- Tipografia: 16px base (evita zoom iOS em inputs).
- Contraste AA m?nimo; pre?o FIPE com peso visual sem depender s? de cor.
- Gestos: swipe opcional no hist?rico; n?o bloquear scroll vertical.

### 12.2 A11y (WCAG 2.2 AA alvo)

- Landmark `main`, `nav`, `footer`; skip link "Ir para conte?do".
- Busca: `combobox` + an?ncio de resultados (`aria-live="polite"`).
- Tabelas de hist?rico com `<caption>` e headers associados.
- Foco vis?vel em todos os interativos; ordem de tab l?gica.
- Reduzir motion: `prefers-reduced-motion` desativa anima??es de gr?fico.

---

## 13. Roadmap ? 4 sprints

### Sprint 1 ? Funda??o SSG + contrato de dados

- Definir `vehicle-page-bundle.schema.json` e gerador a partir de `vehicle-list-complete.json`.
- POC Astro: 100 p?ginas piloto + home est?tica.
- Redirecionamentos 301 da SPA ? can?nicas.
- **Entrega:** build reprodut?vel + valida??o schema.

### Sprint 2 ? UX busca + template ve?culo

- Portar busca shardada para ilha React na home Astro.
- Implementar 10 se??es com degrada??o specs/engine.
- Breadcrumbs + JSON-LD + OG templates.
- **Entrega:** parity visual mobile com wireframe.

### Sprint 3 ? Escala 50.395 + SEO t?cnico

- Build completo sharded; sitemap-index; hubs marca/tipo.
- Linkagem interna via grafos (rivais, anos, motor).
- CI mensal integrado ao pipeline FIPE.
- **Entrega:** 100% URLs index?veis no Search Console.

### Sprint 4 ? Performance, a11y e polish

- Lighthouse CI 95+; otimiza??o OG em lote.
- Auditoria a11y (axe) + corre??es.
- Monitoramento RUM (Core Web Vitals) e error tracking.
- **Entrega:** baseline KPI abaixo publicada.

---

## 14. KPIs de sucesso

| KPI | Baseline (SPA) | Meta 90 dias |
|-----|----------------|--------------|
| P?ginas indexadas (GSC) | Baixo / fragmentado | ? 45.000 (90%+) |
| Lighthouse Performance (mobile) | vari?vel | ? 95 (amostra + home) |
| LCP p75 (RUM) | ? | < 2,0s |
| CTR m?dio SERP p?ginas ve?culo | ? | ? 3,5% |
| Bounce rate p?gina ve?culo | ? | < 55% |
| Tempo at? 1? resultado busca | ? | < 300ms p75 (shard quente) |
| Cobertura ficha t?cnica vis?vel | 100% specs-master | UI oculta campos vazios; engine-master quando dispon?vel |
| Erros schema (Rich Results) | ? | 0 erros cr?ticos |
| Build time CI completo | ? | < 45 min (paralelo + cache) |

---

## 15. Checklist de implementa??o imediata

- [ ] Criar `data/schemas/vehicle-page-bundle.schema.json`
- [ ] Script `generate-vehicle-page-bundles.mjs` consumindo specs + engine + history
- [ ] Projeto Astro (`/apps/web` ou raiz) com rota din?mica FIPE
- [ ] Componente React `SmartSearch` compartilhado com `useSearchIndex`
- [ ] Template Astro `VehiclePage.astro` lendo bundle est?tico
- [ ] Gerador sitemap + valida??o links internos
- [ ] Testes: slug ?nico, colis?o c?digo FIPE, snapshot JSON-LD

---

## 16. Refer?ncias internas do reposit?rio

- SPA: `src/`, `vite.config.ts`, `vercel.json`
- Busca: `src/hooks/useSearchIndex.ts`, `src/lib/shardedCatalog.ts`, `data/fipe/search/`
- Dados: `data/indexes/vehicle-list-complete.json`, `data/reports/vehicle-list-complete-summary.json`
- Specs: `data/static/specs/`, `data/schemas/static-vehicle-specs.schema.json`
- Slugs: `src/lib/slug.ts`, `src/lib/search.ts`
- CI dados: `.github/workflows/monthly-fipe.yml`

---

*Documento gerado para alinhar produto, frontend e SEO na migra??o SPA ? SSG. Revisar ap?s cada ciclo mensal FIPE.*
