import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ConfirmModal } from '@/components/ConfirmModal';
import { fetchWithToken } from '@/lib/api';

const ROLES = ['admin', 'user'];

export default function AdminUsers() {
  const PAGE_SIZE = 10;
  const [users, setUsers] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ email: '', fname: '', lname: '', role: 'user', is_active: true, password: '', system_permissions: [] });
  const [submitting, setSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [createForm, setCreateForm] = useState({
    email: '',
    fname: '',
    lname: '',
    password: '',
    role: 'user',
    is_active: true,
    system_permissions: [],
  });

  const { user, getToken } = useAuth();
  const validateCreatePayload = (payload) => {
    if (!String(payload.email || '').trim()) return 'Email is required';
    if (!String(payload.fname || '').trim()) return 'First name is required';
    if (!String(payload.lname || '').trim()) return 'Last name is required';
    if (!payload.role) return 'Role is required';
    if (!String(payload.password || '').trim() || String(payload.password || '').trim().length < 6) {
      return 'Password is required (min 6 chars)';
    }
    if (!Array.isArray(payload.system_permissions) || payload.system_permissions.length === 0) {
      return 'At least one system permission is required';
    }
    return null;
  };
  const validateEditPayload = (payload) => {
    if (!String(payload.email || '').trim()) return 'Email is required';
    if (!String(payload.fname || '').trim()) return 'First name is required';
    if (!String(payload.lname || '').trim()) return 'Last name is required';
    if (!payload.role) return 'Role is required';
    if (String(payload.password || '').trim() && String(payload.password || '').trim().length < 6) {
      return 'Password must be at least 6 characters';
    }
    if (!Array.isArray(payload.system_permissions) || payload.system_permissions.length === 0) {
      return 'At least one system permission is required';
    }
    return null;
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const idToken = await getToken(true);
      if (!idToken) {
        setError('Not signed in');
        setUsers([]);
        return;
      }
      const [usersData, systemsData] = await Promise.all([
        fetchWithToken('/api/admin/users', { method: 'GET' }, idToken),
        fetchWithToken('/api/systems', { method: 'GET' }, idToken),
      ]);
      setSystems(systemsData.systems || []);
      setUsers(usersData.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (user) fetchUsers();
  }, [user, fetchUsers]);

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

  const openEdit = (u) => {
    setEditingId(u.user_id);
    setForm({
      email: u.email || '',
      fname: u.fname || '',
      lname: u.lname || '',
      role: u.role || 'user',
      is_active: u.is_active !== false,
      password: '',
      system_permissions: Array.isArray(u.system_permissions)
        ? u.system_permissions.map((p) => Number(p.system_id)).filter((n) => !Number.isNaN(n))
        : [],
    });
    setError('');
  };

  const closeEdit = () => {
    setEditingId(null);
    setForm({ email: '', fname: '', lname: '', role: 'user', is_active: true, password: '', system_permissions: [] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId == null) return;
    setError('');
    const validationError = validateEditPayload(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await getToken(true);
      if (!idToken) throw new Error('Not signed in');
      await fetchWithToken(
        `/api/admin/users/${editingId}`,
        {
          method: 'PATCH',
          body: {
            email: form.email,
            fname: form.fname,
            lname: form.lname,
            role: form.role,
            is_active: form.is_active,
            password: form.password,
            system_permissions: form.system_permissions,
          },
        },
        idToken
      );
      closeEdit();
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleteLoading(true);
    setError('');
    try {
      const idToken = await getToken(true);
      if (!idToken) throw new Error('Not signed in');
      await fetchWithToken(`/api/admin/users/${id}`, { method: 'DELETE' }, idToken);
      setDeleteUserId(null);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openCreate = () => {
    setError('');
    setCreateForm({
      email: '',
      fname: '',
      lname: '',
      password: '',
      role: 'user',
      is_active: true,
      system_permissions: [],
    });
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateSubmitting(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateCreatePayload(createForm);
    if (validationError) {
      setError(validationError);
      return;
    }
    setCreateSubmitting(true);
    try {
      const idToken = await getToken(true);
      if (!idToken) throw new Error('Not signed in');
      await fetchWithToken(
        '/api/admin/users',
        { method: 'POST', body: createForm },
        idToken
      );
      closeCreate();
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Create failed');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleString();
    } catch {
      return String(d);
    }
  };
  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [
      u.user_id,
      u.email,
      u.fname,
      u.lname,
      u.role,
      u.firebase_uid,
    ].some((v) => String(v ?? '').toLowerCase().includes(q));
  });
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const getSystemPermissionLabel = (ids) => {
    if (!ids || ids.length === 0) return 'No system selected';
    const names = systems
      .filter((s) => ids.includes(Number(s.system_id)))
      .map((s) => s.system_name || `System ${s.system_id}`);
    return names.length ? names.join(', ') : 'No system selected';
  };

  useEffect(() => {
    setPage(1);
  }, [search, users.length]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Manage users</h2>
          <p className="text-muted-foreground">View and edit user roles and status.</p>
        </div>
        <Button onClick={openCreate}>Create user</Button>
      </div>

      {error && !editingId && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
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
                  placeholder="Search users..."
                  className="max-w-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <table style={{ width: '100%', minWidth: '700px' }} className="text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left font-medium">ID</th>
                    <th className="p-2 text-left font-medium">Email</th>
                    <th className="p-2 text-left font-medium">Name</th>
                    <th className="p-2 text-left font-medium">Role</th>
                    <th className="p-2 text-left font-medium">Active</th>
                    <th className="p-2 text-left font-medium">Last login</th>
                    <th className="p-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u) => (
                    <tr key={u.user_id} className="border-b">
                      <td className="p-2">{u.user_id}</td>
                      <td className="p-2">{u.email || '-'}</td>
                      <td className="p-2">{[u.fname, u.lname].filter(Boolean).join(' ') || '-'}</td>
                      <td className="p-2">{u.role || 'user'}</td>
                      <td className="p-2">{u.is_active !== false ? 'Yes' : 'No'}</td>
                      <td className="p-2">{formatDate(u.last_login)}</td>
                      <td className="p-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (openMenuId === u.user_id) {
                              setOpenMenuId(null);
                              setMenuAnchorRect(null);
                            } else {
                              setMenuAnchorRect(rect);
                              setOpenMenuId(u.user_id);
                            }
                          }}
                          aria-label="Actions"
                          aria-expanded={openMenuId === u.user_id}
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <circle cx="12" cy="6" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="18" r="1.5" />
                          </svg>
                        </Button>
                        {openMenuId === u.user_id && menuAnchorRect && createPortal(
                          <div
                            className="min-w-[120px] rounded-md border border-border bg-background py-1 shadow-lg"
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
                                openEdit(u);
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
                                setDeleteUserId(u.user_id);
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
              {filteredUsers.length > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({filteredUsers.length} items)
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

      {editingId != null && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeEdit}
            aria-hidden
          />
          <Card className="relative z-10 mx-4 w-full max-w-3xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Edit user</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={closeEdit} aria-label="Close">
                Close
              </Button>
            </CardHeader>
            <CardContent>
              {error && (
                <p className="mb-4 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
              )}
              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="edit-fname">First name</Label>
                    <Input id="edit-fname" value={form.fname} onChange={(e) => setForm((f) => ({ ...f, fname: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-lname">Last name</Label>
                    <Input id="edit-lname" value={form.lname} onChange={(e) => setForm((f) => ({ ...f, lname: e.target.value }))} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <select
                    id="edit-role"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Password (optional)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Leave blank to keep current password"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-system-permissions">System permissions</Label>
                  <details className="w-full rounded-md border border-input bg-background">
                    <summary className="cursor-pointer list-none px-3 py-2 text-sm">
                      {getSystemPermissionLabel(form.system_permissions)}
                    </summary>
                    <div className="max-h-48 overflow-auto border-t border-input p-2">
                      {systems.map((s) => {
                        const sid = Number(s.system_id);
                        const checked = form.system_permissions.includes(sid);
                        return (
                          <label key={s.system_id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setForm((f) => ({
                                  ...f,
                                  system_permissions: e.target.checked
                                    ? [...f.system_permissions, sid]
                                    : f.system_permissions.filter((id) => id !== sid),
                                }));
                              }}
                            />
                            <span>{s.system_name || `System ${s.system_id}`}</span>
                          </label>
                        );
                      })}
                    </div>
                  </details>
                </div>
                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    id="edit-active"
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <Label htmlFor="edit-active">Active</Label>
                </div>
                <div className="flex justify-end gap-2 pt-2 md:col-span-2">
                  <Button type="button" variant="outline" onClick={closeEdit}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Update'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
      {createOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeCreate}
            aria-hidden
          />
          <Card className="relative z-10 mx-4 w-full max-w-3xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Create user</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={closeCreate} aria-label="Close">
                Close
              </Button>
            </CardHeader>
            <CardContent>
              {error && (
                <p className="mb-4 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
              )}
              <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="create-fname">First name</Label>
                    <Input
                      id="create-fname"
                      value={createForm.fname}
                      onChange={(e) => setCreateForm((f) => ({ ...f, fname: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-lname">Last name</Label>
                    <Input
                      id="create-lname"
                      value={createForm.lname}
                      onChange={(e) => setCreateForm((f) => ({ ...f, lname: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-role">Role</Label>
                  <select
                    id="create-role"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={createForm.role}
                    onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">Password (for new Firebase account)</Label>
                  <Input
                    id="create-password"
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Minimum 6 characters"
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="create-system-permissions">System permissions</Label>
                  <details className="w-full rounded-md border border-input bg-background">
                    <summary className="cursor-pointer list-none px-3 py-2 text-sm">
                      {getSystemPermissionLabel(createForm.system_permissions)}
                    </summary>
                    <div className="max-h-48 overflow-auto border-t border-input p-2">
                      {systems.map((s) => {
                        const sid = Number(s.system_id);
                        const checked = createForm.system_permissions.includes(sid);
                        return (
                          <label key={s.system_id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setCreateForm((f) => ({
                                  ...f,
                                  system_permissions: e.target.checked
                                    ? [...f.system_permissions, sid]
                                    : f.system_permissions.filter((id) => id !== sid),
                                }));
                              }}
                            />
                            <span>{s.system_name || `System ${s.system_id}`}</span>
                          </label>
                        );
                      })}
                    </div>
                  </details>
                </div>
                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    id="create-active"
                    type="checkbox"
                    checked={createForm.is_active}
                    onChange={(e) => setCreateForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <Label htmlFor="create-active">Active</Label>
                </div>
                <div className="flex justify-end gap-2 pt-2 md:col-span-2">
                  <Button type="button" variant="outline" onClick={closeCreate}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createSubmitting}>
                    {createSubmitting ? 'Creating…' : 'Create'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
      <ConfirmModal
        open={deleteUserId != null}
        title="Delete user"
        message="Are you sure you want to delete this user?"
        confirmText="Delete"
        loading={deleteLoading}
        onCancel={() => setDeleteUserId(null)}
        onConfirm={() => handleDelete(deleteUserId)}
      />
    </div>
  );
}
