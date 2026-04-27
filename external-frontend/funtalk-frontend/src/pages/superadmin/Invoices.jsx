import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';
import ResponsiveSelect from '../../components/ResponsiveSelect';
import Pagination from '../../components/Pagination.jsx';
import { computeFixedActionMenuPosition } from '../../utils/actionMenuPosition.js';

const Invoices = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [payModalInvoice, setPayModalInvoice] = useState(null);
  const [receiptModalUrl, setReceiptModalUrl] = useState('');
  const [payForm, setPayForm] = useState({
    paymentType: 'bank_transfer',
    referenceNumber: '',
    remarks: '',
    paymentAttachment: null,
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [invoiceNumberSearch, setInvoiceNumberSearch] = useState('');
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

  // Fetch invoices
  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user, statusFilter]);

  const fetchInvoices = async () => {
    setIsFetching(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/billing/invoices`;
      const params = new URLSearchParams();
      
      if (statusFilter) {
        params.append('status', statusFilter);
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
      if (data.success && data.data?.invoices) {
        setInvoices(data.data.invoices);
      } else {
        console.error('Error fetching invoices:', data.message);
        setInvoices([]);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setInvoices([]);
    } finally {
      setIsFetching(false);
    }
  };

  const handlePayInvoice = async (invoiceId) => {
    if (!payForm.referenceNumber.trim()) {
      alert('Reference number is required.');
      return;
    }
    if (!payForm.paymentAttachment) {
      alert('Attachment image is required.');
      return;
    }
    setPayingInvoiceId(invoiceId);
    try {
      const token = localStorage.getItem('token');
      const payload = new FormData();
      payload.append('paymentType', payForm.paymentType);
      payload.append('referenceNumber', payForm.referenceNumber.trim());
      if (payForm.remarks?.trim()) payload.append('remarks', payForm.remarks.trim());
      payload.append('paymentAttachment', payForm.paymentAttachment);
      const response = await fetch(`${API_BASE_URL}/billing/${invoiceId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });
      const raw = await response.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { message: raw };
      }
      if (!response.ok || !data.success) {
        alert(data.message || 'Failed to mark invoice as paid');
        return;
      }
      alert(data.message || 'Invoice marked as paid');
      setPayModalInvoice(null);
      setPayForm({
        paymentType: 'bank_transfer',
        referenceNumber: '',
        remarks: '',
        paymentAttachment: null,
      });
      fetchInvoices();
    } catch (error) {
      console.error('Error paying invoice:', error);
      alert('Failed to pay invoice. Please try again.');
    } finally {
      setPayingInvoiceId(null);
    }
  };

  const handleDownloadInvoice = async (invoiceId) => {
    setDownloadingInvoiceId(invoiceId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/billing/invoices/${invoiceId}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        alert(data?.message || 'Failed to download invoice PDF');
        return;
      }
      const pdfBlob = await response.blob();
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error) {
      console.error('Error downloading invoice PDF:', error);
      alert('Failed to download invoice PDF');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  // Filter invoices by invoice number
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = !invoiceNumberSearch || 
      invoice.invoice_number?.toLowerCase().includes(invoiceNumberSearch.toLowerCase()) ||
      invoice.user_name?.toLowerCase().includes(invoiceNumberSearch.toLowerCase());
    return matchesSearch;
  });

  useEffect(() => {
    setPage(1);
  }, [statusFilter, invoiceNumberSearch]);

  const pageSize = 10;
  const pagedInvoices = filteredInvoices.slice((page - 1) * pageSize, page * pageSize);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return 'NT$0.00';
    return `${'NT$'}${parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const getReceiptHref = (receiptUrl) => {
    if (!receiptUrl) return '';
    if (receiptUrl.startsWith('http://') || receiptUrl.startsWith('https://')) {
      return receiptUrl;
    }
    return `${API_BASE_URL.replace('/api', '')}${receiptUrl}`;
  };
  const isPdfUrl = (url) => /\.pdf($|\?)/i.test(String(url || ''));

  // Format status
  const formatStatus = (status) => {
    const statuses = {
      paid: 'Paid',
      pending: 'Pending',
      overdue: 'Overdue',
      cancelled: 'Cancelled',
    };
    return statuses[status] || status;
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Calculate totals
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  const paidAmount = filteredInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  const pendingAmount = filteredInvoices
    .filter(inv => inv.status === 'pending')
    .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

  useEffect(() => {
    const closeMenu = () => setOpenActionMenuId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

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
        
        <main className="flex-1 lg:ml-64 p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-4 sm:space-y-6">
              {/* Page Header */}
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Invoices</h1>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-gray-600">Manage billing invoices</p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="card p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-500">Total Invoices</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{filteredInvoices.length}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-500">Total Amount</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-500">Paid</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(paidAmount)}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-4 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-500">Pending</p>
                      <p className="text-xl sm:text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                <div className="min-w-0 flex-1 sm:max-w-md">
                  <input
                    id="invoices-search"
                    type="search"
                    aria-label="Search invoices"
                    placeholder="Search by invoice number"
                    value={invoiceNumberSearch}
                    onChange={(e) => setInvoiceNumberSearch(e.target.value)}
                    autoComplete="off"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="w-full sm:w-auto sm:min-w-[10rem]">
                  <ResponsiveSelect
                    id="invoices-status-filter"
                    aria-label="Filter invoices by status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="">All statuses</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </ResponsiveSelect>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="card">
                {isFetching ? (
                  <div className="p-8 sm:p-10 md:p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Loading invoices...</p>
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="p-8 sm:p-10 md:p-12 text-center">
                    <svg
                      className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-gray-900">No invoices found</h3>
                    <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                      {invoiceNumberSearch || statusFilter
                        ? 'Try adjusting your filters'
                        : 'No invoices available'}
                    </p>
                  </div>
                ) : (
                  <>
                  <div className="overflow-x-auto rounded-b-xl">
                    <table className="min-w-[1240px] w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Invoice number
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Customer</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Package</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Due Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Receipt</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Created</th>
                          <th className="sticky right-0 z-10 bg-gray-50 px-4 py-3 text-right text-xs font-medium text-gray-500 tracking-wider shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.08)]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pagedInvoices.map((invoice) => (
                          <tr key={invoice.invoice_id} className="group hover:bg-gray-50">
                            <td className="px-4 py-4 align-top">
                              <div className="text-sm font-medium text-gray-900 break-all">
                                {invoice.invoice_number || `INV-${invoice.invoice_id}`}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="text-sm font-medium text-gray-900 truncate">{invoice.user_name || 'N/A'}</div>
                              <div className="text-xs text-gray-500 break-all">{invoice.email || ''}</div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="text-sm text-gray-900">{invoice.package_name || '-'}</div>
                              {invoice.billing_type && (
                                <div className="text-xs text-gray-500">{invoice.billing_type}</div>
                              )}
                            </td>
                            <td className="px-4 py-4 align-top text-right">
                              <div className="text-sm font-bold text-gray-900">{formatCurrency(invoice.amount)}</div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                                {formatStatus(invoice.status)}
                              </span>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="text-sm text-gray-500">{formatDate(invoice.due_date)}</div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              {invoice.receipt_url ? (
                                <button
                                  type="button"
                                  onClick={() => setReceiptModalUrl(getReceiptHref(invoice.receipt_url))}
                                  className="text-sm text-primary-600 hover:text-primary-700 underline"
                                >
                                  View receipt
                                </button>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="text-sm text-gray-500">{formatDate(invoice.created_at)}</div>
                            </td>
                            <td className="sticky right-0 z-[1] bg-white px-4 py-4 align-top text-right shadow-[-2px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-gray-50">
                              <div className="relative inline-flex action-menu">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setMenuPosition(
                                      computeFixedActionMenuPosition({
                                        rect,
                                        menuWidth: 176, // w-44
                                        menuHeight: 170,
                                        gap: 6,
                                      })
                                    );
                                    setOpenActionMenuId(openActionMenuId === invoice.invoice_id ? null : invoice.invoice_id);
                                  }}
                                  className="text-gray-600 hover:text-gray-900 focus:outline-none p-1"
                                  title="Actions"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
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
                    <Pagination totalItems={filteredInvoices.length} pageSize={pageSize} currentPage={page} onPageChange={setPage} />
                  </div>
                  </>
                )}
              </div>

              {openActionMenuId && createPortal(
                <div
                  className="fixed w-44 bg-white rounded-md shadow-xl z-[9999] border border-gray-200 action-menu"
                  style={{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleDownloadInvoice(openActionMenuId);
                        setOpenActionMenuId(null);
                      }}
                      disabled={downloadingInvoiceId === openActionMenuId}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {downloadingInvoiceId === openActionMenuId ? 'Preparing PDF...' : 'Download Invoice'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = invoices.find((i) => i.invoice_id === openActionMenuId);
                        if (!target || target.status === 'paid') return;
                        setPayModalInvoice(target);
                        setPayForm({
                          paymentType: 'bank_transfer',
                          referenceNumber: '',
                          remarks: '',
                          paymentAttachment: null,
                        });
                        setOpenActionMenuId(null);
                      }}
                      disabled={(() => {
                        const target = invoices.find((i) => i.invoice_id === openActionMenuId);
                        return !target || target.status === 'paid' || payingInvoiceId === openActionMenuId;
                      })()}
                      className="block w-full text-left px-4 py-2 text-sm text-primary-700 hover:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {(() => {
                        const target = invoices.find((i) => i.invoice_id === openActionMenuId);
                        if (payingInvoiceId === openActionMenuId) return 'Paying...';
                        if (target?.status === 'paid') return 'Pay Invoice (Paid)';
                        return 'Pay Invoice';
                      })()}
                    </button>
                  </div>
                </div>,
                document.body
              )}

              {payModalInvoice && (
                <div
                  className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
                  onClick={() => setPayModalInvoice(null)}
                >
                  <div
                    className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-[#e8ddd8]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-5 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Pay Invoice</h3>
                      <p className="text-sm text-gray-600 mt-1">Confirm the invoice details before marking as paid.</p>
                    </div>

                    <div className="px-5 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500">Invoice #</p>
                          <p className="font-medium text-gray-900">{payModalInvoice.invoice_number || `INV-${payModalInvoice.invoice_id}`}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Status</p>
                          <p className="font-medium text-gray-900">{formatStatus(payModalInvoice.status)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Customer</p>
                          <p className="font-medium text-gray-900">{payModalInvoice.user_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Due Date</p>
                          <p className="font-medium text-gray-900">{formatDate(payModalInvoice.due_date)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-500">Amount</p>
                          <p className="text-lg font-semibold text-gray-900">{formatCurrency(payModalInvoice.amount)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Payment Type</label>
                          <ResponsiveSelect
                            value={payForm.paymentType}
                            onChange={(e) => setPayForm((prev) => ({ ...prev, paymentType: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            aria-label="Payment Type"
                          >
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="card">Card</option>
                            <option value="e_wallet">E-wallets</option>
                            <option value="cash">Cash</option>
                            <option value="other">Other</option>
                          </ResponsiveSelect>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Reference Number <span className="text-red-600" aria-hidden="true">*</span>
                          </label>
                          <input
                            type="text"
                            value={payForm.referenceNumber}
                            onChange={(e) => setPayForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Enter transaction reference"
                            required
                            aria-required="true"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Attachment Image <span className="text-red-600" aria-hidden="true">*</span>
                          </label>
                          <input
                            type="file"
                            accept=".pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                            onChange={(e) =>
                              setPayForm((prev) => ({ ...prev, paymentAttachment: e.target.files?.[0] || null }))
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                            required
                            aria-required="true"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                          <textarea
                            value={payForm.remarks}
                            onChange={(e) => setPayForm((prev) => ({ ...prev, remarks: e.target.value }))}
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Additional notes"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPayModalInvoice(null)}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        disabled={payingInvoiceId === payModalInvoice.invoice_id}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePayInvoice(payModalInvoice.invoice_id)}
                        disabled={
                          payModalInvoice.status === 'paid' ||
                          payingInvoiceId === payModalInvoice.invoice_id ||
                          !payForm.referenceNumber.trim() ||
                          !payForm.paymentAttachment
                        }
                        className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {payingInvoiceId === payModalInvoice.invoice_id
                          ? 'Paying...'
                          : payModalInvoice.status === 'paid'
                          ? 'Already Paid'
                          : 'Confirm Pay'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {receiptModalUrl && (
                <div
                  className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
                  onClick={() => setReceiptModalUrl('')}
                >
                  <div
                    className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col border border-[#e8ddd8]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">Receipt Preview</h3>
                      <button
                        type="button"
                        onClick={() => setReceiptModalUrl('')}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex-1 p-3 sm:p-4">
                      {isPdfUrl(receiptModalUrl) ? (
                        <iframe
                          src={receiptModalUrl}
                          title="Receipt PDF"
                          className="w-full h-full rounded border border-gray-200"
                        />
                      ) : (
                        <img
                          src={receiptModalUrl}
                          alt="Receipt"
                          className="w-full h-full object-contain rounded border border-gray-200"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Results Count */}
              {filteredInvoices.length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredInvoices.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
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

export default Invoices;
