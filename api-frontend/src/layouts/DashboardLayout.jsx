import { Outlet } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';

export function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden flex-col md:flex-row">
      <Sidebar />
      <div className="flex min-h-0 flex-1 flex-col md:ml-56">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
