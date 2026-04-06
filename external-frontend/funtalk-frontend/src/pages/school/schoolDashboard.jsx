import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { fetchFuntalk } from '../../lib/api';

const SchoolDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [upcomingClasses, setUpcomingClasses] = useState(0);
  const [completedClasses, setCompletedClasses] = useState(0);
  const [creditsUsedThisMonth, setCreditsUsedThisMonth] = useState(0);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

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

  // Fetch dashboard data
  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setIsFetching(true);
    try {
      const [balanceRes, studentsRes, appointmentsRes, transactionsRes] = await Promise.all([
        fetchFuntalk('/credits/balance', {}),
        fetchFuntalk('/students', {}),
        fetchFuntalk('/appointments', {}),
        fetchFuntalk('/credits/transactions?limit=5', {}),
      ]);

      // Process credit balance
      const balanceData = await balanceRes.json();
      if (balanceData.success && balanceData.data?.current_balance !== undefined) {
        setCreditBalance(balanceData.data.current_balance);
      }

      // Process students
      const studentsData = await studentsRes.json();
      if (studentsData.success && studentsData.data?.students) {
        const activeStudents = studentsData.data.students.filter(s => s.is_active);
        setTotalStudents(activeStudents.length);
      }

      // Process appointments
      const appointmentsData = await appointmentsRes.json();
      if (appointmentsData.success && appointmentsData.data?.appointments) {
        const appointments = appointmentsData.data.appointments;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = appointments.filter(apt => {
          const aptDate = new Date(apt.appointment_date);
          aptDate.setHours(0, 0, 0, 0);
          return aptDate >= today && (apt.status === 'pending' || apt.status === 'approved');
        });
        setUpcomingClasses(upcoming.length);

        const completed = appointments.filter(apt => apt.status === 'completed');
        setCompletedClasses(completed.length);

        // Get recent appointments (next 5)
        const recent = upcoming
          .sort((a, b) => {
            const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`);
            const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`);
            return dateA - dateB;
          })
          .slice(0, 5);
        setRecentAppointments(recent);

        // Calculate credits used this month
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthDeductions = appointments.filter(apt => {
          const aptDate = new Date(apt.appointment_date);
          return aptDate.getMonth() === currentMonth && 
                 aptDate.getFullYear() === currentYear &&
                 apt.status !== 'cancelled';
        });
        setCreditsUsedThisMonth(monthDeductions.length);
      }

      // Process transactions
      const transactionsData = await transactionsRes.json();
      if (transactionsData.success && transactionsData.data?.transactions) {
        setRecentTransactions(transactionsData.data.transactions.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsFetching(false);
    }
  };

  // Format date and time
  const formatDateTime = (date, time) => {
    if (!date) return 'N/A';
    const d = new Date(`${date}T${time || '00:00'}`);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format status
  const formatStatus = (status) => {
    const statuses = {
      pending: 'Pending',
      approved: 'Approved',
      completed: 'Completed',
      cancelled: 'Cancelled',
      no_show: 'No Show',
    };
    return statuses[status] || status;
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Format transaction type
  const formatTransactionType = (type) => {
    const types = {
      purchase: 'Purchase',
      deduction: 'Deduction',
      adjustment: 'Adjustment',
    };
    return types[type] || type;
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
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Dashboard</h1>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Welcome back, {user.name}</p>
              </div>

              {isFetching ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <>
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {/* Credit Balance */}
                    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs sm:text-sm text-gray-600">Credit Balance</p>
                          <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-primary-600">{creditBalance}</p>
                        </div>
                        <div className="bg-primary-100 rounded-full p-3">
                          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <Link to="/school/packages" className="mt-3 sm:mt-4 text-xs sm:text-sm text-primary-600 hover:text-primary-800 font-medium">
                        Purchase Credits →
                      </Link>
                    </div>

                    {/* Total Students */}
                    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs sm:text-sm text-gray-600">Total Students</p>
                          <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{totalStudents}</p>
                        </div>
                        <div className="bg-blue-100 rounded-full p-3">
                          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                      </div>
                      <Link to="/school/students" className="mt-3 sm:mt-4 text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium">
                        Manage Students →
                      </Link>
                    </div>

                    {/* Upcoming Classes */}
                    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs sm:text-sm text-gray-600">Upcoming Classes</p>
                          <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{upcomingClasses}</p>
                        </div>
                        <div className="bg-green-100 rounded-full p-3">
                          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <Link to="/school/bookings" className="mt-3 sm:mt-4 text-xs sm:text-sm text-green-600 hover:text-green-800 font-medium">
                        View Bookings →
                      </Link>
                    </div>

                    {/* Credits Used This Month */}
                    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs sm:text-sm text-gray-600">Credits Used (This Month)</p>
                          <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{creditsUsedThisMonth}</p>
                        </div>
                        <div className="bg-purple-100 rounded-full p-3">
                          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                      </div>
                      <Link to="/school/credits" className="mt-3 sm:mt-4 text-xs sm:text-sm text-purple-600 hover:text-purple-800 font-medium">
                        View History →
                      </Link>
                    </div>
                  </div>

                  {/* Two Column Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Upcoming Appointments */}
                    <div className="bg-white rounded-lg shadow">
                      <div className="p-4 sm:p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Upcoming Appointments</h2>
                          <Link to="/school/bookings" className="text-xs sm:text-sm text-primary-600 hover:text-primary-800 font-medium">
                            View All →
                          </Link>
                        </div>
                      </div>
                      <div className="p-4 sm:p-6">
                        {recentAppointments.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-sm text-gray-500">No upcoming appointments</p>
                            <Link to="/school/bookings" className="mt-2 inline-block text-sm text-primary-600 hover:text-primary-800">
                              Book a class →
                            </Link>
                          </div>
                        ) : (
                          <div className="space-y-3 sm:space-y-4">
                            {recentAppointments.map((apt) => (
                              <div key={apt.appointment_id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                                        {apt.student_name || 'N/A'}
                                      </h3>
                                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(apt.status)}`}>
                                        {formatStatus(apt.status)}
                                      </span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-600">
                                      Teacher: {apt.teacher_name || 'N/A'}
                                    </p>
                                    <p className="text-xs sm:text-sm text-gray-600">
                                      {formatDateTime(apt.appointment_date, apt.appointment_time)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-lg shadow">
                      <div className="p-4 sm:p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Recent Activity</h2>
                          <Link to="/school/credits" className="text-xs sm:text-sm text-primary-600 hover:text-primary-800 font-medium">
                            View All →
                          </Link>
                        </div>
                      </div>
                      <div className="p-4 sm:p-6">
                        {recentTransactions.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-sm text-gray-500">No recent transactions</p>
                          </div>
                        ) : (
                          <div className="space-y-3 sm:space-y-4">
                            {recentTransactions.map((transaction) => (
                              <div key={transaction.transaction_id} className="flex items-center justify-between border-b border-gray-200 pb-3 last:border-0 last:pb-0">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {formatTransactionType(transaction.transaction_type)}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {new Date(transaction.created_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-semibold ${
                                    transaction.transaction_type === 'purchase' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {transaction.transaction_type === 'purchase' ? '+' : '-'}{transaction.amount}
                                  </p>
                                  <p className="text-xs text-gray-500">Balance: {transaction.balance_after}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
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

export default SchoolDashboard;
