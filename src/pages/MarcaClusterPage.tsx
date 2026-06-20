import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BreadcrumbJsonLd from '../components/vehicle/BreadcrumbJsonLd';
import { usePageMeta, SITE_URL } from '../hooks/usePageMeta';
import {
  MARCA_CLUSTER_TYPES,
  loadMarcaCluster,
  type MarcaClusterType,
} from '../lib/semantic';
import { marcaPath, modeloPath } from '../lib/seo-routes';
import { formatBRL } from '../lib/format';

const CLUSTER_LABELS: Record<MarcaClusterType, string> = {
  confiabilidade: 'Confiabilidade e histórico FIPE',
  'mais-vendidos': 'Modelos com maior cobertura FIPE',
  problematicos: 'Maior desvalorização registrada',
  manutencao: 'Manutenção (dados FIPE)',
  comparacao: 'Comparar modelos da marca',
};

export default function MarcaClusterPage() {
  const { marcaSlug = '', cluster = '' } = useParams();
  const clusterType = cluster as MarcaClusterType;
  const validCluster = MARCA_CLUSTER_TYPES.includes(clusterType);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadMarcaCluster>>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!validCluster) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadMarcaCluster(marcaSlug).then((c) => {
      setData(c);
      setLoading(false);
    });
  }, [marcaSlug, validCluster]);

  const path = `/marca/${marcaSlug}/${cluster}`;
  const title = data
    ? `${CLUSTER_LABELS[clusterType]} — ${data.nome}`
    : 'Cluster não encontrado';

  usePageMeta({
    title: `${title} | PesquisaTabelaFIPE`,
    description: data
      ? data.analise.join(' ')
      : 'Cluster de marca não encontrado.',
    path,
    ogType: 'article',
  });

  const items = useMemo(() => {
    if (!data) return [];
    switch (clusterType) {
      case 'mais-vendidos':
      case 'comparacao':
      case 'confiabilidade':
        return data.topModelos;
      case 'problematicos':
        return data.modelosAltaDesvalorizacao;
      case 'manutencao':
        return data.topModelos;
      default:
        return data.topModelos;
    }
  }, [data, clusterType]);

  if (!validCluster) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-lg font-semibold">Tipo de cluster inválido</p>
        <Link to={marcaPath(marcaSlug)} className="text-blue-600 text-sm font-semibold">
          Ver marca
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm" role="status">
        Carregando...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-lg font-semibold">Marca não encontrada</p>
        <Link to="/" className="text-blue-600 text-sm font-semibold">
          Início
        </Link>
      </div>
    );
  }

  const canonicalUrl = `${SITE_URL}${path}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', href: SITE_URL },
          { name: data.nome, href: `${SITE_URL}${marcaPath(marcaSlug)}` },
          { name: CLUSTER_LABELS[clusterType], href: canonicalUrl },
        ]}
      />
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">{CLUSTER_LABELS[clusterType]}</h1>
        <p className="text-sm text-slate-500">{data.nome} · {data.totalVeiculos} versões FIPE</p>
      </header>
      <ul className="text-sm space-y-2 text-slate-600 dark:text-slate-300">
        {data.analise.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Destaques</h2>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800 border rounded-xl overflow-hidden">
          {items.map((item) => (
            <li key={item.modeloSlug}>
              <Link
                to={modeloPath(marcaSlug, item.modeloSlug)}
                className="flex justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 min-h-[44px] text-sm"
              >
                <span>{item.modeloNome}</span>
                <span className="font-semibold shrink-0">
                  {'valorMedio' in item && item.valorMedio != null
                    ? formatBRL(item.valorMedio)
                    : 'desvalorizacaoPercentual' in item
                      ? `${item.desvalorizacaoPercentual}%`
                      : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <nav className="flex flex-wrap gap-3 text-xs font-semibold text-blue-600">
        {MARCA_CLUSTER_TYPES.filter((c) => c !== clusterType).map((c) => (
          <Link key={c} to={`/marca/${marcaSlug}/${c}`}>
            {CLUSTER_LABELS[c]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
