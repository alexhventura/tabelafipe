import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { hadVehiclePrerenderShell } from '../../lib/vehiclePrerender';

export default function Layout() {
  if (hadVehiclePrerenderShell()) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
