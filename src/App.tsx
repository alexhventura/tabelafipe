import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import SearchResultsPage from './pages/SearchResultsPage';
import VehiclePage from './pages/VehiclePage';
import MarcaPage from './pages/MarcaPage';
import MarcaClusterPage from './pages/MarcaClusterPage';
import ModeloPage from './pages/ModeloPage';
import HistoricoPage from './pages/HistoricoPage';
import CompararPage from './pages/CompararPage';
import AnoPage from './pages/AnoPage';
import DecisaoPage from './pages/DecisaoPage';
import SemanticIntentPage from './pages/SemanticIntentPage';
import HubPage from './pages/HubPage';
import InfoPage from './pages/InfoPage';

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="/contato" element={<InfoPage />} />
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
    </BrowserRouter>
  );
}
