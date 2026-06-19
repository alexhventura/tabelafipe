import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import SearchResultsPage from './pages/SearchResultsPage';
import VehiclePage from './pages/VehiclePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/busca" element={<SearchResultsPage />} />
          <Route path="/fipe/:marca/:slug" element={<VehiclePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
