import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';
import ResponsiveSelect from '../../components/ResponsiveSelect';
import Pagination from '../../components/Pagination.jsx';

const PaymentLogs = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [payments, setPayments] = useState([]);
  const [referenceSearch, setReferenceSearch] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('');
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState('');
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user, paymentTypeFilter]);

  const fetchLogs = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/billing/payment-logs`;
      const params = new URLSearchParams();
      if (paymentTypeFilter) params.append('paymentType', paymentTypeFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.data?.payments)) {
        setPayments(data.data.payments);
      } else {
        setPayments([]);
      }
    } catch (error) {
      console.error('Error fetching payment logs:', error);
      setPayments([]);
    } finally {
      setIsFetching(false);
    }
  };

  const filteredPayments = useMemo(() => {
    const q = referenceSearch.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) =>
      String(p.transaction_ref || '').toLowerCase().includes(q) ||
      String(p.user_name || '').toLowerCase().includes(q) ||
      String(p.email || '').toLowerCase().includes(q)
    );
  }, [payments, referenceSearch]);

  useEffect(() => {
    setPage(1);
  }, [referenceSearch, paymentTypeFilter]);

  const pageSize = 10;
  const pagedPayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatMoney = (amount) => {
    if (amount == null) return 'NT$0.00';
    return `${'NT$'}${parseFloat(amount).toFixed(2)}`;
  };

  const getAttachmentHref = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL.replace('/api', '')}${url}`;
  };

  const isPdfUrl = (url) => /\.pdf($|\?)/i.test(String(url || ''));

  const escapeCsvValue = (value) => {
    if (value == null) return '';
    const stringValue = String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const exportToExcel = () => {
    const headers = [
      'Payment ID',
      'Customer Name',
      'Customer Email',
      'Reference',
      'Payment Method',
      'Amount Paid',
      'Status',
      'Billing Type',
      'Date',
      'Attachment URL',
    ];

    const rows = filteredPayments.map((payment) => [
      `PAY-${payment.payment_id}`,
      payment.user_name || '',
      payment.email || '',
      payment.transaction_ref || '',
      payment.payment_method || '',
      Number(payment.amount_paid || 0).toFixed(2),
      payment.status || '',
      payment.billing_type || '',
      formatDate(payment.created_at),
      payment.attachment_url ? getAttachmentHref(payment.attachment_url) : '',
    ]);

    const csvContent = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map((row) => row.map(escapeCsvValue).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = downloadUrl;
    link.setAttribute('download', `payment-logs-${stamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Payment Logs</h1>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">
                Track invoice payment records and references
              </p>
            </div>

            <div className="card p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
              <input
                type="text"
                placeholder="Search reference, customer, email..."
                value={referenceSearch}
                onChange={(e) => setReferenceSearch(e.target.value)}
                className="w-full sm:w-72 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <ResponsiveSelect
                value={paymentTypeFilter}
                onChange={(e) => setPaymentTypeFilter(e.target.value)}
                className="w-full sm:w-56 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                aria-label="Payment type filter"
              >
                <option value="">All payment types</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="e_wallet">E-wallets</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </ResponsiveSelect>
              <button
                type="button"
                onClick={exportToExcel}
                disabled={filteredPayments.length === 0}
                className="w-full sm:w-auto sm:ml-auto px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export to Excel
              </button>
            </div>

            <div className="card">
              {isFetching ? (
                <div className="p-10 text-center text-gray-600 text-sm">Loading payment logs...</div>
              ) : filteredPayments.length === 0 ? (
                <div className="p-10 text-center text-gray-600 text-sm">No payment logs found.</div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Payment ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Reference</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Attachment</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pagedPayments.map((p) => (
                        <tr key={p.payment_id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-sm text-gray-900">PAY-{p.payment_id}</td>
                          <td className="px-4 py-4">
                            <div className="text-sm font-medium text-gray-900">{p.user_name || 'N/A'}</div>
                            <div className="text-xs text-gray-500 break-all">{p.email || ''}</div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">{p.transaction_ref || '-'}</td>
                          <td className="px-4 py-4 text-sm text-gray-900">{p.payment_method || '-'}</td>
                          <td className="px-4 py-4 text-sm font-semibold text-right text-gray-900">{formatMoney(p.amount_paid)}</td>
                          <td className="px-4 py-4 text-sm text-gray-600">{formatDate(p.created_at)}</td>
                          <td className="px-4 py-4 text-sm">
                            {p.attachment_url ? (
                              <button
                                type="button"
                                onClick={() => setAttachmentPreviewUrl(getAttachmentHref(p.attachment_url))}
                                className="text-primary-600 hover:text-primary-700 underline"
                              >
                                View
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 sm:px-6 border-t border-gray-200">
                  <Pagination totalItems={filteredPayments.length} pageSize={pageSize} currentPage={page} onPageChange={setPage} />
                </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {attachmentPreviewUrl && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
          onClick={() => setAttachmentPreviewUrl('')}
        >
                  <div
                    className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col border border-[#e8ddd8]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Payment Attachment</h3>
              <button
                type="button"
                onClick={() => setAttachmentPreviewUrl('')}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 p-3 sm:p-4">
              {isPdfUrl(attachmentPreviewUrl) ? (
                <iframe src={attachmentPreviewUrl} title="Payment Attachment PDF" className="w-full h-full rounded border border-gray-200" />
              ) : (
                <img src={attachmentPreviewUrl} alt="Payment attachment" className="w-full h-full object-contain rounded border border-gray-200" />
              )}
            </div>
          </div>
        </div>
      )}

      <button
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

export default PaymentLogs;
