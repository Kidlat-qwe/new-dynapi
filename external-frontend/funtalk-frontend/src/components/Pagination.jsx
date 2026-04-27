import React from 'react';

export default function Pagination({
  totalItems = 0,
  pageSize = 10,
  currentPage = 1,
  onPageChange,
  className = '',
}) {
  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const page = Math.min(totalPages, Math.max(1, Number(currentPage) || 1));

  const start = safeTotal === 0 ? 0 : (page - 1) * safePageSize + 1;
  const end = safeTotal === 0 ? 0 : Math.min(safeTotal, page * safePageSize);

  const go = (nextPage) => {
    if (typeof onPageChange === 'function') onPageChange(nextPage);
  };

  if (safeTotal <= safePageSize) return null;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 ${className}`}>
      <div className="text-xs sm:text-sm text-gray-600">
        Showing <span className="font-medium text-gray-900">{start}</span>–<span className="font-medium text-gray-900">{end}</span>{' '}
        of <span className="font-medium text-gray-900">{safeTotal}</span>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        <div className="text-xs sm:text-sm text-gray-600">
          Page <span className="font-medium text-gray-900">{page}</span> of{' '}
          <span className="font-medium text-gray-900">{totalPages}</span>
        </div>

        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}

