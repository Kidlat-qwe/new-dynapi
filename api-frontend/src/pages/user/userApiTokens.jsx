import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ConfirmModal } from '@/components/ConfirmModal';
import { fetchWithToken } from '@/lib/api';

const EXPIRATION_OPTIONS = [
  { value: '3d', label: '3 days' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '1 month' },
  { value: 'none', label: 'No expiry' },
];

export default function UserApiTokens() {
  const PAGE_SIZE = 10;
  const { getToken } = useAuth();
  const [tokens, setTokens] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ token_name: '', system_id: '', expiration: '7d' });
  const [submitting, setSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchSystems = useCallback(async () => {
    const token = await getToken(true);
    const data = await fetchWithToken('/api/systems', { method: 'GET' }, token);
    setSystems(data.systems || []);
  }, [getToken]);

  const fetchTokens = useCallback(async () => {
    const token = await getToken(true);
    const data = await fetchWithToken('/api/users/api-tokens', { method: 'GET' }, token);
    setTokens(data.tokens || []);
  }, [getToken]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSystems(), fetchTokens()])
      .catch((err) => setError(err.message || 'Failed to load tokens'))
      .finally(() => setLoading(false));
  }, [fetchSystems, fetchTokens]);

  useEffect(() => {
    if (openMenuId === null) return;
    const close = () => {
      setOpenMenuId(null);
      setMenuAnchorRect(null);
    };
    const t = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
    };
  }, [openMenuId]);

  const filteredTokens = tokens.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [t.api_token_id, t.token_name, t.system_name, t.token_prefix].some((v) =>
      String(v ?? '').toLowerCase().includes(q)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredTokens.length / PAGE_SIZE));
  const paginatedTokens = filteredTokens.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search, tokens.length]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const token = await getToken(true);
      const data = await fetchWithToken('/api/users/api-tokens', { method: 'POST', body: { ...form, system_id: Number(form.system_id) } }, token);
      setCreatedToken(data.token);
      await fetchTokens();
    } catch (err) {
      setError(err.message || 'Failed to create token');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id) => {
    setConfirmLoading(true);
    try {
      const token = await getToken(true);
      await fetchWithToken(`/api/users/api-tokens/${id}`, { method: 'PATCH' }, token);
      setConfirmAction(null);
      await fetchTokens();
    } catch (err) {
      setError(err.message || 'Failed to revoke token');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setConfirmLoading(true);
    try {
      const token = await getToken(true);
      await fetchWithToken(`/api/users/api-tokens/${id}`, { method: 'DELETE' }, token);
      setConfirmAction(null);
      await fetchTokens();
    } catch (err) {
      setError(err.message || 'Failed to delete token');
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">API tokens</h2>
          <p className="text-muted-foreground">Generate tokens for your systems.</p>
        </div>
        <Button onClick={() => { setCreatedToken(null); setModalOpen(true); }}>Create token</Button>
      </div>
      {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader><CardTitle>My tokens</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
            <div className="overflow-x-auto rounded-lg border">
              <div className="p-3">
                <Input placeholder="Search tokens..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <table className="w-full text-sm" style={{ minWidth: '700px' }}>
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">ID</th>
                    <th className="p-3 text-left font-medium">Name</th>
                    <th className="p-3 text-left font-medium">System</th>
                    <th className="p-3 text-left font-medium">Prefix</th>
                    <th className="p-3 text-left font-medium">Expires</th>
                    <th className="p-3 text-left font-medium">Active</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTokens.map((t) => (
                    <tr key={t.api_token_id} className="border-b">
                      <td className="p-3">{t.api_token_id}</td>
                      <td className="p-3">{t.token_name || '-'}</td>
                      <td className="p-3">{t.system_name || '-'}</td>
                      <td className="p-3 font-mono text-xs">{t.token_prefix || '-'}</td>
                      <td className="p-3">{t.expires_at ? new Date(t.expires_at).toLocaleString() : 'No expiry'}</td>
                      <td className="p-3">{t.is_active ? 'Yes' : 'No'}</td>
                      <td className="p-3 text-right">
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (openMenuId === t.api_token_id) {
                            setOpenMenuId(null);
                            setMenuAnchorRect(null);
                          } else {
                            setOpenMenuId(t.api_token_id);
                            setMenuAnchorRect(rect);
                          }
                        }}>
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <circle cx="12" cy="6" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="18" r="1.5" />
                          </svg>
                        </Button>
                        {openMenuId === t.api_token_id && menuAnchorRect && createPortal(
                          <div className="min-w-[140px] rounded-md border border-border bg-background py-1 shadow-lg" style={{
                            position: 'fixed',
                            top: (window.innerHeight - menuAnchorRect.bottom < 180) ? menuAnchorRect.top : menuAnchorRect.bottom,
                            right: window.innerWidth - menuAnchorRect.right,
                            transform: (window.innerHeight - menuAnchorRect.bottom < 180) ? 'translateY(-100%)' : 'none',
                            zIndex: 9999,
                          }}>
                            {t.is_active && <button type="button" className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-muted" onClick={() => setConfirmAction({ type: 'revoke', id: t.api_token_id })}>Revoke</button>}
                            <button type="button" className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-muted" onClick={() => setConfirmAction({ type: 'delete', id: t.api_token_id })}>Delete</button>
                          </div>,
                          document.body
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between p-3">
                <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({filteredTokens.length} items)</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} aria-hidden />
          <Card className="relative z-10 mx-4 w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{createdToken ? 'Token created' : 'Create API token'}</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent>
              {createdToken ? (
                <div className="space-y-3">
                  <p className="text-sm text-amber-600 dark:text-amber-500">Copy the token now; it will not be shown again.</p>
                  <Input readOnly value={createdToken} className="font-mono text-xs" />
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-3">
                  <div className="space-y-2">
                    <Label>Token name</Label>
                    <Input value={form.token_name} onChange={(e) => setForm((f) => ({ ...f, token_name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>System</Label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.system_id} onChange={(e) => setForm((f) => ({ ...f, system_id: e.target.value }))} required>
                      <option value="">Select system...</option>
                      {systems.map((s) => <option key={s.system_id} value={s.system_id}>{s.system_name || s.system_id}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiration</Label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.expiration} onChange={(e) => setForm((f) => ({ ...f, expiration: e.target.value }))} required>
                      {EXPIRATION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'delete' ? 'Delete API token' : 'Revoke API token'}
        message={confirmAction?.type === 'delete' ? 'Permanently delete this token?' : 'Revoke this token?'}
        confirmText={confirmAction?.type === 'delete' ? 'Delete' : 'Revoke'}
        loading={confirmLoading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          return confirmAction.type === 'delete' ? handleDelete(confirmAction.id) : handleRevoke(confirmAction.id);
        }}
      />
    </div>
  );
}
