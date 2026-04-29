import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ConfirmModal } from '@/components/ConfirmModal';
import { fetchWithToken } from '@/lib/api';

function parseEnvSecrets(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      if (idx < 1) return null;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return key ? { secret_key: key, secret_value: value } : null;
    })
    .filter(Boolean);
}

function parseJsonSecrets(text) {
  const parsed = JSON.parse(String(text || '{}'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  return Object.entries(parsed)
    .filter(([k]) => k && typeof k === 'string')
    .map(([secret_key, secret_value]) => ({
      secret_key: String(secret_key).trim(),
      secret_value: secret_value == null ? '' : String(secret_value),
    }))
    .filter((x) => x.secret_key);
}

const emptyForm = {
  secret_key: '',
  secret_value: '',
  description: '',
  expires_at: '',
};

export default function UserSecrets() {
  const PAGE_SIZE = 10;
  const { getToken } = useAuth();
  const [systems, setSystems] = useState([]);
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const [search, setSearch] = useState('');
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [bulkFormat, setBulkFormat] = useState('env');
  const [bulkText, setBulkText] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState(null);
  const [revealedValues, setRevealedValues] = useState({});
  const [revealingId, setRevealingId] = useState(null);
  const [confirmDeleteSecretId, setConfirmDeleteSecretId] = useState(null);
  const [page, setPage] = useState(1);

  const selectedSystem = useMemo(
    () => systems.find((s) => String(s.system_id) === String(selectedSystemId)) || null,
    [systems, selectedSystemId]
  );

  const loadSystems = useCallback(async () => {
    const token = await getToken(true);
    const data = await fetchWithToken('/api/systems', { method: 'GET' }, token);
    const list = data.systems || [];
    setSystems(list);
    if (!selectedSystemId && list[0]?.system_id) {
      setSelectedSystemId(String(list[0].system_id));
    }
  }, [getToken, selectedSystemId]);

  const loadSecrets = useCallback(async () => {
    const token = await getToken(true);
    const params = new URLSearchParams();
    if (selectedSystemId) params.set('system_id', selectedSystemId);
    if (search.trim()) params.set('key', search.trim());
    const data = await fetchWithToken(`/api/secrets?${params.toString()}`, { method: 'GET' }, token);
    setSecrets(data.secrets || []);
  }, [getToken, selectedSystemId, search]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loadSystems();
      await loadSecrets();
    } catch (err) {
      setError(err.message || 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  }, [loadSecrets, loadSystems]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedSystemId) return;
    loadSecrets().catch(() => {});
  }, [selectedSystemId, search, loadSecrets]);

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
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (secret) => {
    setEditing(secret);
    setForm({
      secret_key: secret.secret_key || '',
      secret_value: '',
      description: secret.description || '',
      expires_at: secret.expires_at ? String(secret.expires_at).slice(0, 16) : '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedSystemId) {
      setError('Select a system first');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const token = await getToken(true);
      const payload = {
        system_id: Number(selectedSystemId),
        secret_key: form.secret_key.trim(),
        description: form.description || null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };
      if (!editing || form.secret_value !== '') {
        payload.secret_value = form.secret_value;
      }
      if (editing?.secret_id) {
        await fetchWithToken(`/api/secrets/${editing.secret_id}`, { method: 'PUT', body: payload }, token);
      } else {
        await fetchWithToken('/api/secrets', { method: 'POST', body: payload }, token);
      }
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadSecrets();
    } catch (err) {
      setError(err.message || 'Failed to save secret');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (secretId) => {
    setError('');
    try {
      const token = await getToken(true);
      await fetchWithToken(`/api/secrets/${secretId}`, { method: 'DELETE' }, token);
      await loadSecrets();
    } catch (err) {
      setError(err.message || 'Failed to delete secret');
    }
  };

  const handleBulkImport = async () => {
    if (!selectedSystemId) {
      setError('Select a system first');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const items =
        bulkFormat === 'json' ? parseJsonSecrets(bulkText) : parseEnvSecrets(bulkText);
      if (!items.length) {
        throw new Error('No valid secrets found in the pasted content');
      }
      const token = await getToken(true);
      await fetchWithToken(
        '/api/secrets/bulk-import',
        {
          method: 'POST',
          body: {
            system_id: Number(selectedSystemId),
            items,
          },
        },
        token
      );
      setBulkOpen(false);
      setBulkText('');
      await loadSecrets();
    } catch (err) {
      setError(err.message || 'Bulk import failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleReveal = async (secret) => {
    if (!secret?.secret_id) return;
    if (revealedValues[secret.secret_id] !== undefined) {
      setRevealedValues((prev) => {
        const next = { ...prev };
        delete next[secret.secret_id];
        return next;
      });
      return;
    }
    try {
      setRevealingId(secret.secret_id);
      const token = await getToken(true);
      const data = await fetchWithToken(`/api/secrets/${secret.secret_id}/reveal`, { method: 'GET' }, token);
      setRevealedValues((prev) => ({ ...prev, [secret.secret_id]: data.secret_value ?? '' }));
    } catch (err) {
      setError(err.message || 'Failed to reveal secret');
    } finally {
      setRevealingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(secrets.length / PAGE_SIZE));
  const paginatedSecrets = secrets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [selectedSystemId, search, secrets.length]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Secrets</h2>
          <p className="text-muted-foreground">Manage .env-style secrets per system.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>Bulk import</Button>
          <Button onClick={openAdd}>Add secret</Button>
        </div>
      </div>

      {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={selectedSystemId}
              onChange={(e) => setSelectedSystemId(e.target.value)}
            >
              <option value="">Select system</option>
              {systems.map((s) => (
                <option key={s.system_id} value={s.system_id}>
                  {s.system_name || s.api_path_slug || `System ${s.system_id}`}
                </option>
              ))}
            </select>
            <Input
              placeholder="Search secrets by key"
              className="max-w-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {selectedSystem && (
            <p className="text-sm text-muted-foreground">
              {selectedSystem.system_name || selectedSystem.api_path_slug || 'System'} ({selectedSystem.api_path_slug || 'no-slug'})
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Secrets list</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : secrets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No secrets yet for this filter.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">KEY</th>
                    <th className="p-3 text-left font-medium">VALUE</th>
                    <th className="p-3 text-left font-medium">DESCRIPTION</th>
                    <th className="p-3 text-left font-medium">EXPIRES</th>
                    <th className="p-3 text-left font-medium">SOURCE</th>
                    <th className="p-3 text-right font-medium">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSecrets.map((s) => (
                    <tr key={s.secret_id} className="border-b">
                      <td className="p-3 font-mono text-xs">{s.secret_key}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {revealedValues[s.secret_id] !== undefined
                              ? (revealedValues[s.secret_id] || '—')
                              : (s.secret_value_masked || '—')}
                          </span>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-muted"
                            onClick={() => toggleReveal(s)}
                            aria-label={revealedValues[s.secret_id] !== undefined ? 'Hide secret value' : 'Show secret value'}
                            disabled={revealingId === s.secret_id}
                          >
                            {revealingId === s.secret_id ? (
                              <span className="text-xs">...</span>
                            ) : revealedValues[s.secret_id] !== undefined ? (
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18M10.58 10.58A3 3 0 0012 15a3 3 0 002.42-4.42M9.88 5.09A9.77 9.77 0 0112 5c5 0 9 4.5 9 7s-4 7-9 7a9.77 9.77 0 01-4.12-.91M6.1 6.1C4.18 7.52 3 9.36 3 12c0 2.5 4 7 9 7 1.55 0 2.98-.35 4.23-.98" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1.5 12s4-7.5 10.5-7.5S22.5 12 22.5 12s-4 7.5-10.5 7.5S1.5 12 1.5 12z" />
                                <circle cx="12" cy="12" r="3" strokeWidth="2" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="p-3">{s.description || '—'}</td>
                      <td className="p-3">{s.expires_at ? new Date(s.expires_at).toLocaleString() : '—'}</td>
                      <td className="p-3">{s.is_seeded_from_config ? 'System config' : 'Custom'}</td>
                      <td className="p-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (openMenuId === s.secret_id) {
                              setOpenMenuId(null);
                              setMenuAnchorRect(null);
                            } else {
                              setMenuAnchorRect(rect);
                              setOpenMenuId(s.secret_id);
                            }
                          }}
                          aria-label="Actions"
                          aria-expanded={openMenuId === s.secret_id}
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <circle cx="12" cy="6" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="18" r="1.5" />
                          </svg>
                        </Button>
                        {openMenuId === s.secret_id && menuAnchorRect && createPortal(
                          <div
                            className="min-w-[140px] rounded-md border border-border bg-background py-1 shadow-lg"
                            style={{
                              position: 'fixed',
                              top: (window.innerHeight - menuAnchorRect.bottom < 180) ? menuAnchorRect.top : menuAnchorRect.bottom,
                              right: window.innerWidth - menuAnchorRect.right,
                              transform: (window.innerHeight - menuAnchorRect.bottom < 180) ? 'translateY(-100%)' : 'none',
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
                                setConfirmDeleteSecretId(s.secret_id);
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
              {secrets.length > 0 && (
                <div className="mt-4 flex items-center justify-between px-3 pb-3">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({secrets.length} items)
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} aria-hidden />
          <Card className="relative z-10 mx-4 w-full max-w-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{editing ? 'Edit secret' : 'Create new secret'}</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSave}>
                <div className="space-y-2">
                  <Label>Secret key</Label>
                  <Input
                    value={form.secret_key}
                    onChange={(e) => setForm((f) => ({ ...f, secret_key: e.target.value.toUpperCase() }))}
                    placeholder="DATABASE_PASSWORD"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret value</Label>
                  <Input
                    type="password"
                    value={form.secret_value}
                    onChange={(e) => setForm((f) => ({ ...f, secret_value: e.target.value }))}
                    placeholder={editing ? 'Leave blank to keep current value' : 'Enter secret value'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What is this secret used for?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration date (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      {bulkOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setBulkOpen(false)} aria-hidden />
          <Card className="relative z-10 mx-4 w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Bulk import secrets</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => setBulkOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button type="button" variant={bulkFormat === 'env' ? 'default' : 'outline'} onClick={() => setBulkFormat('env')}>
                  .env format
                </Button>
                <Button type="button" variant={bulkFormat === 'json' ? 'default' : 'outline'} onClick={() => setBulkFormat('json')}>
                  JSON format
                </Button>
              </div>
              <textarea
                className="min-h-[220px] w-full rounded-md border border-input bg-transparent p-3 font-mono text-sm"
                placeholder={
                  bulkFormat === 'env'
                    ? 'DB_HOST=localhost\nDB_PORT=5432\nAPI_KEY=sk_xxx'
                    : '{\n  "DB_HOST": "localhost",\n  "DB_PORT": "5432"\n}'
                }
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                <Button type="button" disabled={saving} onClick={handleBulkImport}>
                  {saving ? 'Importing...' : 'Import'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
      <ConfirmModal
        open={confirmDeleteSecretId != null}
        title="Delete secret"
        message="Are you sure you want to delete this secret?"
        confirmText="Delete"
        onCancel={() => setConfirmDeleteSecretId(null)}
        onConfirm={() => handleDelete(confirmDeleteSecretId).then(() => setConfirmDeleteSecretId(null))}
      />
    </div>
  );
}
