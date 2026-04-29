import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithToken } from '@/lib/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function UserDashboard() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken(true);
      const data = await fetchWithToken('/api/users/dashboard-stats?days=7', { method: 'GET' }, token);
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">User Dashboard</h2>
          <p className="text-muted-foreground">Your systems, secrets, tokens, and usage (last 7 days).</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStats} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{stats?.systems?.total_systems ?? 0}</p>
            <p className="text-sm text-muted-foreground">My systems</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{stats?.systems?.active_systems ?? 0}</p>
            <p className="text-sm text-muted-foreground">Active systems</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{stats?.secrets?.total_secrets ?? 0}</p>
            <p className="text-sm text-muted-foreground">Total secrets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{stats?.tokens?.active_tokens ?? 0}</p>
            <p className="text-sm text-muted-foreground">Active tokens</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <>
                <p><span className="font-medium">API requests:</span> {Number(stats?.traffic?.total_requests || 0).toLocaleString()}</p>
                <p><span className="font-medium">Average response time:</span> {stats?.traffic?.avg_response_ms ?? 0} ms</p>
                <p><span className="font-medium">My tokens:</span> {stats?.tokens?.total_tokens ?? 0}</p>
                <p><span className="font-medium">Token request count:</span> {Number(stats?.tokens?.total_requests || 0).toLocaleString()}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top systems by requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (stats?.top_systems?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No request activity yet.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {stats.top_systems.map((s) => (
                  <div key={s.system_id} className="flex items-center justify-between rounded border border-border px-3 py-2">
                    <span>{s.system_name || `System ${s.system_id}`}</span>
                    <span className="font-medium">{Number(s.requests || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Request trends (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {(stats?.request_trends?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No request trend data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={(stats?.request_trends || []).map((r) => ({
                    ...r,
                    dateLabel: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="successful_requests" name="Successful" fill="#10b981" />
                  <Bar dataKey="failed_requests" name="Failed" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System request distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {(stats?.top_systems?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No distribution data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={(stats?.top_systems || []).map((s) => ({
                      name: s.system_name || `System ${s.system_id}`,
                      value: Number(s.requests || 0),
                    }))}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(stats?.top_systems || []).map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Requests']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Average response time trend</CardTitle>
        </CardHeader>
        <CardContent>
          {(stats?.request_trends?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No response trend data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={(stats?.request_trends || []).map((r) => ({
                  ...r,
                  dateLabel: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" ms" />
                <Tooltip formatter={(v) => [`${v} ms`, 'Average Response']} />
                <Line type="monotone" dataKey="avg_response_ms" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
