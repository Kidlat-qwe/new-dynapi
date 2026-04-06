import React, { useState, useEffect, useCallback } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import axios from 'axios';
import { gradingUrl, getAuthHeader } from '../lib/api';

// Component for the class record grid
const ClassRecordGrid = ({ classId, subjectId, schoolYearId, quarter, teacherId }) => {
  const [rowData, setRowData] = useState([]);
  const [activities, setActivities] = useState({
    written: [],
    performance: [],
    assessment: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gradingCriteria, setGradingCriteria] = useState({
    writtenPercentage: 0,
    performancePercentage: 0,
    assessmentPercentage: 0
  });

  // Fetch grading criteria based on subject
  const fetchGradingCriteria = useCallback(async () => {
    try {
      const response = await axios.get(gradingUrl('/api/grading-criteria'), {
        params: { subjectId, schoolYearId },
        headers: getAuthHeader()
      });
      
      if (response.data) {
        setGradingCriteria({
          writtenPercentage: response.data.written_works_percentage,
          performancePercentage: response.data.performance_tasks_percentage,
          assessmentPercentage: response.data.quarterly_assessment_percentage
        });
      }
    } catch (error) {
      console.error('Error fetching grading criteria:', error);
    }
  }, [subjectId, schoolYearId]);

  const columnHelper = createColumnHelper();

  const columns = React.useMemo(() => [
    columnHelper.accessor('studentName', {
      header: "Student Name",
      size: 200,
    }),
    // Written Works columns
    columnHelper.group({
      header: () => (
        <div className="flex items-center justify-between p-2">
          <span>Written Works ({gradingCriteria.writtenPercentage}%)</span>
          <button
            onClick={() => handleAddActivity('written')}
            className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
          >
            +
          </button>
        </div>
      ),
      columns: activities.written.map(activity => 
        columnHelper.accessor(`written_${activity.id}`, {
          header: activity.title,
          cell: info => info.getValue() || '',
        })
      )
    }),
    // Performance Tasks columns
    columnHelper.group({
      header: () => (
        <div className="flex items-center justify-between p-2">
          <span>Performance Tasks ({gradingCriteria.performancePercentage}%)</span>
          <button
            onClick={() => handleAddActivity('performance')}
            className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
          >
            +
          </button>
        </div>
      ),
      columns: activities.performance.map(activity => 
        columnHelper.accessor(`performance_${activity.id}`, {
          header: activity.title,
          cell: info => info.getValue() || '',
        })
      )
    }),
    // Quarterly Assessment column
    columnHelper.group({
      header: () => (
        <div className="flex items-center justify-between p-2">
          <span>Quarterly Assessment ({gradingCriteria.assessmentPercentage}%)</span>
          {!activities.assessment.length && (
            <button
              onClick={() => handleAddActivity('assessment')}
              className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
            >
              +
            </button>
          )}
        </div>
      ),
      columns: activities.assessment.map(activity => 
        columnHelper.accessor(`assessment_${activity.id}`, {
          header: activity.title,
          cell: info => info.getValue() || '',
        })
      )
    }),
    columnHelper.accessor('initialGrade', {
      header: 'Initial Grade',
      cell: info => info.getValue() || '',
    }),
    columnHelper.accessor('quarterlyGrade', {
      header: 'Quarterly Grade',
      cell: info => info.getValue() || '',
    }),
  ], [activities, gradingCriteria]);

  const table = useReactTable({
    data: rowData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Add useEffect to fetch students and activities
  useEffect(() => {
    const fetchActivitiesAndGrades = async () => {
      if (classId && quarter) {
        try {
          setLoading(true);
          
          // Fetch students using the class-students endpoint
          const studentsResponse = await axios.get(gradingUrl('/api/classes/class-students'), {
            params: { classId },
            headers: getAuthHeader()
          });
          
          // Fetch activities using the correct endpoint
          const schoolYear = schoolYearId || activeSchoolYear;
          
          if (!schoolYear) {
            console.warn('No school year ID available');
            return;
          }

          const activitiesResponse = await axios.get(gradingUrl('/api/activities'), {
            params: { classId, subjectId, schoolYearId: schoolYear, quarter },
            headers: getAuthHeader()
          });

          // Filter activities by type
          const writtenActivities = activitiesResponse.data.filter(act => act.activity_type === 'written_works');
          const performanceActivities = activitiesResponse.data.filter(act => act.activity_type === 'performance_tasks');
          const assessmentActivity = activitiesResponse.data.find(act => act.activity_type === 'quarterly_assessment');

          setActivities({
            written: writtenActivities,
            performance: performanceActivities,
            assessment: assessmentActivity ? [assessmentActivity] : []
          });

          // Create row data with students and their grades
          const studentRows = studentsResponse.data.map(student => ({
            studentName: `${student.lname}, ${student.fname} ${student.mname || ''}`,
            // Add empty cells for each activity
            ...writtenActivities.reduce((acc, act) => ({ 
              ...acc, 
              [`written_${act.activity_id}`]: '' 
            }), {}),
            ...performanceActivities.reduce((acc, act) => ({ 
              ...acc, 
              [`performance_${act.activity_id}`]: '' 
            }), {}),
            ...(assessmentActivity ? { [`assessment_${assessmentActivity.activity_id}`]: '' } : {}),
            initialGrade: '',
            quarterlyGrade: ''
          }));

          // Add the "HIGHEST POSSIBLE SCORE" row
          const highestScoreRow = {
            studentName: 'HIGHEST POSSIBLE SCORE',
            ...writtenActivities.reduce((acc, act) => ({ 
              ...acc, 
              [`written_${act.activity_id}`]: act.max_score 
            }), {}),
            ...performanceActivities.reduce((acc, act) => ({ 
              ...acc, 
              [`performance_${act.activity_id}`]: act.max_score 
            }), {}),
            ...(assessmentActivity ? { [`assessment_${assessmentActivity.activity_id}`]: act.max_score } : {}),
            initialGrade: '',
            quarterlyGrade: ''
          };

          setRowData([highestScoreRow, ...studentRows]);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching activities and grades:', error);
          setError('Failed to load activities and grades');
          setLoading(false);
        }
      }
    };

    fetchActivitiesAndGrades();
    fetchGradingCriteria();
  }, [classId, quarter, subjectId, schoolYearId, activeSchoolYear]);

  // Add your existing fetch and handler functions here
  const handleAddActivity = (type) => {
    // Your existing add activity logic
  };

  // Add loading and error states to the render
  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      {getToolbar && getToolbar()}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="bg-gray-100">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className="border border-gray-300 p-2 text-left"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td 
                    key={cell.id} 
                    className="border border-gray-300 p-2"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4 p-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            {'<<'}
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            {'<'}
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            {'>'}
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            {'>>'}
          </button>
        </div>
        <span className="flex items-center gap-1">
          <div>Page</div>
          <strong>
            {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </strong>
        </span>
      </div>
    </div>
  );
};

export default ClassRecordGrid; 