import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { API_BASE, fetchWithToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminSystemRoutes() {
  const PAGE_SIZE = 10;
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [system, setSystem] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showConfigValues, setShowConfigValues] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const idToken = await getToken(true);
        const [sys, routesRes] = await Promise.all([
          fetchWithToken(`/api/systems/${id}`, { method: 'GET' }, idToken),
          fetch(`${API_BASE}/api/systems/${id}/routes`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load routes'))).then((d) => d.routes || [])),
        ]);
        if (!cancelled) {
          setSystem(sys);
          setRoutes(routesRes);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, getToken]);

  const basePath = system?.api_path_slug ? `/api/${system.api_path_slug}` : null;
  const totalPages = Math.max(1, Math.ceil(routes.length / PAGE_SIZE));
  const paginatedRoutes = routes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const maskConfigValue = (value) => {
    if (value === null || value === undefined || value === '') return '–';
    return showConfigValues ? String(value) : '********';
  };

  useEffect(() => {
    setPage(1);
  }, [id, routes.length]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button type="button" variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/admin/systems')}>
            ← Back to Systems
          </Button>
          <h2 className="text-2xl font-semibold">System routes</h2>
          <p className="text-muted-foreground">
            {system ? (
              <>
                Endpoints for <strong>{system.system_name || 'Unnamed system'}</strong>
                {basePath && (
                  <span className="ml-1 text-sm">
                    (base path: <code className="rounded bg-muted px-1">{basePath}</code>)
                  </span>
                )}
              </>
            ) : (
              'Loading…'
            )}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
      )}

      {system && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Database config</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowConfigValues((v) => !v)}
              >
                {showConfigValues ? 'Hide values' : 'Show values'}
              </Button>
            </div>
            {system.system_description && (
              <p className="text-sm text-muted-foreground">{system.system_description}</p>
            )}
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="font-medium text-muted-foreground">DB type</dt>
                <dd className="mt-0.5 font-mono">{maskConfigValue(system.database_type)}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Host</dt>
                <dd className="mt-0.5 font-mono">{system.database_host || '–'}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Port</dt>
                <dd className="mt-0.5 font-mono">{maskConfigValue(system.database_port)}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Database name</dt>
                <dd className="mt-0.5 font-mono">{maskConfigValue(system.database_name)}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">User</dt>
                <dd className="mt-0.5 font-mono">{maskConfigValue(system.database_user)}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Password</dt>
                <dd className="mt-0.5 font-mono">
                  {maskConfigValue(system.database_password === '[REDACTED]' ? '' : system.database_password)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">SSL</dt>
                <dd className="mt-0.5">{maskConfigValue(system.database_ssl ? 'Yes' : 'No')}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Active</dt>
                <dd className="mt-0.5">{system.is_active ? 'Yes' : 'No'}</dd>
              </div>
              {system.external_base_url && (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-muted-foreground">External base URL</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs">{system.external_base_url}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Endpoints / routes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : routes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No routes registered for this system. Run the migration script to import routes (e.g. Funtalk).</p>
          ) : (
            <div className="overflow-x-auto rounded-lg">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left font-medium">Method</th>
                    <th className="p-2 text-left font-medium">Path</th>
                    <th className="p-2 text-left font-medium">Description</th>
                    <th className="p-2 text-left font-medium">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRoutes.map((r) => (
                    <tr key={r.route_id} className="border-b">
                      <td className="p-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{r.method || '-'}</span>
                      </td>
                      <td className="p-2 font-mono text-xs">{r.path_pattern || '-'}</td>
                      <td className="p-2 text-muted-foreground">{r.description || '-'}</td>
                      <td className="p-2">{r.is_active ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {routes.length > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({routes.length} items)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
