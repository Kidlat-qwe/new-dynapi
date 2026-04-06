import React, { useState, useEffect } from 'react';
import { fetchGrading } from './lib/api';

const SchoolYear = () => {
  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSchoolYear, setNewSchoolYear] = useState('');
  const [modalError, setModalError] = useState('');
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [pendingActivateId, setPendingActivateId] = useState(null);

  const fetchSchoolYears = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchGrading('/api/school-years');
      if (!response.ok) throw new Error('Failed to fetch school years');
      const data = await response.json();
      setSchoolYears(data);
    } catch (error) {
      console.error('Error fetching school years:', error);
      setError('Error loading school years. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchoolYears();
  }, []);

  const handleAddSchoolYear = async (e) => {
    e.preventDefault();
    setModalError('');

    // Validate school year format (YYYY-YYYY)
    const yearPattern = /^\d{4}-\d{4}$/;
    if (!yearPattern.test(newSchoolYear)) {
      setModalError('Please enter a valid school year format (e.g., 2023-2024)');
      return;
    }

    const [startYear, endYear] = newSchoolYear.split('-').map(Number);
    if (endYear !== startYear + 1) {
      setModalError('End year should be the next year after start year');
      return;
    }

    try {
      const response = await fetchGrading('/api/school-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          school_year: newSchoolYear,
          is_active: false, // New school years are inactive by default
          activation_date: null // Will be set when activated
        })
      });

      if (!response.ok) throw new Error('Failed to add school year');
      
      await fetchSchoolYears();
      setShowAddModal(false);
      setNewSchoolYear('');
    } catch (error) {
      console.error('Error adding school year:', error);
      setModalError('Failed to add school year. Please try again.');
    }
  };

  const handleToggleActive = async (schoolYearId, currentStatus) => {
    if (currentStatus && schoolYears.filter(sy => sy.is_active).length === 1) {
      setError('Cannot deactivate the only active school year');
      return;
    }

    if (!currentStatus) {
      setPendingActivateId(schoolYearId);
      setShowActivateConfirm(true);
      return;
    }

    try {
      const response = await fetchGrading(`/api/school-years/${schoolYearId}/toggle-active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activation_date: !currentStatus ? new Date().toISOString() : null // Set activation date when activating
        })
      });

      if (!response.ok) throw new Error('Failed to update school year status');
      
      await fetchSchoolYears();
    } catch (error) {
      console.error('Error updating school year status:', error);
      setError('Failed to update school year status. Please try again.');
    }
  };

  return (
    <div className="content-container bg-[#F3F3F6]">
      <div className="p-8">
        {/* Add School Year button moved to top right */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#526D82] text-white rounded-md font-medium
              hover:bg-[#3E5367] transition-colors duration-200"
          >
            + ADD SCHOOL YEAR
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#526D82]">
                <th className="py-4 px-3 text-left text-white font-medium">School Year ID</th>
                <th className="py-4 px-3 text-left text-white font-medium">School Year Description</th>
                <th className="py-4 px-3 text-center text-white font-medium">Flag</th>
              </tr>
            </thead>
            <tbody>
              {schoolYears.map((schoolYear, index) => (
                <tr 
                  key={schoolYear.school_year_id}
                  className={`border-t border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                >
                  <td className="py-4 px-3 text-gray-800">{schoolYear.school_year_id}</td>
                  <td className="py-4 px-3 text-gray-800">{schoolYear.school_year}</td>
                  <td className="py-4 px-3 text-center">
                    <span 
                      className={`inline-block px-4 py-1.5 rounded-full text-sm ${
                        schoolYear.is_active 
                          ? 'bg-green-100 text-green-600'
                          : 'bg-red-50 text-red-800'
                      }`}
                      onClick={() => handleToggleActive(schoolYear.school_year_id, schoolYear.is_active)}
                      style={{ cursor: 'pointer' }}
                    >
                      {schoolYear.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="text-center mt-6">
            <p>Loading...</p>
          </div>
        )}
        
        {error && (
          <div className="text-center mt-6 text-red-600">
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* Add School Year Modal */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 z-40">
            <div className="absolute inset-0 backdrop-blur-[2px]" onClick={() => {
              setShowAddModal(false);
              setNewSchoolYear('');
              setModalError('');
            }}></div>
          </div>
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md no-blur">
              <div className="bg-gradient-to-r from-[#3E5367] to-[#526D82] px-6 py-4 rounded-t-lg">
                <h2 className="text-xl font-semibold text-white">Add School Year</h2>
              </div>

              <form onSubmit={handleAddSchoolYear} className="p-6">
                {modalError && (
                  <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 text-red-700">
                    {modalError}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      School Year Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 2023-2024"
                      value={newSchoolYear}
                      onChange={(e) => setNewSchoolYear(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setNewSchoolYear('');
                      setModalError('');
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#526D82] text-white rounded-md hover:bg-[#3E5367]"
                  >
                    Add School Year
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {showActivateConfirm && (
        <>
          <div className="fixed inset-0 backdrop-blur-[2px] z-40"></div>
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg relative z-10 border border-gray-200">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 p-2.5 rounded-full mr-3">
                  <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Activate School Year</h3>
              </div>
              <div className="mb-6 text-gray-700 text-base leading-relaxed">
                Activating a school year will set its <span className="font-semibold text-blue-700">start month for attendance and filtering</span> based on the activation date.
                <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                  <span className="font-semibold text-yellow-700">Are you sure you want to activate this school year?</span>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-2">
                <button
                  onClick={() => {
                    setShowActivateConfirm(false);
                    setPendingActivateId(null);
                  }}
                  className="px-5 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-100 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowActivateConfirm(false);
                    if (pendingActivateId) {
                      try {
                        const response = await fetchGrading(`/api/school-years/${pendingActivateId}/toggle-active`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            activation_date: new Date().toISOString()
                          })
                        });
                        if (!response.ok) throw new Error('Failed to update school year status');
                        await fetchSchoolYears();
                      } catch (error) {
                        setError('Failed to update school year status. Please try again.');
                      }
                      setPendingActivateId(null);
                    }
                  }}
                  className="px-5 py-2 bg-blue-600 text-white rounded-md font-semibold shadow-sm hover:bg-blue-700 transition"
                >
                  Activate
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SchoolYear;
