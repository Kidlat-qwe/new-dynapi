import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';

const USER_TYPE_LABELS = {
  superadmin: 'Super Admin',
  school: 'School',
  teacher: 'Teacher',
};

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFetchingMetrics, setIsFetchingMetrics] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    users: [],
    teachers: [],
    invoices: [],
    payments: [],
  });

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      
      // Verify user is superadmin
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
    if (user?.userType === 'superadmin') {
      fetchDashboardData();
    }
  }, [user]);

  const fetchWithAuth = async (endpoint) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || `Failed to fetch ${endpoint}`);
    }
    return data;
  };

  const fetchDashboardData = async () => {
    setIsFetchingMetrics(true);
    try {
      const [usersRes, teachersRes, invoicesRes, paymentsRes] = await Promise.all([
        fetchWithAuth('/users'),
        fetchWithAuth('/teachers'),
        fetchWithAuth('/billing/invoices'),
        fetchWithAuth('/billing/payment-logs'),
      ]);

      setDashboardData({
        users: usersRes.data?.users || [],
        teachers: teachersRes.data?.teachers || [],
        invoices: invoicesRes.data?.invoices || [],
        payments: paymentsRes.data?.payments || [],
      });
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      setDashboardData({
        users: [],
        teachers: [],
        invoices: [],
        payments: [],
      });
    } finally {
      setIsFetchingMetrics(false);
    }
  };

  const formatNumber = (value) =>
    new Intl.NumberFormat('en-US').format(Number.isFinite(value) ? value : 0);

  const formatCurrency = (value) => {
    const n = Number.isFinite(value) ? value : 0;
    return `${'NT$'}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const users = dashboardData.users;
  const teachers = dashboardData.teachers;
  const invoices = dashboardData.invoices;
  const payments = dashboardData.payments;

  const totalUsers = users.length;
  const totalSchools = users.filter((u) => u.user_type === 'school').length;
  const totalTeachers = teachers.length;
  const totalRevenue = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, payment) => sum + (Number(payment.amount_paid) || 0), 0);

  const userTypeStats = Object.keys(USER_TYPE_LABELS).map((type) => ({
    type,
    label: USER_TYPE_LABELS[type],
    count: users.filter((u) => u.user_type === type).length,
  }));
  const maxUserTypeCount = Math.max(...userTypeStats.map((item) => item.count), 1);

  const invoiceStatuses = ['paid', 'pending', 'overdue', 'cancelled'];
  const invoiceStatusStats = invoiceStatuses.map((status) => ({
    status,
    count: invoices.filter((invoice) => invoice.status === status).length,
  }));
  const maxInvoiceStatusCount = Math.max(...invoiceStatusStats.map((item) => item.count), 1);

  const recentActivities = [
    ...invoices.slice(0, 6).map((invoice) => ({
      id: `invoice-${invoice.invoice_id}`,
      type: 'Invoice',
      title: `${invoice.invoice_number || `INV-${invoice.invoice_id}`} - ${invoice.status || 'pending'}`,
      subtitle: invoice.user_name || 'Unknown customer',
      amount: Number(invoice.amount) || 0,
      date: invoice.created_at,
    })),
    ...payments.slice(0, 6).map((payment) => ({
      id: `payment-${payment.payment_id}`,
      type: 'Payment',
      title: payment.transaction_ref || `PAY-${payment.payment_id}`,
      subtitle: payment.user_name || 'Unknown customer',
      amount: Number(payment.amount_paid) || 0,
      date: payment.created_at,
    })),
  ]
    .filter((activity) => activity.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

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
    <div className="min-h-screen bg-transparent">
      <Header user={user} />
      <div className="flex">
        <Sidebar 
          userType={user.userType} 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        
        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-4 sm:mb-6 md:mb-8">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">Super Admin Dashboard</h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base md:text-lg text-gray-600">
                Welcome back, {user.name}! Manage your platform from here.
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 mb-6 sm:mb-8">
              <div className="card p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Users</p>
                    <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mt-1 sm:mt-2">
                      {isFetchingMetrics ? '...' : formatNumber(totalUsers)}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="card p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Schools</p>
                    <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mt-1 sm:mt-2">
                      {isFetchingMetrics ? '...' : formatNumber(totalSchools)}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="card p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Teachers</p>
                    <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mt-1 sm:mt-2">
                      {isFetchingMetrics ? '...' : formatNumber(totalTeachers)}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="card p-4 sm:p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Revenue</p>
                    <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mt-1 sm:mt-2">
                      {isFetchingMetrics ? '...' : formatCurrency(totalRevenue)}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="card p-4 sm:p-5 md:p-6">
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 mb-4">
                  Users by Role
                </h2>
                <div className="space-y-3">
                  {userTypeStats.map((item) => {
                    const barWidth = `${(item.count / maxUserTypeCount) * 100}%`;
                    return (
                      <div key={item.type}>
                        <div className="flex items-center justify-between text-xs sm:text-sm mb-1">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-semibold text-gray-900">{formatNumber(item.count)}</span>
                        </div>
                        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-600 rounded-full" style={{ width: barWidth }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card p-4 sm:p-5 md:p-6">
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 mb-4">
                  Invoice Status
                </h2>
                <div className="space-y-3">
                  {invoiceStatusStats.map((item) => {
                    const barWidth = `${(item.count / maxInvoiceStatusCount) * 100}%`;
                    const colorClass =
                      item.status === 'paid'
                        ? 'bg-primary-600'
                        : item.status === 'pending'
                        ? 'bg-primary-400'
                        : item.status === 'overdue'
                        ? 'bg-primary-700'
                        : 'bg-primary-300';
                    return (
                      <div key={item.status}>
                        <div className="flex items-center justify-between text-xs sm:text-sm mb-1">
                          <span className="text-gray-600 capitalize">{item.status}</span>
                          <span className="font-semibold text-gray-900">{formatNumber(item.count)}</span>
                        </div>
                        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${colorClass}`} style={{ width: barWidth }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-4 sm:p-5 md:p-6 mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <button className="p-3 sm:p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left">
                  <h3 className="text-sm sm:text-base font-medium text-gray-900">Create Admin</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">Add a new admin account</p>
                </button>
                <button className="p-3 sm:p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left">
                  <h3 className="text-sm sm:text-base font-medium text-gray-900">View Reports</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">Check system analytics</p>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card p-4 sm:p-5 md:p-6">
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">Recent Activity</h2>
              {recentActivities.length === 0 ? (
                <div className="text-center py-8 sm:py-10 md:py-12 text-gray-500">
                  <svg
                    className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <p className="mt-3 sm:mt-4 text-sm sm:text-base">No recent activity to display</p>
                  <p className="text-xs sm:text-sm mt-1">Activity will appear here once the system is in use</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="border border-gray-100 rounded-lg px-3 py-3 sm:px-4 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {activity.type}: {activity.title}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{activity.subtitle}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(activity.amount)}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

export default SuperAdminDashboard;

