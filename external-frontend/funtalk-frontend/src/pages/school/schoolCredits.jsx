import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import ResponsiveSelect from '../../components/ResponsiveSelect.jsx';
import Pagination from '../../components/Pagination.jsx';
import { API_BASE_URL } from '@/config/api.js';

const SchoolCredits = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [billingStatus, setBillingStatus] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
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
      if (parsedUser.userType !== 'school') {
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
      fetchCreditBalance();
      fetchTransactions();
      fetchBillingStatus();
    }
  }, [user, transactionTypeFilter, dateFilter]);

  const fetchCreditBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/credits/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data) {
        setCreditBalance(data.data.current_balance || 0);
        setLastUpdated(data.data.last_updated || null);
      }
    } catch (error) {
      console.error('Error fetching credit balance:', error);
    }
  };

  const fetchTransactions = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/credits/transactions`;
      const params = new URLSearchParams();
      
      if (transactionTypeFilter) {
        params.append('transactionType', transactionTypeFilter);
      }
      
      if (dateFilter) {
        params.append('startDate', dateFilter);
        params.append('endDate', dateFilter);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data?.transactions) {
        setTransactions(data.data.transactions);
      } else {
        console.error('Error fetching transactions:', data.message);
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchBillingStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/billing/subscriptions/${user.userId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setBillingStatus(data.data);
      } else {
        setBillingStatus(null);
      }
    } catch (error) {
      console.error('Error fetching billing status:', error);
      setBillingStatus(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMoney = (n) => {
    if (n == null || n === '') return '—';
    const v = parseFloat(n);
    if (Number.isNaN(v)) return '—';
    return `${'NT$'}${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatTransactionType = (type) => {
    const types = {
      purchase: 'Purchase',
      deduction: 'Deduction',
      adjustment: 'Adjustment',
    };
    return types[type] || type;
  };

  useEffect(() => {
    setPage(1);
  }, [transactionTypeFilter, dateFilter]);

  const pageSize = 10;
  const pagedTransactions = transactions.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <div className="flex">
        <Sidebar 
          userType={user.userType} 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        
        <main className="flex-1 lg:ml-64 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-4 sm:space-y-6">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Credits</h1>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">View your credit balance and transaction history</p>
                </div>
                <Link
                  to="/school/packages"
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors text-center"
                >
                  Purchase Credits
                </Link>
              </div>

              {/* Balance Summary Card */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Current Credit Balance</p>
                    <p className="mt-1 sm:mt-2 text-3xl sm:text-4xl md:text-5xl font-bold text-primary-600">{creditBalance}</p>
                    {lastUpdated && (
                      <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
                        Last updated: {formatDate(lastUpdated)}
                      </p>
                    )}
                  </div>
                  <div className="bg-primary-100 rounded-full p-4 sm:p-6">
                    <svg className="w-8 h-8 sm:w-12 sm:h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {billingStatus?.patty_installment?.is_patty && (
                <div className="bg-white rounded-lg shadow border border-blue-100 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900">Patty — monthly installment</h2>
                      <p className="mt-1 text-xs sm:text-sm text-gray-600 max-w-2xl">
                        This plan is billed in <span className="font-medium text-gray-800">monthly slices</span>, not one
                        full upfront payment. Each invoice below is one period&apos;s installment.
                      </p>
                      {billingStatus.patty_installment.monthly_payment_label && (
                        <p className="mt-2 text-sm text-gray-800">{billingStatus.patty_installment.monthly_payment_label}</p>
                      )}
                      {billingStatus.patty_installment.monthly_payment_amount != null && (
                        <p className="mt-1 text-base sm:text-lg font-semibold text-primary-700">
                          About {formatMoney(billingStatus.patty_installment.monthly_payment_amount)} per month
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {(billingStatus.patty_installment.installments_recorded ?? 0) === 0 ? (
                      <p className="text-xs sm:text-sm text-gray-500">
                        No subscription-linked installment invoices yet. Progress will show after invoices are generated each
                        cycle.
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-gray-700">
                          <span>Installment payment progress (paid vs pending invoices)</span>
                          {billingStatus.patty_installment.payment_progress_percent != null && (
                            <span className="font-semibold text-gray-900">
                              {billingStatus.patty_installment.payment_progress_percent}%
                            </span>
                          )}
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary-600 transition-all"
                            style={{
                              width: `${
                                billingStatus.patty_installment.payment_progress_percent != null
                                  ? Math.min(100, Math.max(0, billingStatus.patty_installment.payment_progress_percent))
                                  : 0
                              }%`,
                            }}
                            role="progressbar"
                            aria-valuenow={
                              billingStatus.patty_installment.payment_progress_percent != null
                                ? billingStatus.patty_installment.payment_progress_percent
                                : 0
                            }
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-600">
                          <span>
                            Paid:{' '}
                            <span className="font-medium text-gray-900">
                              {billingStatus.patty_installment.installments_paid ?? 0}
                            </span>{' '}
                            invoice(s) · {formatMoney(billingStatus.patty_installment.amount_paid_to_date)}
                          </span>
                          <span>
                            Pending:{' '}
                            <span className="font-medium text-amber-800">
                              {billingStatus.patty_installment.installments_pending ?? 0}
                            </span>{' '}
                            · {formatMoney(billingStatus.patty_installment.amount_pending_total)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {billingStatus?.is_overdue && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
                  <p className="text-sm text-amber-800 font-medium">
                    Payment overdue by {billingStatus.days_overdue} day{billingStatus.days_overdue !== 1 ? 's' : ''}.
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-amber-700">
                    Due date was {billingStatus.next_due_date}. Credits remain usable, but please settle invoice promptly.
                  </p>
                </div>
              )}

              {/* Transaction History */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Transaction History</h2>
                </div>
                <div className="p-4 sm:p-6">
                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                      <ResponsiveSelect
                        id="school-credits-transaction-type"
                        aria-label="Filter by transaction type"
                        value={transactionTypeFilter}
                        onChange={(e) => setTransactionTypeFilter(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                      >
                        <option value="">All Types</option>
                        <option value="purchase">Purchase</option>
                        <option value="deduction">Deduction</option>
                        <option value="adjustment">Adjustment</option>
                      </ResponsiveSelect>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  {/* Transactions Table */}
                  {isFetching ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-3 text-sm text-gray-600">Loading transactions...</p>
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">No transactions found</p>
                    </div>
                  ) : (
                    <>
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-gray-200" style={{ minWidth: '800px' }}>
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Balance Before</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Balance After</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Description</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pagedTransactions.map((transaction) => (
                            <tr key={transaction.transaction_id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(transaction.created_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  transaction.transaction_type === 'purchase' 
                                    ? 'bg-green-100 text-green-800' 
                                    : transaction.transaction_type === 'deduction'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {formatTransactionType(transaction.transaction_type)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                                <span className={transaction.transaction_type === 'purchase' ? 'text-green-600' : 'text-red-600'}>
                                  {transaction.transaction_type === 'purchase' ? '+' : '-'}{transaction.amount}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {transaction.balance_before}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                {transaction.balance_after}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {transaction.description || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3">
                      <Pagination totalItems={transactions.length} pageSize={pageSize} currentPage={page} onPageChange={setPage} />
                    </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Floating Hamburger Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 lg:hidden z-50 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-colors"
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

export default SchoolCredits;
