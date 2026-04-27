import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';
import Pagination from '../../components/Pagination.jsx';

const Credits = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [activeTab, setActiveTab] = useState('balances'); // 'balances' or 'transactions'
  const [balancesPage, setBalancesPage] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);

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

  // Fetch data
  useEffect(() => {
    if (user) {
      fetchBalances();
      fetchTransactions();
    }
  }, [user]);

  const fetchBalances = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/credits/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data?.balances) {
        setBalances(data.data.balances);
      } else {
        console.error('Error fetching balances:', data.message);
        setBalances([]);
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
      setBalances([]);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/credits/transactions`, {
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
    }
  };

  // Calculate totals
  const unsettledBalances = balances.filter((b) => Number(b.display_balance) > 0);
  const totalBalance = unsettledBalances.reduce((sum, b) => sum + (Number(b.display_balance) || 0), 0);
  const totalUnsettledTransactions = unsettledBalances.length;
  const totalSettledTransactions = transactions.length;

  useEffect(() => {
    setBalancesPage(1);
    setTransactionsPage(1);
  }, [activeTab, balances.length, transactions.length]);

  const pageSize = 10;
  const pagedBalances = unsettledBalances.slice((balancesPage - 1) * pageSize, balancesPage * pageSize);
  const pagedTransactions = transactions.slice((transactionsPage - 1) * pageSize, transactionsPage * pageSize);

  const formatCurrency = (value) => {
    const n = Number(value || 0);
    return `${'NT$'}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date
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

  // Format settled transaction type
  const formatSettlementType = (type) => {
    const types = {
      full_payment_paid: 'Full Payment',
      installment_fully_paid: 'Installment Completed',
    };
    return types[type] || type;
  };

  // Get settled transaction type color
  const getSettlementTypeColor = (type) => {
    const colors = {
      full_payment_paid: 'bg-green-100 text-green-800',
      installment_fully_paid: 'bg-blue-100 text-blue-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

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
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Credits</h1>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">View credit balances and settled transactions</p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-500">Total Balance</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(totalBalance)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-500">Total Unsettled Transactions</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalUnsettledTransactions}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-500">Total Settled Transactions</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalSettledTransactions}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200">
                  <nav className="flex -mb-px">
                    <button
                      onClick={() => setActiveTab('balances')}
                      className={`py-3 sm:py-4 px-4 sm:px-6 text-sm sm:text-base font-medium border-b-2 ${
                        activeTab === 'balances'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Credit Balances
                    </button>
                    <button
                      onClick={() => setActiveTab('transactions')}
                      className={`py-3 sm:py-4 px-4 sm:px-6 text-sm sm:text-base font-medium border-b-2 ${
                        activeTab === 'transactions'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Settled Transactions
                    </button>
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="p-4 sm:p-6">
                  {activeTab === 'balances' ? (
                    <div>
                      {isFetching ? (
                        <div className="p-8 text-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
                          <p className="mt-3 text-sm text-gray-600">Loading balances...</p>
                        </div>
                      ) : unsettledBalances.length === 0 ? (
                        <div className="p-8 text-center">
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h3 className="mt-3 text-base font-medium text-gray-900">No unsettled balances found</h3>
                          <p className="mt-1 text-sm text-gray-600">All balances are settled</p>
                        </div>
                      ) : (
                        <>
                        <div className="overflow-x-auto overflow-hidden">
                          <table className="w-full divide-y divide-gray-200" style={{ minWidth: '900px' }}>
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider hidden lg:table-cell">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Role</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">Credits</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">Balance</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Last Updated</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {pagedBalances.map((balance) => (
                                <tr key={balance.credit_id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{balance.user_name || 'N/A'}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                    <div className="text-sm text-gray-500">{balance.email || 'N/A'}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                      {balance.user_type || 'N/A'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className="text-sm font-medium text-gray-900">
                                      {(Number(balance.total_credits) || 0).toLocaleString()}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className="text-sm font-bold text-gray-900">{formatCurrency(Number(balance.display_balance) || 0)}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">{formatDate(balance.last_updated)}</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3">
                          <Pagination
                            totalItems={unsettledBalances.length}
                            pageSize={pageSize}
                            currentPage={balancesPage}
                            onPageChange={setBalancesPage}
                          />
                        </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div>
                      {transactions.length === 0 ? (
                        <div className="p-8 text-center">
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <h3 className="mt-3 text-base font-medium text-gray-900">No settled transactions found</h3>
                          <p className="mt-1 text-sm text-gray-600">No settled payment records available yet</p>
                        </div>
                      ) : (
                        <>
                        <div className="overflow-x-auto overflow-hidden">
                          <table className="w-full divide-y divide-gray-200" style={{ minWidth: '1100px' }}>
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Settled Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider hidden lg:table-cell">Type</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider hidden xl:table-cell">Installments</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider hidden md:table-cell">Description</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {pagedTransactions.map((transaction) => (
                                <tr key={transaction.transaction_id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{formatDate(transaction.settled_at)}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{transaction.user_name || 'N/A'}</div>
                                    <div className="text-xs text-gray-500">{transaction.email || ''}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSettlementTypeColor(transaction.settlement_type)}`}>
                                      {formatSettlementType(transaction.settlement_type)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className="text-sm font-medium text-green-700">
                                      {formatCurrency(Number(transaction.amount) || 0)}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right hidden xl:table-cell">
                                    <div className="text-sm text-gray-600">
                                      {(Number(transaction.paid_installments) || 0)}/{(Number(transaction.expected_installments) || 0)}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 hidden md:table-cell">
                                    <div className="text-sm text-gray-500">{transaction.description || '-'}</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3">
                          <Pagination
                            totalItems={transactions.length}
                            pageSize={pageSize}
                            currentPage={transactionsPage}
                            onPageChange={setTransactionsPage}
                          />
                        </div>
                        </>
                      )}
                    </div>
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
        className="fixed bottom-6 right-6 lg:hidden z-50 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label="Toggle sidebar"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isSidebarOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>
    </div>
  );
};

export default Credits;
