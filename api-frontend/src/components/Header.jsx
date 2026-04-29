import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getUserFullName, cn } from '@/lib/utils';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  const fullName = getUserFullName(user);

  return (
    <header className="shrink-0 border-b bg-background">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <h1 className="text-lg font-semibold">RHET API System</h1>
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors',
                'hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring'
              )}
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              <span className="max-w-[200px] text-left leading-tight">
                <span className="block truncate font-medium text-foreground">{fullName}</span>
                <span className="block truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                  {user.role || 'user'}
                </span>
              </span>
              <svg
                className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {open && (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1 min-w-[10rem] rounded-md border border-border bg-card p-1 text-card-foreground shadow-md"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full cursor-pointer items-center rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
