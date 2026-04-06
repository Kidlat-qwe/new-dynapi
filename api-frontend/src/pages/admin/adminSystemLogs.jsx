import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { fetchWithToken } from '@/lib/api';

const PAGE_SIZE = 20;

function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function MethodBadge({ method }) {
  const m = (method || 'GET').toUpperCase();
  const isGet = m === 'GET';
  const isPut = m === 'PUT';
  const isPost = m === 'POST';
  const isDelete = m === 'DELETE';
  const cls = isGet
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : isPut
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
      : isPost
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
        : isDelete
          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {m}
    </span>
  );
}

function StatusBadge({ status }) {
  const code = status != null ? Number(status) : null;
  const ok = code >= 200 && code < 300;
  const cls = ok
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : code >= 400
      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {code ?? '—'}
    </span>
  );
}

export default function AdminSystemLogs() {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [systemSlug, setSystemSlug] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [systems, setSystems] = useState([]);
  const [detailLog, setDetailLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const idToken = await getToken(true);
      if (!idToken) throw new Error('Not signed in');
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (systemSlug) params.set('system_slug', systemSlug);
      if (userEmail) params.set('user_email', userEmail);
      const data = await fetchWithToken(`/api/admin/system-logs?${params}`, { method: 'GET' }, idToken);
      setLogs(data.logs || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || 'Failed to load system logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, page, systemSlug, userEmail]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    let cancelled = false;
    getToken(true).then((token) => {
      if (!token || cancelled) return;
      fetchWithToken('/api/systems', { method: 'GET' }, token)
        .then((d) => { if (!cancelled) setSystems(d.systems || []); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [getToken]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">System logs</h2>
        <p className="text-muted-foreground">
          API calls made to external systems from the frontends. Users are identified by the API token owner.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>Request log</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="filter-system" className="text-xs whitespace-nowrap">System</Label>
              <select
                id="filter-system"
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                value={systemSlug}
                onChange={(e) => { setSystemSlug(e.target.value); setPage(1); }}
              >
                <option value="">All</option>
                {systems.map((s) => (
                  <option key={s.system_id} value={s.api_path_slug || s.system_id}>
                    {s.system_name || s.api_path_slug || s.system_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="filter-email" className="text-xs whitespace-nowrap">User email</Label>
              <Input
                id="filter-email"
                type="text"
                placeholder="Filter by email"
                className="h-9 w-40"
                value={userEmail}
                onChange={(e) => { setUserEmail(e.target.value); setPage(1); }}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchLogs()} disabled={loading}>
              Apply
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No log entries yet. Use an external frontend with an API token to generate logs.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">USER</th>
                      <th className="p-3 text-left font-medium">SYSTEM</th>
                      <th className="p-3 text-left font-medium">ROUTE</th>
                      <th className="p-3 text-left font-medium">METHOD</th>
                      <th className="p-3 text-left font-medium">STATUS</th>
                      <th className="p-3 text-left font-medium">TIMESTAMP</th>
                      <th className="p-3 text-left font-medium">EXECUTION TIME</th>
                      <th className="p-3 text-right font-medium">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.log_id} className="border-b hover:bg-muted/30">
                        <td className="p-3 text-muted-foreground">{log.user_email || '—'}</td>
                        <td className="p-3">{log.system_name || log.system_slug || '—'}</td>
                        <td className="p-3 font-mono text-xs truncate max-w-[220px]" title={log.route}>
                          {log.route || '—'}
                        </td>
                        <td className="p-3">
                          <MethodBadge method={log.method} />
                        </td>
                        <td className="p-3">
                          <StatusBadge status={log.status_code} />
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(log.created_at)}
                        </td>
                        <td className="p-3">
                          {log.response_time_ms != null ? `${log.response_time_ms}ms` : '—'}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailLog(log)}
                          >
                            View details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
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
            </>
          )}
        </CardContent>
      </Card>

      {detailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailLog(null)} aria-hidden />
          <Card className="relative z-10 w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Log details</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDetailLog(null)} aria-label="Close">
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><span className="font-medium text-muted-foreground">User:</span> {detailLog.user_email || '—'}</div>
              <div><span className="font-medium text-muted-foreground">System:</span> {detailLog.system_name || detailLog.system_slug || '—'}</div>
              <div><span className="font-medium text-muted-foreground">Route:</span> <span className="font-mono break-all">{detailLog.route || '—'}</span></div>
              <div><span className="font-medium text-muted-foreground">Method:</span> <MethodBadge method={detailLog.method} /></div>
              <div><span className="font-medium text-muted-foreground">Status:</span> <StatusBadge status={detailLog.status_code} /></div>
              <div><span className="font-medium text-muted-foreground">Timestamp:</span> {formatTimestamp(detailLog.created_at)}</div>
              <div><span className="font-medium text-muted-foreground">Execution time:</span> {detailLog.response_time_ms != null ? `${detailLog.response_time_ms}ms` : '—'}</div>
              {detailLog.log_id != null && (
                <div><span className="font-medium text-muted-foreground">Log ID:</span> {detailLog.log_id}</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
