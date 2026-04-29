import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ConfirmModal } from '@/components/ConfirmModal';
import { API_BASE } from '@/lib/api';

const DB_TYPES = ['PostgreSQL', 'MySQL', 'MongoDB', 'Other'];

const emptyForm = () => ({
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

export default function AdminSystems() {
  const PAGE_SIZE = 10;
  const navigate = useNavigate();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteSystemId, setConfirmDeleteSystemId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [connectionTestId, setConnectionTestId] = useState(null);
  const [connectionTestResult, setConnectionTestResult] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Close actions menu when clicking outside
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

  const fetchSystems = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/systems`)
      .then((res) => res.json())
      .then((data) => setSystems(data.systems || []))
      .catch(() => setSystems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSystems();
  }, [fetchSystems]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
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
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
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
    if (editingId && form.database_password === '') {
      // Leave password unchanged when editing and field empty
    } else {
      payload.database_password = form.database_password || null;
    }
    try {
      if (editingId) {
        const res = await fetch(`${API_BASE}/api/systems/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
      } else {
        const res = await fetch(`${API_BASE}/api/systems`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Create failed');
      }
      closeModal();
      fetchSystems();
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setError('');
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/systems/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setConfirmDeleteSystemId(null);
      fetchSystems();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleTestConnection = async (id) => {
    setConnectionTestId(id);
    setConnectionTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/systems/${id}/connection-test`);
      const data = await res.json().catch(() => ({}));
      setConnectionTestResult({
        ok: data.connected === true,
        message: data.message || (data.connected ? 'Connected' : 'Failed'),
      });
    } catch (err) {
      setConnectionTestResult({ ok: false, message: err.message || 'Request failed' });
    } finally {
      setConnectionTestId(null);
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
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Systems</h2>
          <p className="text-muted-foreground">Manage system/database configurations.</p>
        </div>
        <Button onClick={openAdd}>Add system</Button>
      </div>

      {error && !modalOpen && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
      )}
      {connectionTestResult && (
        <p className={`rounded-md p-2 text-sm ${connectionTestResult.ok ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
          DB connection: {connectionTestResult.message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Systems config</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filteredSystems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No systems configured yet. Add one to get started.</p>
          ) : (
            <div
              className="overflow-x-auto rounded-lg"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e0 #f7fafc',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div className="mb-3">
                <Input
                  placeholder="Search systems..."
                  className="max-w-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <table style={{ width: '100%', minWidth: '700px' }} className="text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left font-medium">ID</th>
                    <th className="p-2 text-left font-medium">Name</th>
                    <th className="p-2 text-left font-medium">DB type</th>
                    <th className="p-2 text-left font-medium">Host</th>
                    <th className="p-2 text-left font-medium">API path</th>
                    <th className="p-2 text-left font-medium">Owner</th>
                    <th className="p-2 text-left font-medium">Active</th>
                    <th className="p-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSystems.map((s) => (
                    <tr key={s.system_id} className="border-b">
                      <td className="p-2">{s.system_id}</td>
                      <td className="p-2">{s.system_name || '-'}</td>
                      <td className="p-2">{s.database_type || '-'}</td>
                      <td className="p-2">{s.database_host || '-'}</td>
                      <td className="p-2">{s.api_path_slug ? `/api/${s.api_path_slug}/...` : '-'}</td>
                      <td className="p-2">{s.owner_email || (s.created_by_firebase_uid ? 'user-owned' : 'admin')}</td>
                      <td className="p-2">{s.is_active ? 'Yes' : 'No'}</td>
                      <td className="p-2 text-right">
                        <>
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
                                  top: (window.innerHeight - menuAnchorRect.bottom < 200) ? menuAnchorRect.top : menuAnchorRect.bottom,
                                  right: window.innerWidth - menuAnchorRect.right,
                                  transform: (window.innerHeight - menuAnchorRect.bottom < 200) ? 'translateY(-100%)' : 'none',
                                  zIndex: 9999,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                                  onClick={() => {
                                    navigate(`/admin/systems/${s.system_id}/routes`);
                                    setOpenMenuId(null);
                                    setMenuAnchorRect(null);
                                  }}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                                  disabled={connectionTestId !== null}
                                  onClick={() => {
                                    handleTestConnection(s.system_id);
                                    setOpenMenuId(null);
                                    setMenuAnchorRect(null);
                                  }}
                                >
                                  {connectionTestId === s.system_id ? 'Testing…' : 'Test DB'}
                                </button>
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
                                    setConfirmDeleteSystemId(s.system_id);
                                    setOpenMenuId(null);
                                    setMenuAnchorRect(null);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>,
                              document.body
                            )}
                        </>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSystems.length > 0 && (
                <div className="mt-4 flex items-center justify-between">
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
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
            aria-hidden
          />
          <Card className="relative z-10 mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{editingId ? 'Edit system' : 'Add system'}</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={closeModal} aria-label="Close">
                Close
              </Button>
            </CardHeader>
            <CardContent>
              {error && (
                <p className="mb-4 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="system_name">System name</Label>
                  <Input
                    id="system_name"
                    value={form.system_name}
                    onChange={(e) => setForm((f) => ({ ...f, system_name: e.target.value }))}
                    placeholder="e.g. Production DB"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="system_description">Description</Label>
                  <Input
                    id="system_description"
                    value={form.system_description}
                    onChange={(e) => setForm((f) => ({ ...f, system_description: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="database_type">Database type</Label>
                  <select
                    id="database_type"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={form.database_type}
                    onChange={(e) => setForm((f) => ({ ...f, database_type: e.target.value }))}
                  >
                    <option value="">Select...</option>
                    {DB_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="database_host">Host</Label>
                    <Input
                      id="database_host"
                      value={form.database_host}
                      onChange={(e) => setForm((f) => ({ ...f, database_host: e.target.value }))}
                      placeholder="localhost"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="database_port">Port</Label>
                    <Input
                      id="database_port"
                      type="number"
                      value={form.database_port}
                      onChange={(e) => setForm((f) => ({ ...f, database_port: e.target.value }))}
                      placeholder="5432"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="database_name">Database name</Label>
                  <Input
                    id="database_name"
                    value={form.database_name}
                    onChange={(e) => setForm((f) => ({ ...f, database_name: e.target.value }))}
                    placeholder="dbname"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="database_user">User</Label>
                    <Input
                      id="database_user"
                      value={form.database_user}
                      onChange={(e) => setForm((f) => ({ ...f, database_user: e.target.value }))}
                      placeholder="user"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="database_password">Password</Label>
                    <Input
                      id="database_password"
                      type="password"
                      value={form.database_password}
                      onChange={(e) => setForm((f) => ({ ...f, database_password: e.target.value }))}
                      placeholder={editingId ? 'Leave blank to keep' : ''}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.database_ssl}
                      onChange={(e) => setForm((f) => ({ ...f, database_ssl: e.target.checked }))}
                      className="rounded border-input"
                    />
                    SSL
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                      className="rounded border-input"
                    />
                    Active
                  </label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="external_base_url">External base URL</Label>
                  <Input
                    id="external_base_url"
                    value={form.external_base_url}
                    onChange={(e) => setForm((f) => ({ ...f, external_base_url: e.target.value }))}
                    placeholder="http://localhost:3001/api"
                  />
                  <p className="text-xs text-muted-foreground">Base URL for proxy (e.g. Funtalk backend).</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_path_slug">API path slug</Label>
                  <Input
                    id="api_path_slug"
                    value={form.api_path_slug}
                    onChange={(e) => setForm((f) => ({ ...f, api_path_slug: e.target.value }))}
                    placeholder="funtalk"
                  />
                  <p className="text-xs text-muted-foreground">When set, proxied at /api/[slug]/... (e.g. /api/funtalk/users).</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={closeModal}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : editingId ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
      <ConfirmModal
        open={confirmDeleteSystemId != null}
        title="Delete system"
        message="Are you sure you want to delete this system?"
        confirmText="Delete"
        onCancel={() => setConfirmDeleteSystemId(null)}
        onConfirm={() => handleDelete(confirmDeleteSystemId)}
        loading={deleting}
      />
    </div>
  );
}
