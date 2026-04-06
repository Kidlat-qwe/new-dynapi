import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { API_BASE, fetchWithToken } from '@/lib/api';

function KeyIcon({ className = 'h-5 w-5 text-blue-600' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'h-5 w-5 text-green-600' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartBarIcon({ className = 'h-5 w-5 text-purple-600' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ClockIcon({ className = 'h-5 w-5 text-orange-600' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function AdminApiTokens() {
  const { user, getToken } = useAuth();
  const [tokens, setTokens] = useState([]);
  const [systems, setSystems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const EXPIRATION_OPTIONS = [
    { value: '3d', label: '3 days' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '1 month' },
    { value: 'none', label: 'No expiry' },
  ];

  const [form, setForm] = useState({ token_name: '', system_id: '', expiration: '' });
  const [submitting, setSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState(null);

  const fetchTokens = useCallback(async () => {
    const idToken = await getToken(true);
    if (!idToken) return;
    try {
      const data = await fetchWithToken('/api/admin/api-tokens', { method: 'GET' }, idToken);
      setTokens(data.tokens || []);
    } catch {
      setTokens([]);
    }
  }, [getToken]);

  const fetchStats = useCallback(async () => {
    const idToken = await getToken(true);
    if (!idToken) return;
    try {
      const data = await fetchWithToken('/api/admin/api-tokens/stats', { method: 'GET' }, idToken);
      setStats(data);
    } catch {
      setStats(null);
    }
  }, [getToken]);

  useEffect(() => {
    fetch(`${API_BASE}/api/systems`)
      .then((res) => res.json())
      .then((data) => setSystems(data.systems || []))
      .catch(() => setSystems([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError('');
    Promise.all([fetchTokens(), fetchStats()]).finally(() => setLoading(false));
  }, [user, fetchTokens, fetchStats]);

  const openAdd = () => {
    setForm({ token_name: '', system_id: systems[0]?.system_id ?? '', expiration: '7d' });
    setCreatedToken(null);
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setCreatedToken(null);
    setForm({ token_name: '', system_id: '', expiration: '' });
    setError('');
    if (createdToken) {
      fetchTokens();
      fetchStats();
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const idToken = await getToken(true);
      if (!idToken) throw new Error('Not signed in');
      if (!form.system_id) throw new Error('Select a system');
      if (!form.expiration) throw new Error('Select an expiration');
      const payload = {
        token_name: form.token_name.trim(),
        system_id: Number(form.system_id),
        expiration: form.expiration,
      };
      const data = await fetchWithToken('/api/admin/api-tokens', { method: 'POST', body: payload }, idToken);
      setCreatedToken(data.token);
      setForm((f) => ({ ...f }));
    } catch (err) {
      setError(err.message || 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id) => {
    setError('');
    try {
      const idToken = await getToken(true);
      if (!idToken) throw new Error('Not signed in');
      await fetchWithToken(`/api/admin/api-tokens/${id}`, { method: 'PATCH' }, idToken);
      setRevokeConfirmId(null);
      fetchTokens();
      fetchStats();
    } catch (err) {
      setError(err.message || 'Revoke failed');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleString();
    } catch {
      return String(d);
    }
  };

  const totalTokens = stats?.total_tokens ?? tokens.length;
  const activeTokens = stats?.active_tokens ?? tokens.filter((t) => t.is_active).length;
  const totalRequests = stats?.total_requests ?? 0;
  const avgResponseTimeMs = stats?.avg_response_time_ms;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">API tokens</h2>
          <p className="text-muted-foreground">Create and revoke API tokens for users.</p>
        </div>
        <Button onClick={openAdd}>Create token</Button>
      </div>

      {error && !modalOpen && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
      )}

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-2xl font-bold">{totalTokens}</p>
              <p className="text-sm text-muted-foreground">API Keys</p>
            </div>
            <KeyIcon className="h-10 w-10 text-blue-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-2xl font-bold">{activeTokens}</p>
              <p className="text-sm text-muted-foreground">Currently active</p>
            </div>
            <CheckCircleIcon className="h-10 w-10 text-green-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-2xl font-bold">{totalRequests.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">API calls</p>
            </div>
            <ChartBarIcon className="h-10 w-10 text-purple-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-2xl font-bold">{avgResponseTimeMs != null ? `${avgResponseTimeMs}ms` : '—'}</p>
              <p className="text-sm text-muted-foreground">Response time</p>
            </div>
            <ClockIcon className="h-10 w-10 text-orange-600" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API tokens yet. Create one to get started.</p>
          ) : (
            <div
              className="overflow-x-auto rounded-lg"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e0 #f7fafc',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <table style={{ width: '100%', minWidth: '700px' }} className="text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left font-medium">ID</th>
                    <th className="p-2 text-left font-medium">Name</th>
                    <th className="p-2 text-left font-medium">System</th>
                    <th className="p-2 text-left font-medium">Prefix</th>
                    <th className="p-2 text-left font-medium">Expires</th>
                    <th className="p-2 text-left font-medium">Active</th>
                    <th className="p-2 text-left font-medium">Created</th>
                    <th className="p-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t) => (
                    <tr key={t.api_token_id} className="border-b">
                      <td className="p-2">{t.api_token_id}</td>
                      <td className="p-2">{t.token_name || '-'}</td>
                      <td className="p-2">{t.system_name || (t.permissions ? `ID ${t.permissions}` : '-')}</td>
                      <td className="p-2 font-mono text-xs">{t.token_prefix || '-'}</td>
                      <td className="p-2">{t.expires_at ? formatDate(t.expires_at) : 'No expiry'}</td>
                      <td className="p-2">{t.is_active ? 'Yes' : 'No'}</td>
                      <td className="p-2">{formatDate(t.created_at)}</td>
                      <td className="p-2 text-right">
                        {t.is_active ? (
                          revokeConfirmId === t.api_token_id ? (
                            <>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="mr-1"
                                onClick={() => handleRevoke(t.api_token_id)}
                              >
                                Confirm
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setRevokeConfirmId(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setRevokeConfirmId(t.api_token_id)}
                            >
                              Revoke
                            </Button>
                          )
                        ) : (
                          <span className="text-muted-foreground">Revoked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} aria-hidden />
          <Card className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{createdToken ? 'Token created' : 'Create API token'}</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={closeModal} aria-label="Close">
                Close
              </Button>
            </CardHeader>
            <CardContent>
              {createdToken ? (
                <div className="space-y-4">
                  <p className="text-sm text-amber-600 dark:text-amber-500">
                    Copy the token now; it will not be shown again.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={createdToken}
                      className="font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(createdToken)}
                    >
                      Copy
                    </Button>
                  </div>
                  <Button type="button" onClick={closeModal}>
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  {error && (
                    <p className="mb-4 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
                  )}
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="token-name">Token name</Label>
                      <Input
                        id="token-name"
                        value={form.token_name}
                        onChange={(e) => setForm((f) => ({ ...f, token_name: e.target.value }))}
                        placeholder="e.g. Postman Funtalk"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="token-system">System</Label>
                      <select
                        id="token-system"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={form.system_id}
                        onChange={(e) => setForm((f) => ({ ...f, system_id: e.target.value }))}
                        required
                      >
                        <option value="">Select system...</option>
                        {systems.map((s) => (
                          <option key={s.system_id} value={s.system_id}>
                            {s.system_name || s.system_id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="token-expiration">Expiration</Label>
                      <select
                        id="token-expiration"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={form.expiration}
                        onChange={(e) => setForm((f) => ({ ...f, expiration: e.target.value }))}
                        required
                      >
                        <option value="">Select expiration...</option>
                        {EXPIRATION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={closeModal}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? 'Creating…' : 'Create'}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
