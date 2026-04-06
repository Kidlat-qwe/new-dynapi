import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import apiLogo from '@/assets/298772087_463435945792322_4954104271905295621_n.jpg';

const NAV_ITEMS = {
  admin: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/systems', label: 'Systems' },
    { to: '/admin/health', label: 'Health monitoring' },
    { to: '/admin/users', label: 'Manage users' },
    { to: '/admin/api-tokens', label: 'API tokens' },
    { to: '/admin/system-logs', label: 'System logs' },
  ],
  user: [
    { to: '/user', label: 'Dashboard' },
    { to: '/user/systems', label: 'My Systems' },
  ],
};

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const items = user ? NAV_ITEMS[user.role] || NAV_ITEMS.user : [];

  return (
    <>
      <button
        type="button"
        aria-label="Toggle menu"
        className="fixed left-4 top-4 z-50 rounded-md p-2 md:hidden"
        onClick={() => setOpen((o) => !o)}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-56 border-r bg-card transition-transform',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col pt-14 md:pt-4">
          <div className="border-b px-4 pb-4">
            <div className="flex items-center gap-3">
              <img
                src={apiLogo}
                alt="Rising Hope Education & Technology"
                className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-border"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight">API System</p>
                <p className="truncate text-xs text-muted-foreground">Rising Hope</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin' || item.to === '/user'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
    </>
  );
}
