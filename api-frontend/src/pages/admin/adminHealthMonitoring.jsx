import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { API_BASE, fetchWithToken } from '@/lib/api';

const STATUS_CONFIG = {
  healthy: { label: 'Healthy', color: 'bg-green-500', text: 'text-green-700 dark:text-green-400', border: 'border-green-500' },
  degraded: { label: 'Degraded', color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500' },
  down: { label: 'Down', color: 'bg-red-500', text: 'text-red-700 dark:text-red-400', border: 'border-red-500' },
  unknown: { label: 'Unknown', color: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-400' },
};

const CRITICALITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/** Fixed n8n webhook URL for health alerts (Mattermost/Spacemail). Read-only in UI. */
const HEALTH_WEBHOOK_URL = 'http://n8n.rhet-corp.com:5678/webhook/10b3286c-1880-4602-a338-3e34cd2b1237';

/** Poll interval for health data (background refresh; no loading spinner). */
const HEALTH_AUTO_REFRESH_MS = 10_000;

function DatabaseIcon() {
  return (
    <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}

function CheckIcon({ className = 'h-5 w-5 text-green-600' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WarningIcon({ className = 'h-5 w-5 text-amber-600' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function DownIcon({ className = 'h-5 w-5 text-red-600' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function BellIcon({ className = 'h-5 w-5 text-blue-600' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 6H9" />
    </svg>
  );
}

export default function AdminHealthMonitoring() {
  const { getToken } = useAuth();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configSystem, setConfigSystem] = useState(null);
  const [configForm, setConfigForm] = useState({
    check_interval_seconds: 300,
    criticality_level: 'medium',
    webhook_url: HEALTH_WEBHOOK_URL,
    primary_alert_emails: '',
    monitoring_enabled: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [configError, setConfigError] = useState('');
  const [configSuccess, setConfigSuccess] = useState('');

  /** @param {boolean} [background] When true, skip loading spinner and error banner (polling / post-save refresh). */
  const fetchHealth = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
      setError('');
    }
    try {
      const idToken = await getToken(true);
      if (!idToken) throw new Error('Not signed in');
      const data = await fetchWithToken('/api/systems/health', { method: 'GET' }, idToken);
      setSystems(data.systems || []);
    } catch (err) {
      if (!background) setError(err.message || 'Failed to fetch health');
      setSystems((prev) => (prev.length ? prev : []));
    } finally {
      if (!background) setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchHealth(false);
    const tid = setInterval(() => fetchHealth(true), HEALTH_AUTO_REFRESH_MS);
    return () => clearInterval(tid);
  }, [fetchHealth]);

  const openConfig = useCallback(async (system) => {
    setConfigSystem(system);
    setConfigError('');
    setConfigSuccess('');
    setConfigForm({
      check_interval_seconds: system?.check_interval_seconds ?? 300,
      criticality_level: system?.criticality_level || 'medium',
      webhook_url: HEALTH_WEBHOOK_URL,
      primary_alert_emails: system?.primary_alert_emails || '',
      monitoring_enabled: system?.monitoring_enabled !== false,
    });
    setConfigModalOpen(true);
    if (system?.system_id) {
      try {
        const idToken = await getToken(true);
        if (idToken) {
          const data = await fetchWithToken(`/api/systems/${system.system_id}/monitoring-config`, { method: 'GET' }, idToken);
          setConfigForm({
            check_interval_seconds: data.check_interval_seconds ?? 300,
            criticality_level: data.criticality_level || 'medium',
            webhook_url: HEALTH_WEBHOOK_URL,
            primary_alert_emails: data.primary_alert_emails || '',
            monitoring_enabled: data.monitoring_enabled !== false,
          });
        }
      } catch {
        // keep form from system health data
      }
    }
  }, [getToken]);

  const closeConfig = () => {
    setConfigModalOpen(false);
    setConfigSystem(null);
    setConfigError('');
    setConfigSuccess('');
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!configSystem) return;
    setConfigError('');
    setConfigSuccess('');
    setSubmitting(true);
    try {
      const idToken = await getToken(true);
      if (!idToken) throw new Error('Not signed in');
      await fetchWithToken(
        `/api/systems/${configSystem.system_id}/monitoring-config`,
        { method: 'PUT', body: configForm },
        idToken
      );
      setConfigSuccess('Configuration saved.');
      fetchHealth(true);
    } catch (err) {
      setConfigError(err.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!configSystem) return;
    setConfigError('');
    setConfigSuccess('');
    setTestingWebhook(true);
    try {
      const idToken = await getToken(true);
      if (!idToken) throw new Error('Not signed in');
      const data = await fetchWithToken(
        `/api/systems/${configSystem.system_id}/test-webhook`,
        {
          method: 'POST',
          body: {
            webhook_url: configForm.webhook_url?.trim() || null,
            primary_alert_emails: configForm.primary_alert_emails?.trim() || null,
          },
        },
        idToken
      );
      setConfigSuccess(data.message || 'Test webhook sent successfully.');
    } catch (err) {
      setConfigError(err.message || 'Test webhook failed');
    } finally {
      setTestingWebhook(false);
    }
  };

  const healthyCount = systems.filter((s) => s.status === 'healthy').length;
  const degradedCount = systems.filter((s) => s.status === 'degraded').length;
  const downCount = systems.filter((s) => s.status === 'down').length;
  const activeAlertsCount = degradedCount + downCount;

  const cfg = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.unknown;

  const formatLastCheck = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Health monitoring</h2>
        <p className="text-muted-foreground">
          Monitor external system database latency. Configure webhooks for n8n/Mattermost alerts.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Auto-refreshes every {HEALTH_AUTO_REFRESH_MS / 1000} seconds.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
      )}

      {/* Summary cards */}
      {!loading && systems.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-2xl font-bold">{healthyCount}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CheckIcon className="h-4 w-4" /> All operational
                </p>
                <p className="text-xs text-muted-foreground mt-1">0ms – 1,999ms</p>
              </div>
              <CheckIcon className="h-10 w-10 text-green-500" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-2xl font-bold">{degradedCount}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <WarningIcon className="h-4 w-4" /> Performance issues
                </p>
                <p className="text-xs text-muted-foreground mt-1">2,000ms – 4,999ms</p>
              </div>
              <WarningIcon className="h-10 w-10 text-amber-500" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-2xl font-bold">{downCount}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <DownIcon className="h-4 w-4" /> Systems offline
                </p>
                <p className="text-xs text-muted-foreground mt-1">5,000ms+</p>
              </div>
              <DownIcon className="h-10 w-10 text-red-500" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-2xl font-bold">{activeAlertsCount}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <BellIcon className="h-4 w-4" /> Require attention
                </p>
              </div>
              <BellIcon className="h-10 w-10 text-blue-500" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* System status details table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>System status details</CardTitle>
          {!loading && systems.length > 0 && (
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">{systems.length} Systems</span>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : systems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No systems configured. Add systems in <Link to="/admin/systems" className="text-primary underline">Systems</Link>.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm" style={{ minWidth: '700px' }}>
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">SYSTEM</th>
                    <th className="p-3 text-left font-medium">STATUS</th>
                    <th className="p-3 text-left font-medium">RESPONSE TIME</th>
                    <th className="p-3 text-left font-medium">CRITICALITY</th>
                    <th className="p-3 text-left font-medium">LAST CHECK</th>
                    <th className="p-3 text-right font-medium">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {systems.map((s) => (
                    <tr key={s.system_id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <DatabaseIcon />
                          <div>
                            <p className="font-medium">{s.system_name || `System ${s.system_id}`}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={s.endpoint || ''}>
                              {s.endpoint || s.api_path_slug ? `/api/${s.api_path_slug}` : '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {s.status === 'healthy' && <CheckIcon />}
                          {s.status === 'degraded' && <WarningIcon />}
                          {s.status === 'down' && <DownIcon />}
                          {(!s.status || s.status === 'unknown') && <span className="h-5 w-5 rounded-full bg-gray-300" />}
                          <span className={cfg(s.status).text}>{cfg(s.status).label}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {s.latencyMs != null ? `${s.latencyMs}ms` : s.ok ? '—' : 'Timeout'}
                      </td>
                      <td className="p-3 capitalize">{s.criticality || 'medium'}</td>
                      <td className="p-3 text-muted-foreground">{formatLastCheck(s.last_checked_at)}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openConfig(s)}
                            aria-label="Configure"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monitoring configuration modal */}
      {configModalOpen && configSystem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeConfig} aria-hidden />
          <Card className="relative z-10 w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Monitoring configuration</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={closeConfig} aria-label="Close">
                <DownIcon className="h-5 w-5 rotate-45" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Configure health checks and notifications for <strong>{configSystem.system_name}</strong>.
              </p>
              {configError && (
                <p className="mb-4 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{configError}</p>
              )}
              {configSuccess && (
                <p className="mb-4 rounded-md bg-green-500/10 p-2 text-sm text-green-700 dark:text-green-400">{configSuccess}</p>
              )}
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="check_interval">Check interval (seconds)</Label>
                  <Input
                    id="check_interval"
                    type="number"
                    min={60}
                    value={configForm.check_interval_seconds}
                    onChange={(e) => setConfigForm((f) => ({ ...f, check_interval_seconds: Number(e.target.value) || 300 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="criticality">Criticality level</Label>
                  <select
                    id="criticality"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={configForm.criticality_level}
                    onChange={(e) => setConfigForm((f) => ({ ...f, criticality_level: e.target.value }))}
                  >
                    {CRITICALITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook_url">Webhook URL</Label>
                  <Input
                    id="webhook_url"
                    type="url"
                    value={HEALTH_WEBHOOK_URL}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    n8n webhook URL for sending notifications to Mattermost and Spacemail/Spaceship (read-only)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary_alert_emails">Primary alert emails</Label>
                  <Input
                    id="primary_alert_emails"
                    type="text"
                    value={configForm.primary_alert_emails}
                    onChange={(e) => setConfigForm((f) => ({ ...f, primary_alert_emails: e.target.value }))}
                    placeholder="admin@example.com, ops@example.com"
                  />
                  <p className="text-xs text-muted-foreground">Primary email addresses for health alerts (comma-separated)</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={configForm.monitoring_enabled}
                    onChange={(e) => setConfigForm((f) => ({ ...f, monitoring_enabled: e.target.checked }))}
                    className="rounded border-input"
                  />
                  Enable monitoring for this system
                </label>
                <div className="flex flex-wrap gap-2 pt-4">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save configuration'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleTestWebhook} disabled={testingWebhook || !configForm.webhook_url?.trim()}>
                    {testingWebhook ? 'Sending…' : 'Test webhook'}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeConfig}>
                    Cancel
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
