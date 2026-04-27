import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

function toInputDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // UI: use local date parts (avoid UTC offset shifting day)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toInputMonth(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // UI: use local month parts (avoid UTC offset shifting month)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addMonthsDate(base, months) {
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

function buildGenerateFormDefaults(row) {
  const today = new Date();
  const todayStr = toInputDate(today);
  const cycleStart = row.current_cycle_start ? new Date(row.current_cycle_start) : today;
  const nextCycleStart = addMonthsDate(cycleStart, 1);
  // cycleEnd/nextCycleEnd are not needed for UI defaults here.

  const monthAnchorFor = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

  // UI defaults (requested):
  // - Current invoice detail is for the NEXT CYCLE month
  // - issue = today
  // - due = 5th of that cycle month
  // - invoice month = that cycle month
  // - generation = 25th of that cycle month
  const currentAnchor = monthAnchorFor(nextCycleStart);
  const dueCurrent = new Date(currentAnchor.getFullYear(), currentAnchor.getMonth(), 5);
  const generationCurrent = new Date(currentAnchor.getFullYear(), currentAnchor.getMonth(), 25);

  // Next invoice detail uses the same rules for the following cycle month.
  const nextAnchor = addMonthsDate(currentAnchor, 1);
  const dueNext = new Date(nextAnchor.getFullYear(), nextAnchor.getMonth(), 5);
  const generationNext = new Date(nextAnchor.getFullYear(), nextAnchor.getMonth(), 25);

  return {
    issueDate: todayStr,
    dueDate: toInputDate(dueCurrent),
    invoiceMonth: toInputMonth(currentAnchor),
    generationDate: toInputDate(generationCurrent),
    nextIssueDate: toInputDate(addMonthsDate(today, 1)),
    nextDueDate: toInputDate(dueNext),
    nextInvoiceMonth: toInputMonth(nextAnchor),
    nextGenerationDate: toInputDate(generationNext),
  };
}
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';
import { computeFixedActionMenuPosition } from '../../utils/actionMenuPosition.js';
import Pagination from '../../components/Pagination.jsx';

/**
 * Progress uses patty-linked invoices (subscription or billing_type=patty). Falls back to latest invoice row.
 */
function getExpectedInstallments(row) {
  const months = Number(row?.billing_duration_months);
  if (months === 3 || months === 6 || months === 12) return months;
  return 12;
}

function getInstallmentProgress(row) {
  const expectedInstallments = getExpectedInstallments(row);
  const total = Number(row.patty_inv_total) || 0;
  if (total > 0) {
    // UI: progress increases when an installment invoice is generated (not when paid).
    const paid = Number(row.patty_inv_paid) || 0;
    const pending = Number(row.patty_inv_pending) || 0;
    return {
      pct: Math.min(100, Math.max(0, Math.round((100 * total) / expectedInstallments))),
      paid,
      pending,
      label: `${total}/${expectedInstallments} generated · ${paid} paid · ${pending} pending`,
      hint: 'Progress increases when an invoice is generated',
    };
  }
  if (row.last_invoice_number) {
    // Fallback: if backend counts are missing but at least one invoice exists,
    // progress should still increase on "generated invoice".
    const st = String(row.last_invoice_status || '').toLowerCase();
    const paid = st === 'paid' ? 1 : 0;
    const pending = st === 'pending' ? 1 : 0;
    const pct = Math.round((100 * 1) / expectedInstallments);
    return {
      pct,
      paid,
      pending,
      label: `1/${expectedInstallments} generated · ${paid} paid · ${pending} pending`,
      hint: 'From latest invoice (generated)',
    };
  }
  return null;
}

