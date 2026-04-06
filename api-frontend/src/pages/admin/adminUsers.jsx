import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { fetchWithToken } from '@/lib/api';

const ROLES = ['admin', 'user'];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ role: 'user', is_active: true });
  const [submitting, setSubmitting] = useState(false);

  const { user, getToken } = useAuth();

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
      const data = await fetchWithToken('/api/admin/users', { method: 'GET' }, idToken);
      setUsers(data.users || []);
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

  const openEdit = (u) => {
    setEditingId(u.user_id);
    setForm({
      role: u.role || 'user',
      is_active: u.is_active !== false,
    });
    setError('');
  };

  const closeEdit = () => {
    setEditingId(null);
    setForm({ role: 'user', is_active: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId == null) return;
    setError('');
    setSubmitting(true);
    try {
      const idToken = await getToken(true);
      if (!idToken) throw new Error('Not signed in');
      await fetchWithToken(
        `/api/admin/users/${editingId}`,
        { method: 'PATCH', body: { role: form.role, is_active: form.is_active } },
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

  const formatDate = (d) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleString();
    } catch {
      return String(d);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Manage users</h2>
        <p className="text-muted-foreground">View and edit user roles and status.</p>
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
          ) : users.length === 0 ? (
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
                  {users.map((u) => (
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
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeEdit}
            aria-hidden
          />
          <Card className="relative z-10 w-full max-w-md">
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
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <div className="flex items-center gap-2">
                  <input
                    id="edit-active"
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <Label htmlFor="edit-active">Active</Label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
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
        </div>
      )}
    </div>
  );
}
