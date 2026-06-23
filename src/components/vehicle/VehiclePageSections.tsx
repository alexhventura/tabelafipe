import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import type { RelatedLink, VehiclePageBundle } from '../../types/bundle';
import { formatBRL, formatPct } from '../../lib/format';
import { historicoToChartData } from '../../lib/bundle';

const PriceChart = lazy(() => import('./PriceChart'));

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-right">{value}</dd>
    </div>
  );
}

function RelatedGrid({ title, links }: { title: string; links: RelatedLink[] }) {
  if (!links.length) return null;
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((item) => (
          <Link
            key={item.vehicleId}
            to={item.canonicalPath}
            className="flex flex-col gap-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition-colors min-h-[56px]"
          >
            <span className="text-sm font-semibold line-clamp-2">{item.displayName}</span>
            <span className="text-xs text-slate-500">
              {item.ano} · FIPE {item.fipeCodigo}
            </span>
            <span className="text-sm font-bold text-blue-600 tabular-nums">{formatBRL(item.valorAtual)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

interface Props {
  bundle: VehiclePageBundle;
}

export default function VehiclePageSections({ bundle }: Props) {
  const { identity, fipe, sections, seo } = bundle;
  const specs = bundle.specs as Record<string, unknown> | null;
  const engine = bundle.engine?.entity as Record<string, unknown> | null;
  const inmetro = bundle.inmetro;

  return (
    <div className="space-y-8">
      {sections.preco && (
        <section aria-labelledby="sec-preco" className="space-y-4">
          <h2 id="sec-preco" className="text-lg font-bold">
            Preço FIPE
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-blue-600 text-white rounded-2xl p-6 space-y-1">
              <p className="text-xs uppercase tracking-wider opacity-80">Valor de referência</p>
              <p className="text-3xl font-bold tabular-nums">{formatBRL(fipe.valorAtual)}</p>
              {fipe.trend6m != null && (
                <p className="text-sm opacity-90">
                  {fipe.trend6m >= 0 ? '▲' : '▼'} {formatPct(Math.abs(fipe.trend6m))} em 6 meses
                </p>
              )}
              <p className="text-xs opacity-75">Ref. {fipe.mesReferencia}</p>
            </div>
            <dl className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm space-y-0">
              <SpecRow label="Combustível" value={identity.combustivel} />
              <SpecRow
                label="Transmissão"
                value={(specs?.cambio as string) ?? (bundle.transmission?.transmissionNome as string) ?? (engine?.cambio as string)}
              />
              <SpecRow
                label="Potência"
                value={specs?.potenciaCv ? `${specs.potenciaCv} cv` : engine?.potencia ? `${engine.potencia} cv` : null}
              />
              <SpecRow
                label="Consumo cidade"
                value={inmetro?.consumoCidade ? `${inmetro.consumoCidade} km/l` : null}
              />
            </dl>
          </div>
        </section>
      )}

      {sections.historico && (
        <section aria-labelledby="sec-historico" className="space-y-4">
          <h2 id="sec-historico" className="text-lg font-bold">
            Histórico FIPE
          </h2>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 min-h-[200px]">
            <Suspense fallback={<div className="h-48 flex items-center justify-center text-slate-400 text-sm">Carregando gráfico...</div>}>
              <PriceChart data={historicoToChartData(fipe.historico)} />
            </Suspense>
          </div>
        </section>
      )}

      {sections.specs && specs && (
        <section aria-labelledby="sec-specs" className="space-y-4">
          <h2 id="sec-specs" className="text-lg font-bold">
            Ficha técnica
          </h2>
          <dl className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm">
            <SpecRow label="Potência" value={specs.potenciaCv ? `${specs.potenciaCv} cv` : null} />
            <SpecRow label="Torque" value={specs.torqueNm ? `${specs.torqueNm} Nm` : null} />
            <SpecRow label="Câmbio" value={specs.cambio as string} />
            <SpecRow label="Porta-malas" value={specs.portaMalasL ? `${specs.portaMalasL} L` : null} />
            <SpecRow label="Tanque" value={specs.tanqueL ? `${specs.tanqueL} L` : null} />
            <SpecRow label="Peso" value={specs.pesoKg ? `${specs.pesoKg} kg` : null} />
          </dl>
        </section>
      )}

      {sections.engine && bundle.engine && (
        <section aria-labelledby="sec-engine" className="space-y-4">
          <h2 id="sec-engine" className="text-lg font-bold">
            Motor
          </h2>
          <dl className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm">
            <SpecRow label="Motor" value={bundle.engine.engineNome} />
            <SpecRow label="Potência" value={engine?.potencia ? `${engine.potencia} cv` : null} />
            <SpecRow label="Torque" value={engine?.torqueNm ? `${engine.torqueNm} Nm` : null} />
            <SpecRow label="Óleo" value={engine?.oleo as string} />
            <SpecRow label="Capacidade óleo" value={engine?.capacidadeOleoL ? `${engine.capacidadeOleoL} L` : null} />
          </dl>
        </section>
      )}

      {sections.inmetro && inmetro && (
        <section aria-labelledby="sec-inmetro" className="space-y-4">
          <h2 id="sec-inmetro" className="text-lg font-bold">
            Consumo e eficiência
          </h2>
          <dl className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm">
            <SpecRow label="Cidade (gasolina)" value={inmetro.consumoCidade ? `${inmetro.consumoCidade} km/l` : null} />
            <SpecRow label="Estrada (gasolina)" value={inmetro.consumoEstrada ? `${inmetro.consumoEstrada} km/l` : null} />
            <SpecRow label="Cidade (etanol)" value={inmetro.consumoCidadeEtanol ? `${inmetro.consumoCidadeEtanol} km/l` : null} />
            <SpecRow label="Classificação" value={inmetro.classificacaoEnergetica as string} />
          </dl>
        </section>
      )}

      {bundle.safety && (
        <section aria-labelledby="sec-safety" className="space-y-4">
          <h2 id="sec-safety" className="text-lg font-bold">
            Segurança
          </h2>
          <dl className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm">
            <SpecRow label="Nota geral NCAP" value={bundle.safety.notaGeral as number} />
            <SpecRow label="Proteção adultos" value={bundle.safety.protecaoAdultos as number} />
            <SpecRow label="Proteção infantis" value={bundle.safety.protecaoInfantis as number} />
          </dl>
        </section>
      )}

      {(bundle.warranty || bundle.recalls) && (
        <section aria-labelledby="sec-warranty" className="space-y-4">
          <h2 id="sec-warranty" className="text-lg font-bold">
            Garantia e recalls
          </h2>
          <dl className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm">
            <SpecRow label="Garantia total" value={bundle.warranty?.garantiaTotalAnos ? `${bundle.warranty.garantiaTotalAnos} anos` : null} />
            <SpecRow label="Anticorrosão" value={bundle.warranty?.garantiaAnticorrosaoAnos ? `${bundle.warranty.garantiaAnticorrosaoAnos} anos` : null} />
            <SpecRow label="Recalls ativos" value={bundle.recalls?.ativos as number} />
            <SpecRow label="Total campanhas" value={bundle.recalls?.total as number} />
          </dl>
        </section>
      )}

      {sections.maintenance && bundle.maintenance && (
        <section aria-labelledby="sec-maint" className="space-y-4">
          <h2 id="sec-maint" className="text-lg font-bold">
            Manutenção
          </h2>
          <dl className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm">
            <SpecRow label="Óleo recomendado" value={bundle.maintenance.oleo as string} />
            <SpecRow label="Pneus" value={(bundle.maintenance.pneus as string[])?.join(', ')} />
          </dl>
        </section>
      )}

      {sections.generation && bundle.generation?.catalogEntry && (
        <section aria-labelledby="sec-gen" className="space-y-4">
          <h2 id="sec-gen" className="text-lg font-bold">
            Geração e evolução
          </h2>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm">
            <p className="font-semibold">{(bundle.generation.catalogEntry.label as string) ?? bundle.generation.geracaoId}</p>
            {bundle.generation.familia && (
              <p className="text-slate-500 mt-1">Família: {bundle.generation.familia}</p>
            )}
          </div>
        </section>
      )}

      {sections.relacionados && (
        <div className="space-y-8">
          <RelatedGrid title="Mesma geração" links={bundle.related.mesmaGeracao} />
          <RelatedGrid title="Mesmo motor" links={bundle.related.mesmoMotor} />
          <RelatedGrid title="Mesma plataforma" links={bundle.related.mesmaPlataforma} />
          <RelatedGrid title="Mesma transmissão" links={bundle.related.mesmaTransmissao} />
          <RelatedGrid title="Veículos semelhantes" links={bundle.related.concorrentes} />
          <RelatedGrid title="Mesma faixa de preço" links={bundle.related.mesmaFaixaPreco} />
        </div>
      )}

      {bundle.faq.length > 0 && (
        <section aria-labelledby="sec-faq" className="space-y-4">
          <h2 id="sec-faq" className="text-lg font-bold">
            Perguntas frequentes
          </h2>
          <div className="space-y-2">
            {bundle.faq.map((item) => (
              <details
                key={item.pergunta}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <summary className="px-4 py-3 cursor-pointer font-semibold text-sm list-none flex justify-between items-center min-h-[44px]">
                  {item.pergunta}
                  <span className="text-slate-400 group-open:rotate-180 transition-transform" aria-hidden>
                    ▼
                  </span>
                </summary>
                <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-300">{item.resposta}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <nav aria-label="Breadcrumb" className="sr-only">
        {seo.breadcrumb.map((b) => b.name).join(' › ')}
      </nav>
    </div>
  );
}
