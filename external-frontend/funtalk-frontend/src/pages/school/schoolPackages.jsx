import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { fetchFuntalk } from '../../lib/api';

const SchoolPackages = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [packages, setPackages] = useState([]);
  const [creditBalance, setCreditBalance] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [billingType, setBillingType] = useState('invoice');
  const [isPurchasing, setIsPurchasing] = useState(false);

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
      fetchPackages();
      fetchCreditBalance();
    }
  }, [user]);

  const fetchPackages = async () => {
    setIsFetching(true);
    try {
      const response = await fetchFuntalk('/billing/packages?isActive=true', {});

      const data = await response.json();
      if (data.success && data.data?.packages) {
        setPackages(data.data.packages);
      } else {
        console.error('Error fetching packages:', data.message);
        setPackages([]);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      setPackages([]);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchCreditBalance = async () => {
    try {
      const response = await fetchFuntalk('/credits/balance', {});

      const data = await response.json();
      if (data.success && data.data?.current_balance !== undefined) {
        setCreditBalance(data.data.current_balance);
      }
    } catch (error) {
      console.error('Error fetching credit balance:', error);
    }
  };

  const handlePurchaseClick = (pkg) => {
    setSelectedPackage(pkg);
    setIsPurchaseModalOpen(true);
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setIsPurchasing(true);
    try {
      const response = await fetchFuntalk('/billing/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageId: selectedPackage.package_id,
          billingType: billingType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || 'Error purchasing package. Please try again.');
        return;
      }

      alert('Package purchase request created successfully! An invoice will be generated for admin approval.');
      setIsPurchaseModalOpen(false);
      setSelectedPackage(null);
      fetchCreditBalance();
    } catch (error) {
      console.error('Error purchasing package:', error);
      alert('Network error. Please check your connection and try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const formatPrice = (price) => {
    if (!price) return '$0.00';
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const calculatePricePerCredit = (price, credits) => {
    if (!credits || credits === 0) return '$0.00';
    return `$${(parseFloat(price) / credits).toFixed(2)}`;
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
              {/* Page Header with Credit Balance */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Packages</h1>
                    <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Purchase credit packages</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs sm:text-sm text-gray-600">Current Balance</p>
                    <p className="text-2xl sm:text-3xl font-bold text-primary-600">{creditBalance} Credits</p>
                    <Link to="/school/credits" className="text-xs sm:text-sm text-primary-600 hover:text-primary-800 mt-1 inline-block">
                      View History →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Packages Grid */}
              {isFetching ? (
                <div className="p-8 sm:p-10 md:p-12 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Loading packages...</p>
                </div>
              ) : packages.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 sm:p-10 md:p-12 text-center">
                  <svg className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">No packages available</h3>
                  <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Please contact administrator for package options</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {packages.map((pkg) => (
                    <div key={pkg.package_id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200">
                      <div className="p-4 sm:p-6">
                        {pkg.package_type && (
                          <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 mb-3">
                            {pkg.package_type}
                          </span>
                        )}
                        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{pkg.package_name}</h3>
                        <div className="mb-4">
                          <p className="text-3xl sm:text-4xl font-bold text-primary-600">{pkg.credits_value}</p>
                          <p className="text-xs sm:text-sm text-gray-600">Credits</p>
                        </div>
                        <div className="border-t border-gray-200 pt-4 mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">Price:</span>
                            <span className="text-lg sm:text-xl font-bold text-gray-900">{formatPrice(pkg.price)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Per Credit:</span>
                            <span className="text-sm font-semibold text-gray-700">{calculatePricePerCredit(pkg.price, pkg.credits_value)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handlePurchaseClick(pkg)}
                          className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          Purchase Package
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Purchase Modal */}
      {isPurchaseModalOpen && selectedPackage && createPortal(
        <div 
          className="fixed bg-black bg-opacity-50 flex items-center justify-center p-4" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            zIndex: 99999,
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsPurchaseModalOpen(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Purchase Package</h2>
                <button
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{selectedPackage.package_name}</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Credits:</span>
                      <span className="font-semibold">{selectedPackage.credits_value}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Price:</span>
                      <span className="font-semibold">{formatPrice(selectedPackage.price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Per Credit:</span>
                      <span className="font-semibold">{calculatePricePerCredit(selectedPackage.price, selectedPackage.credits_value)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Billing Type
                  </label>
                  <select
                    value={billingType}
                    onChange={(e) => setBillingType(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="invoice">Invoice (Admin Approval)</option>
                    <option value="bank_transfer">Bank Transfer (Admin Approval)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    An invoice will be generated for admin approval. Credits will be added once payment is approved.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-700">Current Balance:</span>
                    <span className="text-sm font-semibold">{creditBalance} Credits</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Balance After Purchase:</span>
                    <span className="text-sm font-semibold text-primary-600">{creditBalance + selectedPackage.credits_value} Credits</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    onClick={() => setIsPurchaseModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    disabled={isPurchasing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePurchase}
                    className="w-full sm:w-auto px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isPurchasing}
                  >
                    {isPurchasing ? 'Processing...' : 'Confirm Purchase'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

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

export default SchoolPackages;
