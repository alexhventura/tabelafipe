import React, { useState, useMemo } from 'react';
import { 
  TrendingDown, 
  TrendingUp,
  Fuel, 
  Calendar,
  ShieldCheck,
  Wrench,
  Receipt,
  Gauge
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { Vehicle } from '../types';

interface PainelVeiculoProps {
  vehicle: Vehicle;
}

// Estados e alíquotas oficiais suportadas na simulação
const ESTADOS_IPVA = [
  { nome: 'São Paulo', uf: 'SP', aliquota: 4.0 },
  { nome: 'Rio de Janeiro', uf: 'RJ', aliquota: 4.0 },
  { nome: 'Santa Catarina', uf: 'SC', aliquota: 2.0 },
  { nome: 'Paraná', uf: 'PR', aliquota: 3.5 },
];

export default function PainelVeiculo({ vehicle }: PainelVeiculoProps) {
  // Menu de abas simplificado, nítido e sem poluição visual
  type TabType = 'historico' | 'ipva' | 'manutencao' | 'consumo';
  const [activeTab, setActiveTab] = useState<TabType>('historico');

  // Parâmetros do IPVA
  const [selectedUf, setSelectedUf] = useState<string>('SP');

  // Parâmetros do Consumo
  const [kmMensal, setKmMensal] = useState<number>(1000);
  const [tipoCombustivel, setTipoCombustivel] = useState<'gasolina' | 'etanol'>('gasolina');

  // Preços estáticos dos combustíveis para o simulador
  const PRECO_GASOLINA = 5.80;
  const PRECO_ETANOL = 3.90;

  // 1. IPVA: Alíquota e cálculo imediato do IPVA
  const estadoSelecionado = useMemo(() => {
    return ESTADOS_IPVA.find(e => e.uf === selectedUf) || ESTADOS_IPVA[0];
  }, [selectedUf]);

  const ipvaCalculado = useMemo(() => {
    return (vehicle.valorAtual * estadoSelecionado.aliquota) / 100;
  }, [vehicle.valorAtual, estadoSelecionado]);

  const taxaLicenciamento = 160.00; // Taxa de licenciamento fixa de exemplo
  const custoAnualImpostos = ipvaCalculado + taxaLicenciamento;

  // 2. Consumo: Cálculo real-time de combustível com uso misto (60% cidade, 40% estrada)
  const consumoMisto = useMemo(() => {
    if (tipoCombustivel === 'gasolina') {
      return (vehicle.consumo.cidadeG * 0.6) + (vehicle.consumo.estradaG * 0.4);
    } else {
      return (vehicle.consumo.cidadeE * 0.6) + (vehicle.consumo.estradaE * 0.4);
    }
  }, [vehicle.consumo, tipoCombustivel]);

  const precoCombustivel = tipoCombustivel === 'gasolina' ? PRECO_GASOLINA : PRECO_ETANOL;

  const litrosMensais = useMemo(() => {
    return kmMensal / consumoMisto;
  }, [kmMensal, consumoMisto]);

  const GastoCombustivelMensal = useMemo(() => {
    return litrosMensais * precoCombustivel;
  }, [litrosMensais, precoCombustivel]);

  const GastoCombustivelAnual = useMemo(() => {
    return GastoCombustivelMensal * 12;
  }, [GastoCombustivelMensal]);

  // Taxas de Seguro & Peças para o veículo
  const seguroAnualEstimado = useMemo(() => {
    return vehicle.valorAtual * 0.045; // ~4.5% médio
  }, [vehicle.valorAtual]);

  const manutencaoAnualEstimada = useMemo(() => {
    if (vehicle.categoriaPecas === 'baixa') return 600;
    if (vehicle.categoriaPecas === 'media') return 1200;
    return 2400; // alta
  }, [vehicle.categoriaPecas]);

  // Estatística de depreciação de 24 meses
  const depreciacaoEstatistica = useMemo(() => {
    const hist = vehicle.historicoPrecos;
    if (hist.length > 1) {
      const valorInicial = hist[0].valor;
      const valorFinal = vehicle.valorAtual;
      const mudancaReal = valorFinal - valorInicial;
      const mudancaPct = (mudancaReal / valorInicial) * 100;
      return {
        diferencaReal: Math.abs(mudancaReal),
        diferencaPct: Math.abs(mudancaPct),
        isNegativa: mudancaReal < 0
      };
    }
    return { diferencaReal: 0, diferencaPct: 0, isNegativa: true };
  }, [vehicle]);

  // CSS Reutilizável de Bento Card Premium Interativo
  const cardSleekInteractive = "bg-white border border-slate-200/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] dark:bg-[#1C2541] dark:border-slate-800 dark:shadow-none transition-all duration-550 ease-[cubic-bezier(0.16,1,0.3,1)] transform md:hover:-translate-y-1.5 md:hover:scale-[1.01] md:hover:border-2 md:hover:border-blue-600 dark:md:hover:border-sky-400 md:hover:shadow-[0_16px_32px_-12px_rgba(29,78,216,0.15)] dark:md:hover:shadow-[0_16px_32px_-12px_rgba(56,189,248,0.15)] overflow-hidden group";

  return (
    <div id="painel-veiculo-container" className="w-full space-y-8">
      
      {/* 1. SEÇÃO DE CABEÇALHO DO CARRO */}
      <div 
        id="cabecalho-do-veiculo" 
        className={`${cardSleekInteractive} p-6 md:p-8 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6`}
      >
        <div id="info-veiculo-meta" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3.5 py-1.5 text-[10px] font-mono font-bold tracking-wider uppercase rounded-lg bg-slate-100 text-slate-700 dark:bg-[#0B132B] dark:text-slate-200 border border-slate-200/40 dark:border-slate-800/60">
              FIPE {vehicle.fipeCodigo}
            </span>
            <span className="px-3.5 py-1.5 text-[10px] font-mono font-bold tracking-wider uppercase rounded-lg bg-blue-50 text-blue-700 dark:bg-[#0B132B] dark:text-sky-300 border border-blue-100/30 dark:border-slate-800/80">
              Mecânica {vehicle.categoriaPecas === 'baixa' ? 'Simples & Econômica' : vehicle.categoriaPecas === 'media' ? 'Intermediária' : 'Premium'}
            </span>
          </div>

          <h2 className="font-serif text-3xl md:text-4.5xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
            {vehicle.nome}
          </h2>

          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-300 font-sans leading-relaxed max-w-xl">
            Valores oficiais de mercado apurados para o ano modelo <span className="font-semibold text-slate-805 dark:text-white">{vehicle.anoModelo}</span> alimentados pelas estatísticas nacionais e taxas de imposto regionais atualizadas por nossa mesa de análises.
          </p>
        </div>

        {/* VALOR ATUAL FIPE EM DESTAQUE */}
        <div 
          id="valor-atual-destacado" 
          className="bg-slate-50/60 dark:from-[#0B132B] dark:to-[#1C2541] rounded-2xl p-5 md:p-6 border border-slate-200/50 dark:border-slate-800 text-left md:text-right min-w-[240px] transition-all duration-300"
        >
          <span className="text-[10px] uppercase font-sans tracking-widest text-slate-400 dark:text-slate-400 block mb-1.5 font-bold">
            Preço Médio FIPE
          </span>
          <div className="text-2xl md:text-4xl font-serif font-bold text-blue-600 dark:text-sky-450 tracking-tight leading-none">
            {vehicle.valorAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          
          <div className="mt-4 flex items-center justify-start md:justify-end gap-2 text-xs font-sans">
            {depreciacaoEstatistica.isNegativa ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-100/60 dark:border-emerald-900/10">
                <TrendingDown className="w-4 h-4" />
                -{depreciacaoEstatistica.diferencaPct.toFixed(1)}% (24 meses)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-450 bg-rose-50 dark:bg-rose-950/20 px-2.5 py-1 rounded-lg border border-rose-100/60 dark:border-rose-900/10">
                <TrendingUp className="w-4 h-4" />
                +{depreciacaoEstatistica.diferencaPct.toFixed(1)}% (24 meses)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. MENU HISTÓRICO DE ABAS (NÍTIDO, SOFISTICADO DE ELITE) */}
      <div 
        id="abas-navegacao-menu" 
        className="flex flex-col sm:flex-row gap-1.5 p-1.5 bg-slate-100/85 dark:bg-[#0B132B] rounded-2xl border border-slate-200/40 dark:border-slate-800/85 transition-all"
      >
        <button
          onClick={() => setActiveTab('historico')}
          className={`flex-1 py-3 px-4.5 rounded-xl text-xs font-sans font-bold tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer select-none group/tab ${
            activeTab === 'historico'
              ? 'bg-blue-600 dark:bg-sky-500 text-white shadow-[0_4px_16px_rgba(29,78,216,0.25)] dark:shadow-[0_4px_16px_rgba(56,189,248,0.2)]'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#1C2541]/50'
          }`}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`w-4 h-4 transition-transform duration-300 ease-out group-hover/tab:translate-x-0.5 group-hover/tab:-translate-y-0.5 ${
              activeTab === 'historico'
                ? 'text-white'
                : 'text-slate-500 dark:text-slate-400 group-hover/tab:text-blue-600 dark:group-hover/tab:text-sky-455'
            }`}
          >
            <path d="M4 18 L10 12 L14 14 L20 6" />
            <path d="M15 6 H20 V11" />
          </svg>
          Preço e Gráfico
        </button>
        <button
          onClick={() => setActiveTab('ipva')}
          className={`flex-1 py-3 px-4.5 rounded-xl text-xs font-sans font-bold tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer select-none group/tab ${
            activeTab === 'ipva'
              ? 'bg-blue-600 dark:bg-sky-500 text-white shadow-[0_4px_16px_rgba(29,78,216,0.25)] dark:shadow-[0_4px_16px_rgba(56,189,248,0.2)]'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#1C2541]/50'
          }`}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`w-4 h-4 transition-transform duration-300 ease-out group-hover/tab:-translate-y-0.5 ${
              activeTab === 'ipva'
                ? 'text-white'
                : 'text-slate-500 dark:text-slate-400 group-hover/tab:text-blue-600 dark:group-hover/tab:text-sky-455'
            }`}
          >
            <rect x="4" y="3" width="16" height="18" rx="1.5" />
            <path d="M8 8 h8" />
            <path d="M8 12 h6" />
            <path d="M8 16 h4" />
          </svg>
          IPVA e Impostos
        </button>
        <button
          onClick={() => setActiveTab('manutencao')}
          className={`flex-1 py-3 px-4.5 rounded-xl text-xs font-sans font-bold tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer select-none group/tab ${
            activeTab === 'manutencao'
              ? 'bg-blue-600 dark:bg-sky-500 text-white shadow-[0_4px_16px_rgba(29,78,216,0.25)] dark:shadow-[0_4px_16px_rgba(56,189,248,0.2)]'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#1C2541]/50'
          }`}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`w-4 h-4 transition-transform duration-500 ease-out group-hover/tab:rotate-30 ${
              activeTab === 'manutencao'
                ? 'text-white'
                : 'text-slate-500 dark:text-slate-400 group-hover/tab:text-blue-600 dark:group-hover/tab:text-sky-455'
            }`}
          >
            <path d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z" />
            <circle cx="12" cy="12" r="3" />
            <path d="M5 5 L19 19" />
          </svg>
          Manutenção e Seguro
        </button>
        <button
          onClick={() => setActiveTab('consumo')}
          className={`flex-1 py-3 px-4.5 rounded-xl text-xs font-sans font-bold tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer select-none group/tab ${
            activeTab === 'consumo'
              ? 'bg-blue-600 dark:bg-sky-500 text-white shadow-[0_4px_16px_rgba(29,78,216,0.25)] dark:shadow-[0_4px_16px_rgba(56,189,248,0.2)]'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#1C2541]/50'
          }`}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`w-4 h-4 transition-transform duration-350 ease-out ${
              activeTab === 'consumo'
                ? 'text-white'
                : 'text-slate-500 dark:text-slate-400 group-hover/tab:text-blue-600 dark:group-hover/tab:text-sky-455'
            }`}
          >
            <path d="M4 16 A8 8 0 0 1 20 16" />
            <path d="M4 16 H20" />
            <path d="M12 16 L17 11" className="origin-[12px_16px] transition-transform duration-500 ease-out group-hover/tab:rotate-[15deg]" />
          </svg>
          Consumo de Combustível
        </button>
      </div>

      {/* 3. CONTEÚDOS DINÂMICOS DAS ABAS - GRID BENTO RESPONSIVO */}
      <div id="conteudo-principal-bento-grid" className="transition-all duration-350">
        
        {/* ================= ABA: PREÇO E GRÁFICO ================= */}
        {activeTab === 'historico' && (
          <div id="aba-conteudo-historico" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Bloco Bento do Gráfico */}
            <div className={`${cardSleekInteractive} lg:col-span-2 p-6 flex flex-col justify-between rounded-2xl`}>
              <div>
                <h3 className="text-lg md:text-xl font-serif font-bold text-slate-900 dark:text-white">
                  Histórico de Mercado (24 Meses)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
                  Acompanhe a curva de desvalorização real acumulada para este ano-modelo nas pesquisas nacionais.
                </p>
              </div>

              {/* Área do Gráfico */}
              <div className="h-68 md:h-76 w-full mt-6 text-xs font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={vehicle.historicoPrecos}
                    margin={{ top: 12, right: 12, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                    <XAxis 
                      dataKey="mes" 
                      tickLine={false}
                      axisLine={false}
                      stroke="#94A3B8"
                    />
                    <YAxis 
                      tickLine={false}
                      axisLine={false}
                      domain={['auto', 'auto']}
                      stroke="#94A3B8"
                      tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(v) => [`R$ ${Number(v).toLocaleString('pt-BR')}`, 'Preço FIPE']}
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        color: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #1E293B',
                        fontFamily: 'monospace'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="valor" 
                      stroke="#2563eb" 
                      strokeWidth={3.5}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Estatísticas Rápidas do Gráfico */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 font-sans block uppercase font-bold tracking-wider">Preço Anterior (Jul/24)</span>
                  <span className="text-sm md:text-base font-serif font-bold text-slate-900 dark:text-white">
                    {vehicle.historicoPrecos[0]?.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 font-sans block uppercase font-bold tracking-wider">Vulnerabilidade de Mercado</span>
                  <span className="text-sm md:text-base font-serif font-bold text-emerald-600 dark:text-emerald-450 block">
                    Estabilidade de Posse Superior
                  </span>
                </div>
              </div>
            </div>

            {/* Listagem de Dados em Tabela Rígida */}
            <div className={`${cardSleekInteractive} p-6 flex flex-col justify-between rounded-2xl`}>
              <div>
                <h3 className="text-sm uppercase tracking-wider text-slate-700 dark:text-slate-205 font-sans font-bold flex items-center gap-2 mb-4">
                  <Calendar className="w-4.5 h-4.5 text-blue-600 dark:text-sky-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-305 ease-out" strokeWidth={1.5} />
                  Série Histórica completa
                </h3>
                
                <div className="max-h-76 overflow-y-auto pr-1.5 space-y-2">
                  {vehicle.historicoPrecos.slice().reverse().map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-2 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-600 dark:text-slate-300 font-sans font-medium">{p.mes}</span>
                      <span className="font-serif font-bold text-slate-900 dark:text-white">
                        {p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 bg-slate-50 dark:bg-[#111827] p-4 rounded-xl text-[10px] text-slate-550 dark:text-slate-350 font-sans leading-relaxed border border-slate-100 dark:border-slate-800/10">
                As cotações retratam médias nacionais unificadas. O valor final varia sob as condições mecânicas e de conservação de cada automóvel.
              </div>
            </div>

          </div>
        )}

        {/* ================= ABA: IPVA E IMPOSTOS ================= */}
        {activeTab === 'ipva' && (
          <div id="aba-conteudo-ipva" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Bloco Principal do IPVA */}
            <div className={`${cardSleekInteractive} lg:col-span-2 p-6 md:p-8 flex flex-col justify-between rounded-2xl`}>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg md:text-xl font-serif font-bold text-slate-900 dark:text-white">
                    Simulador Líquido de IPVA
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
                    Cada federação estadual estabelece uma alíquota do IPVA sobre o valor do veículo na tabela oficial. Selecione o estado e acompanhe os valores.
                  </p>
                </div>

                {/* Seletor do Estado de Licenciamento */}
                <div className="bg-slate-50 dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 space-y-2.5">
                  <label htmlFor="uf-select" className="text-[10px] font-sans uppercase font-bold text-slate-600 dark:text-slate-450 block tracking-wider">
                    Selecione o Estado de Registro:
                  </label>
                  <select
                    id="uf-select"
                    value={selectedUf}
                    onChange={(e) => setSelectedUf(e.target.value)}
                    className="w-full bg-white dark:bg-[#1C2541] border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3.5 text-xs md:text-sm font-sans text-slate-850 dark:text-white font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-xs"
                  >
                    {ESTADOS_IPVA.map((estado) => (
                      <option key={estado.uf} value={estado.uf}>
                        {estado.nome} (Alíquota IPVA: {estado.aliquota.toFixed(1)}%)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cartas de Detalhamento dos Impostos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50/60 dark:bg-[#0B132B] rounded-2xl p-4 md:p-5 border border-slate-200/50 dark:border-slate-800 flex flex-col justify-between">
                    <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400 uppercase font-bold block mb-2 tracking-wider">
                      Alíquota {estadoSelecionado.uf}
                    </span>
                    <strong className="text-xl md:text-2xl font-serif font-bold text-slate-900 dark:text-white">
                      {estadoSelecionado.aliquota.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="bg-blue-50/20 dark:bg-[#0B132B] rounded-2xl p-4 md:p-5 border border-blue-50 dark:border-slate-850 flex flex-col justify-between">
                    <span className="text-[10px] font-sans text-blue-600 dark:text-sky-300 uppercase font-bold block mb-2 tracking-wider">
                      IPVA Calculado
                    </span>
                    <strong className="text-xl md:text-2xl font-serif font-bold text-blue-600 dark:text-sky-400">
                      {ipvaCalculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </div>
                  <div className="bg-slate-50/60 dark:bg-[#0B132B] rounded-2xl p-4 md:p-5 border border-slate-200/50 dark:border-slate-800 flex flex-col justify-between">
                    <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400 uppercase font-bold block mb-2 tracking-wider">
                      Licenciamento Médio
                    </span>
                    <strong className="text-xl md:text-2xl font-serif font-bold text-slate-900 dark:text-white">
                      {taxaLicenciamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-sans text-slate-500 dark:text-slate-300">
                O custo fixo fiscal provisionado mensal para este veículo em {estadoSelecionado.nome} equivale a <strong className="text-slate-900 dark:text-white font-bold">{(custoAnualImpostos / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / mês</strong>.
              </div>
            </div>

            {/* Sidebar Editorial de Dicas IPVA */}
            <div className={`${cardSleekInteractive} p-6 flex flex-col justify-between rounded-2xl`}>
              <div className="space-y-4">
                <h3 className="text-sm font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-250 flex items-center gap-1.5">
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="w-6 h-6 text-blue-600 dark:text-sky-400 transition-transform duration-300 ease-out group-hover:-translate-y-0.5"
                  >
                    <rect x="4" y="3" width="16" height="18" rx="1.5" />
                    <path d="M8 8 h8" />
                    <path d="M8 12 h6" />
                    <path d="M8 16 h4" />
                  </svg>
                  Aspectos Fiscais
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-sans">
                  Em regras gerais, o pagamento em cota única garante descontos que variam de 3% a 9% na maioria das federações brasileiras.
                </p>
                <div className="bg-slate-50 dark:bg-[#111827] p-5 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs font-sans leading-relaxed space-y-2">
                  <strong className="text-slate-900 dark:text-white font-bold block">Regras de Isenção:</strong>
                  <p className="font-sans leading-relaxed text-slate-600 dark:text-slate-300">
                    A maioria dos estados concede isenção total de IPVA para carros com 15 ou 20 anos de fabricação. Por ser um modelo de <span className="font-semibold text-slate-900 dark:text-white">{vehicle.anoModelo}</span>, este veículo ainda recolhe a tributação padrão regular na maioria das regiões do Brasil.
                  </p>
                </div>
              </div>

              {/* ANÚNCIO Patrocinado Google AdSense (comentários inclusos para o layout) */}
              {/* google_ad_section_start */}
              <div id="adsense-ipva-box" className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                <span className="text-[9px] font-sans tracking-widest text-slate-400 dark:text-slate-500 uppercase font-bold block mb-1.5 text-center">
                  Espaço Publicitário AdSense • Regularização IPVA
                </span>
                <div className="rounded-xl bg-orange-50/50 dark:bg-slate-900 border border-dashed border-orange-200/60 dark:border-slate-805 p-3.5 text-center">
                  <p className="text-[10px] font-bold text-orange-850 dark:text-sky-305 font-sans leading-tight">Pague seu IPVA parcelado em até 12x no cartão de crédito</p>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1">Facilite as despesas fixas anuais na plataforma credenciada pelo Detran.</p>
                </div>
              </div>
              {/* google_ad_section_end */}
            </div>

          </div>
        )}

        {/* ================= ABA: MANUTENÇÃO E SEGURO ================= */}
        {activeTab === 'manutencao' && (
          <div id="aba-conteudo-manutencao" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Bloco de Estimativa de Manutenção e Reposição */}
            <div className={`${cardSleekInteractive} lg:col-span-2 p-6 md:p-8 flex flex-col justify-between rounded-2xl`}>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg md:text-xl font-serif font-bold text-slate-900 dark:text-white">
                    Consumo de Autopeças & Seguro de mercado
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
                    Cálculo prudencial de despesas mecânicas periódicas e taxas médias para blindagem patrimonial comercial.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50/60 dark:bg-[#0B132B] p-5 rounded-2xl border border-slate-201 dark:border-slate-800 group/item transition-all">
                    <div className="flex items-center gap-2.5 mb-2">
                      <svg 
                        width="24" 
                        height="24" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className="w-6 h-6 text-blue-600 dark:text-sky-450 transition-transform duration-550 ease-out group-hover/item:rotate-30"
                      >
                        <path d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z" />
                        <circle cx="12" cy="12" r="3" />
                        <path d="M5 5 L19 19" />
                      </svg>
                      <span className="text-[10px] font-sans uppercase font-bold text-slate-655 dark:text-slate-400 tracking-wider">
                        Manutenção Preventiva Recomendada
                      </span>
                    </div>
                    <strong className="text-2xl font-serif font-bold text-slate-900 dark:text-white block mt-1">
                      {manutencaoAnualEstimada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} <span className="text-xs font-sans text-slate-450 dark:text-slate-400 font-normal">/ano</span>
                    </strong>
                    <div className="border-t border-slate-150/40 dark:border-slate-800 my-2 pt-1.5" />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans block">
                      Filtros de ar, óleo lubrificante sintético homologado e jogos mecânicos básicos de pastilhas de freio.
                    </span>
                  </div>

                  <div className="bg-blue-50/10 dark:bg-[#0B132B] p-5 rounded-2xl border border-blue-50/30 dark:border-slate-850 group/item transition-all">
                    <div className="flex items-center gap-2.5 mb-2">
                      <svg 
                        width="24" 
                        height="24" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className="w-6 h-6 text-blue-600 dark:text-sky-400 transition-transform duration-300 group-hover/item:scale-110"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 11l2 2 4-4" />
                      </svg>
                      <span className="text-[10px] font-sans uppercase font-bold text-blue-600 dark:text-sky-355 tracking-wider">
                        Seguro Estimado (Franquia Integral)
                      </span>
                    </div>
                    <strong className="text-2xl font-serif font-bold text-blue-600 dark:text-sky-400 block mt-1">
                      {seguroAnualEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} <span className="text-xs font-sans text-slate-450 dark:text-slate-400 font-normal">/ano</span>
                    </strong>
                    <div className="border-t border-blue-100/10 dark:border-slate-800 my-2 pt-1.5" />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans block">
                      Prevenção robusta contra sinistros de furto, colisões em trânsito e assistência 24h completa.
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-[#111827] rounded-xl border border-slate-200/50 dark:border-slate-800/80 text-xs font-sans leading-relaxed">
                  <span className="font-bold text-slate-900 dark:text-white block mb-1">Reposição e Classificação Mecânica:</span>
                  <p className="font-sans leading-relaxed text-slate-600 dark:text-slate-300">
                    Por portar uma mecânica de classificação <span className="font-bold text-blue-600 dark:text-sky-400">EA211 ou similar abundante</span>, as autopeças deste automóvel são abundantes e baratas na rede de distribuidoras nacionais. O custo de revisão básica preventiva ao ano totaliza cerca de <strong className="font-bold text-blue-600 dark:text-sky-400">{(manutencaoAnualEstimada / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / mês</strong>.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-sans text-slate-500 dark:text-slate-450">
                Uma boa reserva orçamentária preventiva resguarda e valoriza seu patrimônio pessoal no momento da revenda.
              </div>
            </div>

            {/* Sidebar de Simulação e Orçamentos de Oficina (AdSense) */}
            <div className={`${cardSleekInteractive} p-6 flex flex-col justify-between rounded-2xl`}>
              <div className="space-y-4">
                <h3 className="text-sm font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-255 flex items-center gap-1.5">
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="w-6 h-6 text-blue-600 dark:text-sky-400 transition-transform duration-500 ease-out group-hover:rotate-30"
                  >
                    <path d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M5 5 L19 19" />
                  </svg>
                  Kits de Revisão Populares
                </h3>
                <div className="space-y-3 pt-1">
                  <div className="flex justify-between items-center text-xs py-2 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-600 dark:text-slate-300 font-sans">Jogo de Amortecedores (Par)</span>
                    <strong className="text-slate-900 dark:text-white font-mono">R$ 580,00</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs py-2 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-600 dark:text-slate-300 font-sans">Pastilhas de Freio Diant.</span>
                    <strong className="text-slate-900 dark:text-white font-mono">R$ 140,00</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs py-2 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-600 dark:text-slate-300 font-sans">Kit de Filtros de Ar / Óleo</span>
                    <strong className="text-slate-900 dark:text-white font-mono">R$ 190,00</strong>
                  </div>
                </div>
              </div>

              {/* ANÚNCIO REGULADO GOOGLE ADSENSE */}
              {/* google_ad_section_start */}
              <div id="adsense-pecas-box" className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/50 text-center">
                <span className="text-[9px] font-sans tracking-widest text-slate-400 dark:text-slate-500 uppercase font-bold block mb-1.5">
                  Espaço Publicitário AdSense • Autopeças Premium
                </span>
                <div className="rounded-xl bg-blue-50/50 dark:bg-slate-900 border border-dashed border-blue-200/50 dark:border-slate-805 p-3.5">
                  <h4 className="text-[10px] font-bold text-blue-700 dark:text-sky-305 font-sans leading-snug">Compare Preços de Pneus e Suspensão</h4>
                  <p className="text-[9px] text-slate-550 dark:text-slate-400 mt-1">Kit de rodas residenciais de alta qualidade e pneus aro 14/15 em até 10x sem juros.</p>
                </div>
              </div>
              {/* google_ad_section_end */}
            </div>

          </div>
        )}

        {/* ================= ABA: CONSUMO DE COMBUSTÍVEL ================= */}
        {activeTab === 'consumo' && (
          <div id="aba-conteudo-consumo" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Bloco do Simulador Dinâmico */}
            <div className={`${cardSleekInteractive} lg:col-span-2 p-6 md:p-8 flex flex-col justify-between rounded-2xl`}>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg md:text-xl font-serif font-bold text-slate-900 dark:text-white">
                    Simulador Ativo de Despesas (INMETRO)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
                    Arraste o controle de quilometragem e selecione o combustível ativo para acompanhar em tempo real as despesas de rodagem doméstica.
                  </p>
                </div>

                {/* Painel de Controles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* Slider de Rodagem - TOQUE CONFORTÁVEL */}
                  <div className="bg-slate-50 dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 space-y-4">
                    <div className="flex justify-between items-center text-xs font-sans">
                      <span className="font-bold text-slate-700 dark:text-slate-350">Rodagem Mensal Estimada</span>
                      <strong className="text-slate-950 dark:text-white font-mono text-sm">{kmMensal} km</strong>
                    </div>
                    <input 
                      type="range"
                      min="500"
                      max="3000"
                      step="100"
                      value={kmMensal}
                      onChange={(e) => setKmMensal(Number(e.target.value))}
                      className="w-full h-2.5 bg-slate-200 dark:bg-slate-705 rounded-xl appearance-none cursor-pointer accent-blue-600 dark:accent-sky-450 py-1"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-slate-400 dark:text-slate-404">
                      <span>500 km</span>
                      <span>1.500 km</span>
                      <span>3.000 km</span>
                    </div>
                  </div>

                  {/* Seletor de Combustível - TOQUE CONFORTO */}
                  <div className="bg-slate-50 dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 space-y-4 flex flex-col justify-between">
                    <span className="text-[10px] font-sans uppercase font-bold text-slate-700 dark:text-slate-350 block tracking-wider">Combustível Líquido</span>
                    
                    <div className="flex bg-white dark:bg-[#1C2541] p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <button
                        onClick={() => setTipoCombustivel('gasolina')}
                        className={`flex-1 py-2 px-3 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer ${
                          tipoCombustivel === 'gasolina' 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'text-slate-650 hover:text-slate-800 dark:text-slate-300'
                        }`}
                      >
                        Gasolina (R$ 5,80)
                      </button>
                      <button
                        onClick={() => setTipoCombustivel('etanol')}
                        className={`flex-1 py-2 px-3 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer ${
                          tipoCombustivel === 'etanol' 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'text-slate-650 hover:text-slate-800 dark:text-slate-300'
                        }`}
                      >
                        Etanol (R$ 3,90)
                      </button>
                    </div>
                  </div>

                </div>

                {/* Exibição Oficial INMETRO */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50/70 dark:bg-[#0B132B] rounded-xl border border-slate-100 dark:border-slate-850 text-center">
                    <span className="text-[9px] text-slate-400 dark:text-slate-450 block uppercase font-bold leading-none">Cidade (G)</span>
                    <strong className="text-sm font-serif font-bold text-slate-900 dark:text-white block mt-1.5">{vehicle.consumo.cidadeG} km/l</strong>
                  </div>
                  <div className="p-3 bg-slate-50/70 dark:bg-[#0B132B] rounded-xl border border-slate-100 dark:border-slate-850 text-center">
                    <span className="text-[9px] text-slate-400 dark:text-slate-455 block uppercase font-bold leading-none">Estrada (G)</span>
                    <strong className="text-sm font-serif font-bold text-slate-900 dark:text-white block mt-1.5">{vehicle.consumo.estradaG} km/l</strong>
                  </div>
                  <div className="p-3 bg-slate-50/70 dark:bg-[#0B132B] rounded-xl border border-slate-100 dark:border-slate-850 text-center">
                    <span className="text-[9px] text-slate-400 dark:text-slate-455 block uppercase font-bold leading-none">Cidade (E)</span>
                    <strong className="text-sm font-serif font-bold text-slate-900 dark:text-white block mt-1.5">{vehicle.consumo.cidadeE} km/l</strong>
                  </div>
                  <div className="p-3 bg-slate-50/70 dark:bg-[#0B132B] rounded-xl border border-slate-100 dark:border-slate-850 text-center">
                    <span className="text-[9px] text-slate-400 dark:text-slate-455 block uppercase font-bold leading-none">Estrada (E)</span>
                    <strong className="text-sm font-serif font-bold text-slate-900 dark:text-white block mt-1.5">{vehicle.consumo.estradaE} km/l</strong>
                  </div>
                </div>
              </div>

              {/* RESULTADO NUMÉRICO EM DESTAQUE */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 font-sans block uppercase font-bold leading-none tracking-wider">Gasto Mensal de Combustível</span>
                  <div className="text-2xl md:text-3.5xl font-serif font-bold text-blue-600 dark:text-sky-450 mt-1 leading-none">
                    {GastoCombustivelMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} <span className="text-xs md:text-sm font-sans font-normal text-slate-450 dark:text-slate-400">/mês</span>
                  </div>
                </div>
                
                <div className="text-xs text-slate-500 dark:text-slate-400 font-sans sm:text-right">
                  Despesa Anual Próxima: <span className="font-bold text-slate-850 dark:text-white">{GastoCombustivelAnual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>
            </div>

            {/* Sidebar explicativa da Paridade Econômica */}
            <div className={`${cardSleekInteractive} p-6 flex flex-col justify-between rounded-2xl`}>
              <div className="space-y-4">
                <h3 className="text-sm font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-255 flex items-center gap-1.5">
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="w-6 h-6 text-blue-600 dark:text-sky-450"
                  >
                    <path d="M4 16 A8 8 0 0 1 20 16" />
                    <path d="M4 16 H20" />
                    <path d="M12 16 L17 11" className="origin-[12px_16px] transition-transform duration-500 ease-out group-hover:rotate-[15deg]" />
                  </svg>
                  Regra da Paridade
                </h3>
                <p className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed font-sans">
                  A queima de etanol gera em média 30% a menos de torque energético em comparação com a gasolina. Portanto, abastecer com Álcool só compensa monetariamente se o seu preço de bomba for inferior a <span className="font-bold text-blue-600 dark:text-sky-305">70%</span> do preço da Gasolina.
                </p>

                <div className="p-4 bg-slate-50 dark:bg-[#111827] rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs font-sans">
                  <strong className="text-slate-900 dark:text-white block mb-1">Relação Atual de Preços:</strong>
                  <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                    A paridade simulada para os valores médios de referência nacional é de <span className="font-bold text-blue-600 dark:text-sky-350">{((PRECO_ETANOL / PRECO_GASOLINA) * 100).toFixed(0)}%</span>. 
                    { (PRECO_ETANOL / PRECO_GASOLINA) < 0.7 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold block mt-1.5">✔ Recomendado abastecer com ETANOL.</span>
                    ) : (
                      <span className="text-orange-600 dark:text-orange-450 font-bold block mt-1.5">⚠ Recomendado abastecer com GASOLINA.</span>
                    )}
                  </p>
                </div>
              </div>

              {/* ANÚNCIO REGULADO GOOGLE ADSENSE */}
              {/* google_ad_section_start */}
              <div id="adsense-consumo-box" className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/50 text-center">
                <span className="text-[9px] font-sans tracking-widest text-slate-400 dark:text-slate-500 uppercase font-bold block mb-1.5">
                  Espaço Publicitário AdSense • Consumo Inteligente
                </span>
                <div className="rounded-xl bg-orange-50/50 dark:bg-slate-900 border border-dashed border-orange-200/50 dark:border-slate-805 p-3.5">
                  <p className="text-[10px] font-bold text-orange-850 dark:text-sky-305 font-sans leading-tight">Aplicativo de Controle de Abastecimento</p>
                  <p className="text-[9px] text-slate-550 dark:text-slate-400 mt-1">Calcule autonomias reais no celular e monitore gastos por posto de combustível.</p>
                </div>
              </div>
              {/* google_ad_section_end */}
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
