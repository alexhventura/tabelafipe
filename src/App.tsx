import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import VehiclePage from './pages/VehiclePage';

const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const MarcaPage = lazy(() => import('./pages/MarcaPage'));
const MarcaClusterPage = lazy(() => import('./pages/MarcaClusterPage'));
const ModeloPage = lazy(() => import('./pages/ModeloPage'));
const HistoricoPage = lazy(() => import('./pages/HistoricoPage'));
const CompararPage = lazy(() => import('./pages/CompararPage'));
const AnoPage = lazy(() => import('./pages/AnoPage'));
const DecisaoPage = lazy(() => import('./pages/DecisaoPage'));
const SemanticIntentPage = lazy(() => import('./pages/SemanticIntentPage'));
const HubPage = lazy(() => import('./pages/HubPage'));
const InfoPage = lazy(() => import('./pages/InfoPage'));

function RouteFallback() {
  return <div className="min-h-[40vh]" aria-hidden />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/busca" element={<SearchResultsPage />} />
            <Route path="/sobre" element={<InfoPage />} />
            <Route path="/metodologia" element={<InfoPage />} />
            <Route path="/fontes-dados" element={<InfoPage />} />
            <Route path="/privacidade" element={<InfoPage />} />
            <Route path="/cookies" element={<InfoPage />} />
            <Route path="/termos" element={<InfoPage />} />
            <Route path="/fipe/:marca/:slug" element={<VehiclePage />} />
            <Route path="/motor/:engineSlug" element={<HubPage hubKind="motor" />} />
            <Route path="/plataforma/:platformSlug" element={<HubPage hubKind="plataforma" />} />
            <Route path="/geracao/:marca/:geracaoSlug" element={<HubPage hubKind="geracao" />} />
            <Route path="/marca/:marcaSlug/:cluster" element={<MarcaClusterPage />} />
            <Route path="/marca/:marcaSlug" element={<MarcaPage />} />
            <Route path="/modelo/:marcaSlug/:modeloSlug" element={<ModeloPage />} />
            <Route path="/historico/:marcaSlug/:modeloSlug" element={<HistoricoPage />} />
            <Route path="/comparar" element={<CompararPage />} />
            <Route path="/comparar/:slug" element={<CompararPage />} />
            <Route path="/ano/:year" element={<AnoPage />} />
            <Route path="/:decisaoSlug" element={<DecisaoPage />} />
            <Route path="/:marcaSlug/:pageSlug" element={<SemanticIntentPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