function InstallmentProgressBar({ row }) {
  const p = getInstallmentProgress(row);
  if (!p) {
    return <span className="text-xs text-gray-400">No invoices yet</span>;
  }
  const generated = Number(row.patty_inv_total) || 0;
  const expectedInstallments = getExpectedInstallments(row);
  return (
    <div className="w-full min-w-[190px] max-w-[260px] space-y-2">
      <div
        className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden ring-1 ring-inset ring-gray-100"
        title={p.hint ? `${p.label} (${p.hint})` : p.label}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-500 transition-all"
          style={{ width: `${p.pct}%` }}
        />
      </div>
      <div className="space-y-0.5">
        <p className="text-[11px] sm:text-xs text-gray-700 leading-tight">
          <span className="font-semibold text-gray-900">{p.pct}%</span>
          <span className="text-gray-400 mx-1">·</span>
          <span>{generated}/{expectedInstallments} generated</span>
        </p>
        <p className="text-[11px] sm:text-xs text-gray-500 leading-tight">
          {p.paid} paid · {p.pending} pending
        </p>
      </div>
    </div>
  );
}

const InstallmentInvoice = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [viewModalRow, setViewModalRow] = useState(null);
  const [page, setPage] = useState(1);
  const [generateModalRow, setGenerateModalRow] = useState(null);
  const [generateForm, setGenerateForm] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteConfirmRow, setDeleteConfirmRow] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.userType !== 'superadmin') {
        navigate('/login');
        return;
      }
      setUser(parsedUser);
    } catch (error) {
      console.error('Error parsing user data:', error);
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const fetchPattyUsers = useCallback(async () => {
    setIsFetching(true);
    setFetchError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/billing/patty-installment-users?t=${Date.now()}`, {
        // UI: avoid cached 304 responses keeping stale counts after generating invoices
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.data?.users)) {
        setRows(data.data.users);
      } else {
        setFetchError(data.message || 'Could not load installment users');
        setRows([]);
      }
    } catch (error) {
      console.error(error);
      setFetchError('Network error loading data');
      setRows([]);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchPattyUsers();
  }, [user, fetchPattyUsers]);

  useEffect(() => {
    const closeMenu = () => setOpenActionMenuId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const openGenerateModal = (row) => {
    setGenerateForm(buildGenerateFormDefaults(row));
    setGenerateModalRow(row);
    setOpenActionMenuId(null);
  };

  const openViewModal = (row) => {
    setViewModalRow(row);
    setOpenActionMenuId(null);
  };

  const handleGenerateSubmit = async () => {
    if (!generateModalRow?.subscription_id) {
      alert('This school has no active subscription schedule yet. Set up billing in Users first.');
      return;
    }
    const f = generateForm;
    const required = [
      f.issueDate,
      f.dueDate,
      f.invoiceMonth,
      f.generationDate,
      f.nextIssueDate,
      f.nextDueDate,
      f.nextInvoiceMonth,
      f.nextGenerationDate,
    ];
    if (required.some((v) => !v)) {
      alert('Please fill in all required date fields.');
      return;
    }
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/billing/subscriptions/run-cycle`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId: generateModalRow.subscription_id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        alert(data.message || 'Could not generate installment invoice');
        return;
      }
      const result = data.data?.results?.[0];
      if (result?.skipped) {
        const reasons = {
          inactive_subscription: 'Subscription is not active.',
          already_processed: 'This cycle already has an invoice or was already processed.',
          advanced_after_existing_invoice: 'Schedule was advanced; no new invoice for this cycle.',
        };
        alert(reasons[result.reason] || result.reason || 'Cycle was skipped.');
      } else {
        alert('Invoice cycle processed successfully.');
        setGenerateModalRow(null);
        fetchPattyUsers();
      }
    } catch (e) {
      console.error(e);
      alert('Network error while generating invoice.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmRow) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users/${deleteConfirmRow.user_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        alert(data.message || 'Could not delete user');
        return;
      }
      alert(data.message || 'User deleted.');
      setDeleteConfirmRow(null);
      fetchPattyUsers();
    } catch (e) {
      console.error(e);
      alert('Network error while deleting.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.user_name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.plan_name || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const pageSize = 10;
  const pagedRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatMoney = (n) => {
    if (n == null || n === '') return '—';
    const v = parseFloat(n);
    if (Number.isNaN(v)) return '—';
    return `${'NT$'}${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const phaseProgressLabel = (row) => {
    const total = Number(row.patty_inv_total) || 0;
    const paid = Number(row.patty_inv_paid) || 0;
    if (total <= 0) return 'No installment invoices recorded yet.';
    return `Phase progress: ${paid} / ${total} invoices (paid / total recorded).`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-transparent">
      <Header user={user} />
      <div className="flex">
        <Sidebar userType={user.userType} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <main className="flex-1 lg:ml-64 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Installment Invoice</h1>
                <p className="mt-1 text-sm sm:text-base text-gray-600">
                  School accounts on <span className="font-medium">patty</span> (monthly installment) billing.
                  Amounts show the <span className="font-medium text-gray-800">total installment contract</span> and cycle progress.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchPattyUsers}
                disabled={isFetching}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {fetchError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{fetchError}</div>
            )}

            <div className="rounded-xl border border-blue-100/80 bg-gradient-to-br from-blue-50/90 via-white to-white p-4 sm:p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-blue-950">How installment billing is calculated</h2>
              <p className="mt-2 text-xs sm:text-sm text-gray-700 leading-relaxed">
                <span className="font-medium text-gray-900">Total amount to pay</span> = total credits × rate per credit
                (stored as{' '}
                <code className="rounded bg-blue-100/80 px-1 py-0.5 text-[11px] sm:text-xs text-blue-900">base_amount</code> on
                the Patty plan). Each cycle invoice is computed from that total based on billing duration.
              </p>
            </div>


            <div className="card overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="flex-1 min-w-0">
                  <span className="sr-only">Search</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by school name, email, or plan…"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </label>
              </div>

              {isFetching ? (
                <div className="p-10 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
                  <p className="mt-3 text-sm text-gray-600">Loading…</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-gray-600 text-sm">
                  {rows.length === 0
                    ? 'No school users with patty billing yet.'
                    : 'No rows match your search.'}
                </div>
              ) : (
                <>
                  {/* Mobile cards (kept for reference; table is now used on mobile too) */}
                  <ul className="hidden divide-y divide-gray-200">
                    {filtered.map((r) => (
                      <li key={r.user_id} className="p-4 space-y-2">
                        <div className="flex justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{r.user_name || '—'}</p>
                            <p className="text-xs text-gray-500 truncate">{r.email}</p>
                          </div>
                          {r.is_overdue && (
                            <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                              Overdue {r.days_overdue ? `${r.days_overdue}d` : ''}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                          <div>
                            <span className="text-gray-500">Plan</span>
                            <p className="font-medium">{r.plan_name || (r.subscription_id ? '—' : 'Not set up')}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Next due</span>
                            <p className="font-medium">{formatDate(r.next_due_date)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Cycle</span>
                            <p className="font-medium">
                              {r.current_cycle_start && r.current_cycle_end
                                ? `${formatDate(r.current_cycle_start)} – ${formatDate(r.current_cycle_end)}`
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Total amount to pay</span>
                            <p className="font-semibold text-gray-900">{formatMoney(r.base_amount)}</p>
                            {r.credits_per_cycle != null && r.credit_rate != null && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {r.credits_per_cycle} × {formatMoney(r.credit_rate)}
                              </p>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-500">Total credits / rate</span>
                            <p className="font-medium">
                              {r.credits_per_cycle != null ? `${r.credits_per_cycle} @ ${formatMoney(r.credit_rate)}` : '—'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Total credits (allocated)</span>
                            <p className="font-medium">{r.credits_per_cycle != null ? r.credits_per_cycle : '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Last invoice</span>
                            <p className="font-medium">
                              {r.last_invoice_number
                                ? `${r.last_invoice_number} (${r.last_invoice_status || '—'})`
                                : '—'}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">Installment payment progress</span>
                            <div className="mt-1.5 max-w-full">
                              <InstallmentProgressBar row={r} />
                            </div>
                          </div>
                          <div className="flex justify-end pt-2 border-t border-gray-100">
                            <div className="relative inline-flex action-menu">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setMenuPosition(
                                    computeFixedActionMenuPosition({
                                      rect,
                                      menuWidth: 208, // w-52
                                      menuHeight: 220,
                                      gap: 6,
                                    })
                                  );
                                  setOpenActionMenuId(openActionMenuId === r.user_id ? null : r.user_id);
                                }}
                                className="text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded p-1.5"
                                title="Actions"
                                aria-label="Row actions"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 5v.01M12 12v.01M12 19v.01"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Table (all screens; horizontally scrollable on mobile) */}
                  <div className="overflow-x-auto rounded-b-xl">
                    <table className="min-w-[1280px] w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            School
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Plan / cycle
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">
                            Total amount to pay
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider w-[240px]">
                            Installment progress
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Next due
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">
                            Total credits
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Last invoice
                          </th>
                          <th className="sticky right-0 z-10 bg-gray-50 px-4 py-3 text-right text-xs font-medium text-primary-700 tracking-wider shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {pagedRows.map((r) => (
                          <tr key={r.user_id} className="group hover:bg-gray-50">
                            <td className="px-4 py-3 align-top">
                              <div className="text-sm font-medium text-gray-900">{r.user_name || '—'}</div>
                              <div className="text-xs text-gray-500 break-all">{r.email}</div>
                            </td>
                            <td className="px-4 py-3 align-top text-sm text-gray-800">
                              <div>{r.plan_name || (r.subscription_id ? '—' : 'Subscription pending')}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {r.current_cycle_start && r.current_cycle_end
                                  ? `${formatDate(r.current_cycle_start)} → ${formatDate(r.current_cycle_end)}`
                                  : '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top text-right text-sm font-medium text-gray-900">
                              {formatMoney(r.base_amount)}
                              {r.credits_per_cycle != null && r.credit_rate != null && (
                                <div className="text-[10px] text-gray-400 mt-1 max-w-[11rem] ml-auto leading-tight">
                                  {r.credits_per_cycle} × {formatMoney(r.credit_rate)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top text-sm text-gray-800 w-[240px]">
                              <InstallmentProgressBar row={r} />
                            </td>
                            <td className="px-4 py-3 align-top text-sm text-gray-800">{formatDate(r.next_due_date)}</td>
                            <td className="px-4 py-3 align-top text-center">
                              {r.is_overdue ? (
                                <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                                  Overdue
                                  {r.days_overdue ? ` ${r.days_overdue}d` : ''}
                                </span>
                              ) : r.subscription_id ? (
                                <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                                  OK
                                </span>
                              ) : (
                                <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  No sub
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top text-right text-sm">
                              <span className="text-gray-900">{r.credits_per_cycle != null ? r.credits_per_cycle : '—'}</span>
                              <div className="text-xs text-gray-500">Allocated at school creation</div>
                            </td>
                            <td className="px-4 py-3 align-top text-sm">
                              {r.last_invoice_number ? (
                                <>
                                  <div className="font-medium text-gray-900">{r.last_invoice_number}</div>
                                  <div className="text-xs text-gray-500">
                                    {r.last_invoice_status} · due {formatDate(r.last_invoice_due_date)} ·{' '}
                                    {formatMoney(r.last_invoice_amount)}
                                  </div>
                                </>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="sticky right-0 z-[1] bg-white px-4 py-3 align-top text-right shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-gray-50">
                              <div className="relative inline-flex action-menu">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setMenuPosition(
                                      computeFixedActionMenuPosition({
                                        rect,
                                        menuWidth: 208, // w-52
                                        menuHeight: 220,
                                        gap: 6,
                                      })
                                    );
                                    setOpenActionMenuId(openActionMenuId === r.user_id ? null : r.user_id);
                                  }}
                                  className="text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded p-1.5"
                                  title="Actions"
                                  aria-label="Row actions"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 5v.01M12 12v.01M12 19v.01"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 sm:px-6 border-t border-gray-200">
                    <Pagination totalItems={filtered.length} pageSize={pageSize} currentPage={page} onPageChange={setPage} />
                  </div>
                </>
              )}
            </div>

            {filtered.length > 0 && (
              <p className="text-xs sm:text-sm text-gray-600">
                Showing {filtered.length} of {rows.length} patty billing school{rows.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </main>
      </div>

      {openActionMenuId != null && createPortal(
        <div
          className="fixed w-52 bg-white rounded-md shadow-xl z-[9999] border border-gray-200 action-menu"
          style={{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                const target = rows.find((x) => Number(x.user_id) === Number(openActionMenuId));
                if (target) openViewModal(target);
              }}
              className="block w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
            >
              View
            </button>
            <button
              type="button"
              onClick={() => {
                const target = rows.find((x) => Number(x.user_id) === Number(openActionMenuId));
                if (target) openGenerateModal(target);
              }}
              className="block w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
            >
              Generate invoice
            </button>
            <button
              type="button"
              onClick={() => {
                const target = rows.find((x) => Number(x.user_id) === Number(openActionMenuId));
                if (target) {
                  setDeleteConfirmRow(target);
                  setOpenActionMenuId(null);
                }
              }}
              className="block w-full text-left px-4 py-2.5 text-sm text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>,
        document.body
      )}

      {viewModalRow && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[10000]"
          onClick={() => setViewModalRow(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[min(100vh-2rem,900px)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="installment-view-title"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white rounded-t-xl">
              <div className="min-w-0">
                <h2 id="installment-view-title" className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                  Installment details
                </h2>
                <p className="mt-1 text-sm text-gray-700 break-words">
                  <span className="font-semibold text-gray-900">{viewModalRow.user_name || 'School'}</span>{' '}
                  <span className="text-gray-400">·</span>{' '}
                  <span className="text-gray-600 break-all">{viewModalRow.email || '—'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewModalRow(null)}
                className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 sm:px-6 py-5 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-500">Plan</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {viewModalRow.plan_name || (viewModalRow.subscription_id ? '—' : 'Subscription pending')}
                  </p>
                  <p className="mt-2 text-xs font-medium text-gray-500">Cycle</p>
                  <p className="mt-1 text-sm text-gray-800">
                    {viewModalRow.current_cycle_start && viewModalRow.current_cycle_end
                      ? `${formatDate(viewModalRow.current_cycle_start)} → ${formatDate(viewModalRow.current_cycle_end)}`
                      : '—'}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-500">Next due</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{formatDate(viewModalRow.next_due_date)}</p>
                  <div className="mt-3">
                    {viewModalRow.is_overdue ? (
                      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                        Overdue{viewModalRow.days_overdue ? ` ${viewModalRow.days_overdue}d` : ''}
                      </span>
                    ) : viewModalRow.subscription_id ? (
                      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                        OK
                      </span>
                    ) : (
                      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        No sub
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100/80 bg-gradient-to-br from-blue-50/90 via-white to-white p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500">Total installment contract</p>
                    <p className="mt-1 text-lg sm:text-xl font-bold text-gray-900">{formatMoney(viewModalRow.base_amount)}</p>
                    {viewModalRow.credits_per_cycle != null && viewModalRow.credit_rate != null && (
                      <p className="mt-1 text-xs text-gray-600">
                        {viewModalRow.credits_per_cycle} credits @ {formatMoney(viewModalRow.credit_rate)} per credit
                      </p>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xs font-medium text-gray-500">Allocated credits</p>
                    <p className="mt-1 text-lg sm:text-xl font-bold text-primary-700">
                      {viewModalRow.credits_per_cycle != null ? viewModalRow.credits_per_cycle : '—'}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500">Allocated at school creation</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500">Installment progress</p>
                  <div className="mt-2 max-w-full">
                    <InstallmentProgressBar row={viewModalRow} />
                  </div>
                  <p className="mt-2 text-xs text-gray-600">{phaseProgressLabel(viewModalRow)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500">Last invoice</p>
                {viewModalRow.last_invoice_number ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-semibold text-gray-900">{viewModalRow.last_invoice_number}</p>
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">{viewModalRow.last_invoice_status || '—'}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      due {formatDate(viewModalRow.last_invoice_due_date)}
                      <span className="text-gray-400 mx-1">·</span>
                      {formatMoney(viewModalRow.last_invoice_amount)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">—</p>
                )}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex justify-end bg-gray-50/80 rounded-b-xl">
              <button
                type="button"
                onClick={() => setViewModalRow(null)}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {generateModalRow && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[10000]"
          onClick={() => !isGenerating && setGenerateModalRow(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[min(100vh-2rem,900px)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="generate-invoice-title"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white rounded-t-xl">
              <div className="min-w-0">
                <h2 id="generate-invoice-title" className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                  Generate invoice — single
                </h2>
                <p className="text-sm text-gray-700 mt-1 break-words">
                  Generate invoice for <span className="font-semibold">{generateModalRow.user_name || 'School'}</span>
                </p>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">{phaseProgressLabel(generateModalRow)}</p>
              </div>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setGenerateModalRow(null)}
                className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">Current invoice detail</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Issue date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={generateForm.issueDate || ''}
                        onChange={(e) => setGenerateForm((prev) => ({ ...prev, issueDate: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Due date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={generateForm.dueDate || ''}
                        onChange={(e) => setGenerateForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Invoice month <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="month"
                        value={generateForm.invoiceMonth || ''}
                        onChange={(e) => setGenerateForm((prev) => ({ ...prev, invoiceMonth: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Generation date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={generateForm.generationDate || ''}
                        onChange={(e) => setGenerateForm((prev) => ({ ...prev, generationDate: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">Next invoice detail</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Next invoice issue date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={generateForm.nextIssueDate || ''}
                        onChange={(e) => setGenerateForm((prev) => ({ ...prev, nextIssueDate: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Next invoice due date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={generateForm.nextDueDate || ''}
                        onChange={(e) => setGenerateForm((prev) => ({ ...prev, nextDueDate: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Next invoice month <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="month"
                        value={generateForm.nextInvoiceMonth || ''}
                        onChange={(e) => setGenerateForm((prev) => ({ ...prev, nextInvoiceMonth: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Next invoice generation date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={generateForm.nextGenerationDate || ''}
                        onChange={(e) => setGenerateForm((prev) => ({ ...prev, nextGenerationDate: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!generateModalRow.subscription_id && (
              <div className="px-4 sm:px-6 pb-2">
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No subscription is linked to this account. Configure patty billing in Users before generating cycles.
                </p>
              </div>
            )}

            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 bg-gray-50/80 rounded-b-xl">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setGenerateModalRow(null)}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isGenerating || !generateModalRow.subscription_id}
                onClick={handleGenerateSubmit}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmRow && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
          onClick={() => !isDeleting && setDeleteConfirmRow(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <h3 id="delete-confirm-title" className="text-lg font-semibold text-gray-900">
              Delete school account?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently delete <span className="font-medium text-gray-900">{deleteConfirmRow.user_name}</span> (
              {deleteConfirmRow.email}) and related data. This cannot be undone.
            </p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmRow(null)}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteUser}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 lg:hidden z-50 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label="Toggle sidebar"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isSidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
    </div>
  );
};

export default InstallmentInvoice;
