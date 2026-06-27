import { Link } from 'react-router-dom';
import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import type { RelatedLink, VehiclePageBundle } from '../../types/bundle';
import { formatBRL, formatPct } from '../../lib/format';
import { formatRelatedYear, getIdentityDisplayYear } from '../../lib/displayYear';
import { formatCompactSourcesLine } from '../../lib/vehicleSources';
import { historicoToChartData } from '../../lib/bundle';
import AdSlot from '../ads/AdSlot';
import ShareButtons from './ShareButtons';
import HistoricoTable from './HistoricoTable';
import { AD_SLOTS } from '../../lib/adsenseConfig';
import {
  buildEnhancedFaq,
  buildConsumoRows,
  buildInternalNav,
  buildMaintenanceRows,
  buildQuickCards,
  buildSeoArticle,
  buildSpecGroups,
  categoryConsumoHint,
  computeHistoricoStats,
  formatMesReferencia,
  pickConcorrentes,
  pickOutrasVersoes,
} from '../../lib/vehiclePageData';
import { formatInmetroSourceLine, buildProvenanceDisplayRows } from '../../lib/provenance';
import { formatVehicleTitle, sanitizeDisplayText, formatTitleCase } from '../../lib/display';

const PriceChart = lazy(() => import('./PriceChart'));

