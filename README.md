# PesquisaTabelaFIPE

Motor de consulta da Tabela FIPE — busca instantânea, catálogo local e SEO programático.

Site: [pesquisatabelafipe.com.br](https://pesquisatabelafipe.com.br)

## Stack

- React 19 + Vite + TypeScript + Tailwind
- Express + better-sqlite3 (`fipe.db`) para API local
- Catálogo estático em JSON para busca offline

## Desenvolvimento

```bash
npm install
npm run api    # API local :3001
npm run dev    # Frontend :3000 (proxy /api/fipe)
```

## Catálogo FIPE

```bash
npm run catalog:tree     # importar marcas/modelos/anos
npm run db:sync          # JSON -> SQLite
npm run catalog:prices   # preços + índice de busca
npm run catalog:status   # progresso
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e configure `FIPE_API_TOKEN` (opcional, 1000 req/dia em [fipe.online](https://fipe.online/register)).
