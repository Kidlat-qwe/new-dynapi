import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fetchWithToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/Label';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function UserSystems() {
  const PAGE_SIZE = 10;
  const { getToken } = useAuth();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({
    system_name: '',
    system_description: '',
    database_type: '',
    database_host: '',
    database_port: '',
    database_name: '',
    database_user: '',
    database_password: '',
    database_ssl: false,
    is_active: true,
    external_base_url: '',
    api_path_slug: '',
  });

  const loadSystems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken(true);
      const data = await fetchWithToken('/api/systems', { method: 'GET' }, token);
      setSystems(data.systems || []);
    } catch (err) {
      setError(err.message || 'Failed to load systems');
      setSystems([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadSystems();
  }, [loadSystems]);

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

  const openAdd = () => {
    setEditingId(null);
    setForm({
      system_name: '',
      system_description: '',
      database_type: '',
      database_host: '',
      database_port: '',
      database_name: '',
      database_user: '',
      database_password: '',
      database_ssl: false,
      is_active: true,
      external_base_url: '',
      api_path_slug: '',
    });
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditingId(s.system_id);
    setForm({
      system_name: s.system_name ?? '',
      system_description: s.system_description ?? '',
      database_type: s.database_type ?? '',
      database_host: s.database_host ?? '',
      database_port: s.database_port != null ? String(s.database_port) : '',
      database_name: s.database_name ?? '',
      database_user: s.database_user ?? '',
      database_password: '',
      database_ssl: Boolean(s.database_ssl),
      is_active: s.is_active !== false,
      external_base_url: s.external_base_url ?? '',
      api_path_slug: s.api_path_slug ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const token = await getToken(true);
      const payload = {
        system_name: form.system_name || null,
        system_description: form.system_description || null,
        database_type: form.database_type || null,
        database_host: form.database_host || null,
        database_port: form.database_port ? Number(form.database_port) : null,
        database_name: form.database_name || null,
        database_user: form.database_user || null,
        database_ssl: form.database_ssl,
        is_active: form.is_active,
        external_base_url: form.external_base_url || null,
        api_path_slug: form.api_path_slug || null,
      };
      if (!editingId || form.database_password !== '') {
        payload.database_password = form.database_password || null;
      }
      if (editingId) {
        await fetchWithToken(`/api/systems/${editingId}`, { method: 'PUT', body: payload }, token);
      } else {
        await fetchWithToken('/api/systems', { method: 'POST', body: payload }, token);
      }
      setModalOpen(false);
      await loadSystems();
    } catch (err) {
      setError(err.message || 'Failed to save system');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      const token = await getToken(true);
      await fetchWithToken(`/api/systems/${id}`, { method: 'DELETE' }, token);
      setDeletingId(null);
      await loadSystems();
    } catch (err) {
      setError(err.message || 'Failed to delete system');
    }
  };

  const filteredSystems = systems.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [
      s.system_id,
      s.system_name,
      s.system_description,
      s.database_type,
      s.database_host,
      s.api_path_slug,
    ].some((v) => String(v ?? '').toLowerCase().includes(q));
  });
  const totalPages = Math.max(1, Math.ceil(filteredSystems.length / PAGE_SIZE));
  const paginatedSystems = filteredSystems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, systems.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">My Systems</h2>
        <p className="text-muted-foreground">Systems you can access.</p>
      </div>
      <div>
        <Button onClick={openAdd}>Add system</Button>
      </div>

      {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Assigned systems</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filteredSystems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No systems found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <div className="p-3">
                <Input
                  placeholder="Search systems..."
                  className="max-w-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <table className="w-full text-sm" style={{ minWidth: '700px' }}>
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">ID</th>
                    <th className="p-3 text-left font-medium">Name</th>
                    <th className="p-3 text-left font-medium">DB Type</th>
                    <th className="p-3 text-left font-medium">Host</th>
                    <th className="p-3 text-left font-medium">API Path</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSystems.map((s) => (
                    <tr key={s.system_id} className="border-b">
                      <td className="p-3">{s.system_id}</td>
                      <td className="p-3">{s.system_name || '-'}</td>
                      <td className="p-3">{s.database_type || '-'}</td>
                      <td className="p-3">{s.database_host || '-'}</td>
                      <td className="p-3">{s.api_path_slug ? `/api/${s.api_path_slug}/...` : '-'}</td>
                      <td className="p-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (openMenuId === s.system_id) {
                              setOpenMenuId(null);
                              setMenuAnchorRect(null);
                            } else {
                              setMenuAnchorRect(rect);
                              setOpenMenuId(s.system_id);
                            }
                          }}
                          aria-label="Actions"
                          aria-expanded={openMenuId === s.system_id}
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <circle cx="12" cy="6" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="18" r="1.5" />
                          </svg>
                        </Button>
                        {openMenuId === s.system_id && menuAnchorRect && createPortal(
                          <div
                            className="min-w-[140px] rounded-md border border-border bg-background py-1 shadow-lg"
                            style={{
                              position: 'fixed',
                              top: (window.innerHeight - menuAnchorRect.bottom < 160) ? menuAnchorRect.top : menuAnchorRect.bottom,
                              right: window.innerWidth - menuAnchorRect.right,
                              transform: (window.innerHeight - menuAnchorRect.bottom < 160) ? 'translateY(-100%)' : 'none',
                              zIndex: 9999,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => {
                                openEdit(s);
                                setOpenMenuId(null);
                                setMenuAnchorRect(null);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                              onClick={() => {
                                setDeletingId(s.system_id);
                                setOpenMenuId(null);
                                setMenuAnchorRect(null);
                              }}
                            >
                              Delete
                            </button>
                          </div>,
                          document.body
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between p-3">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({filteredSystems.length} items)
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
            </div>
          )}
        </CardContent>
      </Card>

      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} aria-hidden />
          <Card className="relative z-10 mx-4 w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{editingId ? 'Edit system' : 'Add system'}</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                Close
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label>System name</Label>
                  <Input value={form.system_name} onChange={(e) => setForm((f) => ({ ...f, system_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={form.system_description} onChange={(e) => setForm((f) => ({ ...f, system_description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>DB type</Label>
                    <Input value={form.database_type} onChange={(e) => setForm((f) => ({ ...f, database_type: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Host</Label>
                    <Input value={form.database_host} onChange={(e) => setForm((f) => ({ ...f, database_host: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input type="number" value={form.database_port} onChange={(e) => setForm((f) => ({ ...f, database_port: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Database name</Label>
                    <Input value={form.database_name} onChange={(e) => setForm((f) => ({ ...f, database_name: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>User</Label>
                    <Input value={form.database_user} onChange={(e) => setForm((f) => ({ ...f, database_user: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" value={form.database_password} onChange={(e) => setForm((f) => ({ ...f, database_password: e.target.value }))} placeholder={editingId ? 'Leave blank to keep' : ''} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>External base URL</Label>
                    <Input value={form.external_base_url} onChange={(e) => setForm((f) => ({ ...f, external_base_url: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>API path slug</Label>
                    <Input value={form.api_path_slug} onChange={(e) => setForm((f) => ({ ...f, api_path_slug: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
      <ConfirmModal
        open={deletingId != null}
        title="Delete system"
        message="Are you sure you want to delete this system?"
        confirmText="Delete"
        onCancel={() => setDeletingId(null)}
        onConfirm={() => handleDelete(deletingId)}
      />
    </div>
  );
}