function ChartFallback() {
  return <div className="h-48 sm:h-56 w-full" aria-hidden />;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="space-y-4 scroll-mt-20">
      <h2 id={`${id}-title`} className="text-lg font-bold text-slate-900 dark:text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SpecRows({ rows }: { rows: { label: string; value: string }[] }) {
  if (!rows.length) return null;
  return (
    <dl className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-slate-600 dark:text-slate-400">{row.label}</dt>
          <dd className="font-semibold text-right">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RelatedGrid({ links }: { links: RelatedLink[] }) {
  if (!links.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {links.map((item) => (
        <Link
          key={item.vehicleId}
          to={item.canonicalPath}
          className="flex flex-col gap-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition-colors min-h-[56px]"
        >
          <span className="text-sm font-semibold line-clamp-2">{item.displayName}</span>
          <span className="text-xs text-slate-500">
            {formatRelatedYear(item)}
            {formatRelatedYear(item) ? ' · ' : ''}
            FIPE {item.fipeCodigo}
          </span>
          <span className="text-sm font-bold text-blue-600 tabular-nums">{formatBRL(item.valorAtual)}</span>
        </Link>
      ))}
    </div>
  );
}

interface Props {
  bundle: VehiclePageBundle;
}

export default function VehiclePageSections({ bundle }: Props) {
  const { identity, fipe } = bundle;
  const specs = bundle.specs as Record<string, unknown> | null;
  const safety = bundle.safety;
  const recalls = bundle.recalls;
  const warranty = bundle.warranty;

  const quickCards = useMemo(() => buildQuickCards(bundle), [bundle]);
  const historicoStats = useMemo(() => computeHistoricoStats(fipe.historico), [fipe.historico]);
  const specGroups = useMemo(() => buildSpecGroups(bundle), [bundle]);
  const maintenanceRows = useMemo(() => buildMaintenanceRows(bundle), [bundle]);
  const outrasVersoes = useMemo(() => pickOutrasVersoes(bundle), [bundle]);
  const concorrentes = useMemo(() => pickConcorrentes(bundle), [bundle]);
  const internalNav = useMemo(() => buildInternalNav(bundle), [bundle]);
  const seoArticle = useMemo(() => buildSeoArticle(bundle), [bundle]);
  const faqItems = useMemo(() => buildEnhancedFaq(bundle), [bundle]);
  const consumoHint = useMemo(() => categoryConsumoHint(bundle), [bundle]);
  const consumoRows = useMemo(() => buildConsumoRows(bundle), [bundle]);
  const provenanceRows = useMemo(() => buildProvenanceDisplayRows(bundle), [bundle]);
  const inmetroSourceLine = useMemo(() => formatInmetroSourceLine(bundle), [bundle]);
  const sourcesLine = useMemo(() => formatCompactSourcesLine(bundle), [bundle]);

  const variacao12m =
    historicoStats?.variacao12m ?? (fipe.trend6m != null ? fipe.trend6m * 2 : null);

  const pageTitle = useMemo(
    () =>
      formatTitleCase(sanitizeDisplayText(bundle.seo?.h1)) ||
      formatVehicleTitle(identity.displayName, identity),
    [bundle.seo?.h1, identity],
  );
  const identityYear = getIdentityDisplayYear(identity);
  const heroMetaLine = [
    formatTitleCase(identity.combustivel),
    identityYear.kind === 'zero_km' ? identityYear.label : identityYear.label ? `Ano ${identityYear.label}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-10">
      {/* SEÇÃO 1 — HERO (above the fold: veículo, preço, tendência) */}
      <header className="space-y-2">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="space-y-0.5">
            <h1 className="text-lg sm:text-xl font-bold leading-snug line-clamp-2">{pageTitle}</h1>
            {heroMetaLine && <p className="text-xs text-slate-300">{heroMetaLine}</p>}
          </div>

          <div className="space-y-1 border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold">Preço FIPE</p>
            <p className="text-3xl sm:text-4xl font-bold tabular-nums leading-none">{formatBRL(fipe.valorAtual)}</p>
            {variacao12m != null && (
              <p
                className={`text-sm font-semibold ${variacao12m >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
              >
                {variacao12m >= 0 ? '▲' : '▼'} {formatPct(Math.abs(variacao12m))} em 12 meses
              </p>
            )}
            <p className="text-xs text-slate-300">
              FIPE {fipe.fipeCodigo} · {formatMesReferencia(fipe.mesReferencia)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-0.5">
            <a
              href="#sec-historico"
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold min-h-[40px] inline-flex items-center"
            >
              Histórico
            </a>
            {concorrentes.length > 0 && (
              <a
                href="#sec-concorrentes"
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold min-h-[40px] inline-flex items-center"
              >
                Comparar
              </a>
            )}
            <div className="[&_span]:text-slate-300 [&_button]:border-white/20 [&_button]:text-white [&_a]:border-white/20">
              <ShareButtons title={bundle.seo.title} url={bundle.seo.canonical} />
            </div>
          </div>
        </div>
      </header>

      <AdSlot format="leaderboard" slotId={AD_SLOTS.vehicleLeaderboard || undefined} />

      {/* SEÇÃO 2 — HISTÓRICO FIPE (logo após o hero) */}
      {bundle.sections.historico && fipe.historico.length > 1 && historicoStats && (
        <Section id="sec-historico" title="Histórico FIPE">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 min-h-[220px]">
            <Suspense fallback={<ChartFallback />}>
              <PriceChart data={historicoToChartData(fipe.historico)} />
            </Suspense>
          </div>
          <HistoricoTable historico={fipe.historico} />
          {historicoStats.insight && (
            <p className="text-sm text-slate-600 dark:text-slate-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-3">
              {historicoStats.insight}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            {historicoStats.variacao12m != null && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
                <p className="text-xs text-slate-500">12 meses</p>
                <p className="font-bold tabular-nums">{formatPct(historicoStats.variacao12m)}</p>
              </div>
            )}
            {historicoStats.variacao24m != null && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
                <p className="text-xs text-slate-500">24 meses</p>
                <p className="font-bold tabular-nums">{formatPct(historicoStats.variacao24m)}</p>
              </div>
            )}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
              <p className="text-xs text-slate-500">Máxima</p>
              <p className="font-bold tabular-nums">{formatBRL(historicoStats.max)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
              <p className="text-xs text-slate-500">Mínima</p>
              <p className="font-bold tabular-nums">{formatBRL(historicoStats.min)}</p>
            </div>
          </div>
        </Section>
      )}

      {/* SEÇÃO 3 — RESUMO RÁPIDO */}
      {quickCards.length > 0 && (
        <Section id="sec-resumo" title="Resumo rápido">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {quickCards.map((card) => (
              <div
                key={card.label}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 min-h-[72px] flex flex-col justify-center"
              >
                <p className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">{card.label}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 line-clamp-2">{card.value}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <AdSlot format="rectangle" slotId={AD_SLOTS.vehicleRectangle || undefined} />

      {/* SEÇÃO 4 — FICHA TÉCNICA */}
      {specGroups.length > 0 && (
        <Section id="sec-ficha" title="Ficha técnica">
          <div className="space-y-4">
            {specGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{group.title}</h3>
                <SpecRows rows={group.rows} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* SEÇÃO 5 — MANUTENÇÃO */}
      {maintenanceRows.length > 0 && (
        <Section id="sec-manutencao" title="Manutenção">
          <SpecRows rows={maintenanceRows} />
        </Section>
      )}

      {/* SEÇÃO 6 — CONSUMO E EFICIÊNCIA ENERGÉTICA */}
      {bundle.sections.inmetro && consumoRows.length > 0 && (
        <Section id="sec-consumo" title="Consumo e eficiência energética">
          <SpecRows rows={consumoRows} />
          {inmetroSourceLine && (
            <p className="text-xs text-slate-500 px-1 leading-relaxed">{inmetroSourceLine}</p>
          )}
          {consumoHint && <p className="text-xs text-slate-500 px-1">{consumoHint}</p>}
        </Section>
      )}

      {/* SEÇÃO 7 — SEGURANÇA */}
      {(safety || recalls || warranty) && (
        <Section id="sec-seguranca" title="Segurança">
          {(recalls?.ativos as number) > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              Atenção: {String(recalls?.ativos)} recall(s) ativo(s) registrados para este modelo.
            </div>
          )}
          <SpecRows
            rows={[
              safety?.notaGeral != null ? { label: 'Latin NCAP (geral)', value: String(safety.notaGeral) } : null,
              safety?.protecaoAdultos != null
                ? { label: 'Proteção adultos', value: `${safety.protecaoAdultos}%` }
                : null,
              safety?.protecaoInfantis != null
                ? { label: 'Proteção infantis', value: `${safety.protecaoInfantis}%` }
                : null,
              warranty?.garantiaTotalAnos
                ? { label: 'Garantia', value: `${warranty.garantiaTotalAnos} anos` }
                : null,
              recalls?.total != null ? { label: 'Campanhas de recall', value: String(recalls.total) } : null,
            ].filter(Boolean) as { label: string; value: string }[]}
          />
        </Section>
      )}

      {/* SEÇÃO 8 — OUTRAS VERSÕES */}
      {outrasVersoes.length > 0 && (
        <Section id="sec-versoes" title="Outras versões">
          <RelatedGrid links={outrasVersoes} />
        </Section>
      )}

      {/* SEÇÃO 9 — CONCORRENTES */}
      {concorrentes.length > 0 && (
        <Section id="sec-concorrentes" title="Concorrentes">
          <p className="text-sm text-slate-500">
            Mesma categoria, faixa de preço e ano — marcas e modelos diferentes.
          </p>
          <RelatedGrid links={concorrentes} />
        </Section>
      )}

      {/* SEÇÃO 10 — CONTEÚDO SEO */}
      {seoArticle && (
        <Section id="sec-conteudo" title="Sobre este veículo">
          <article className="prose prose-sm prose-slate dark:prose-invert max-w-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
            {seoArticle.split('\n\n').map((para) => (
              <p key={para.slice(0, 48)} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mb-4 last:mb-0">
                {para}
              </p>
            ))}
          </article>
        </Section>
      )}

      {/* SEÇÃO 11 — NAVEGAÇÃO INTERNA */}
      {internalNav.length > 0 && (
        <Section id="sec-navegacao" title="Explore mais">
          <div className="grid gap-2 sm:grid-cols-2">
            {internalNav.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="flex flex-col p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition-colors min-h-[56px]"
              >
                <span className="text-sm font-semibold">{link.label}</span>
                {link.hint && <span className="text-xs text-slate-500 mt-0.5 line-clamp-1">{link.hint}</span>}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* FONTES E CONFIABILIDADE */}
      {provenanceRows.length > 0 && (
        <Section id="sec-provenance" title="Fontes e confiabilidade dos dados">
          <dl className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm divide-y divide-slate-100 dark:divide-slate-800">
            {provenanceRows.map((row) => (
              <div key={row.field} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <dt className="font-semibold text-slate-900 dark:text-white">{row.label}</dt>
                <dd className="text-slate-600 dark:text-slate-300">
                  <span className="block">Fonte: {row.source}</span>
                  <span className="block">Confiabilidade: {row.confidence}</span>
                  {row.note && <span className="block text-xs text-slate-500 mt-0.5">{row.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {/* FONTES — compacto */}
      <footer id="sec-fontes" className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
        <p>Última atualização: {sourcesLine.atualizacao}</p>
        <p className="leading-relaxed">
          Fontes:{' '}
          {sourcesLine.fontes.map((fonte, i) => (
            <span key={fonte}>
              {i > 0 && ' · '}
              {fonte}
            </span>
          ))}
        </p>
      </footer>

      <AdSlot format="large-rectangle" slotId={AD_SLOTS.vehicleBottom || undefined} />

      {/* SEÇÃO 12 — FAQ */}
      {faqItems.length > 0 && (
        <Section id="sec-faq" title="Perguntas frequentes">
          <div className="space-y-2">
            {faqItems.map((item) => (
              <details
                key={item.pergunta}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <summary className="px-4 py-3 cursor-pointer font-semibold text-sm list-none flex justify-between items-center min-h-[44px]">
                  {item.pergunta}
                  <span className="text-slate-500 group-open:rotate-180 transition-transform" aria-hidden>
                    ▼
                  </span>
                </summary>
                <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-300">{item.resposta}</p>
              </details>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export { buildEnhancedFaq, buildFaqJsonLd } from '../../lib/vehiclePageData';
