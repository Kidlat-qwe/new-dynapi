import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Pagination from './components/Pagination';
import { gradingUrl, getAuthHeader } from './lib/api';

const ITEMS_PER_PAGE = 10;
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'DROPPED_OUT', label: 'DROPPED OUT' },
  { value: 'TRANSFERRED_OUT', label: 'TRANSFERRED OUT' },
  { value: 'TRANSFERRED_IN', label: 'TRANSFERRED IN' },
  { value: '-', label: 'No Status' },
];

const StudentList = () => {
  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const fetchStudentsAndStatuses = async () => {
      setLoading(true);
      try {
        // Fetch all students
        const studentsRes = await axios.get(gradingUrl('/api/students'), { headers: getAuthHeader() });
        const studentsData = studentsRes.data || [];
        setStudents(studentsData);

        // Fetch all statuses
        const statusRes = await axios.get(gradingUrl('/api/student-status'), { headers: getAuthHeader() });
        // statusRes.data should be an array of status records
        const statusMap = {};
        (statusRes.data.data || statusRes.data || []).forEach(status => {
          statusMap[status.student_id] = status.status_type;
        });
        setStatuses(statusMap);
        setError(null);
      } catch (err) {
        setError('Failed to fetch students or statuses.');
      } finally {
        setLoading(false);
      }
    };
    fetchStudentsAndStatuses();
  }, []);

  // Filter students by search query and status
  const filteredStudents = students.filter(student => {
    const name = `${student.fname || ''} ${student.mname || ''} ${student.lname || ''}`.toLowerCase();
    const status = statuses[student.user_id] || '-';
    const nameMatch = name.includes(searchQuery.toLowerCase());
    const statusMatch =
      statusFilter === 'all' ? true :
      statusFilter === '-' ? status === '-' :
      status === statusFilter;
    return nameMatch && statusMatch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to first page if filtered list or search/filter changes and currentPage is out of range
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredStudents, totalPages, currentPage]);

  return (
    <div className="content-container bg-[#F3F3F6] p-8 overflow-auto">
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#526D82]">
              <th className="py-4 px-6 text-left text-white font-medium text-sm w-[10%]">Student ID</th>
              <th className="py-4 px-6 text-left text-white font-medium w-[22%]">
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="p-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82] w-full text-gray-800 bg-white shadow-sm text-sm"
                />
              </th>
              <th className="py-4 px-6 text-left text-white font-medium w-[15%]">LRN</th>
              <th className="py-4 px-6 text-left text-white font-medium w-[15%]">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="p-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#526D82] focus:border-[#526D82] w-full text-gray-800 bg-white shadow-sm text-sm"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">Loading...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-red-500">{error}</td>
              </tr>
            ) : paginatedStudents.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">No students found.</td>
              </tr>
            ) : (
              paginatedStudents.map((student, index) => (
                <tr
                  key={student.user_id}
                  className={`border-t border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                >
                  <td className="py-4 px-6 text-gray-800">{student.user_id}</td>
                  <td className="py-4 px-6 text-gray-800 truncate max-w-0" title={`${student.fname || ''} ${student.mname || ''} ${student.lname || ''}`.trim()}>
                    {`${student.fname || ''} ${student.mname || ''} ${student.lname || ''}`.trim()}
                  </td>
                  <td className="py-4 px-6 text-gray-800">{student.lrn || '-'}</td>
                  <td className="py-4 px-6 text-gray-800">{statuses[student.user_id] || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* Pagination Component */}
        {filteredStudents.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  );
};

export default StudentList;
