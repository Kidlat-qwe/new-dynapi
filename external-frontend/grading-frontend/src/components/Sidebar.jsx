import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import lcaLogo from '../assets/LCA Logo.jpg';

const Sidebar = ({ isSidebarOpen, isMobileMenuOpen }) => {
  const [userType, setUserType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const searchInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Get userType from localStorage when component mounts
    const storedUserType = localStorage.getItem('userType');
    setUserType(storedUserType || '');
  }, []);

  const getMenuItems = (userType) => {
    const allMenuItems = {
      admin: [
        { 
          name: 'Home', 
          path: '/home', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          )
        },
        { 
          name: 'Teacher List', 
          path: '/manage-teacher',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          )
        },
        { 
          name: 'Student List', 
          path: '/student-list', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0zm6 4v2a2 2 0 01-2 2h-7a2 2 0 01-2-2v-2a6 6 0 0112 0z" />
            </svg>
          )
        },
        { 
          name: 'Student Grades', 
          path: '/student-grade', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          )
        },
        { 
          name: 'Academic Ranking', 
          path: '/academic-ranking', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          )
        },
        { 
          name: 'Grading Criteria', 
          path: '/grading-criteria', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A59.769 59.769 0 0 0 3.375 4.5m11.9 3.664A59.768 59.768 0 0 1 3.375 4.5m0 0a59.77 59.77 0 0 1 11.9-3.664M3.375 4.5h1.5" />
            </svg>
          ) 
        },
        { 
          name: 'School Year', 
          path: '/school-year', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          )
        },
        {
          name: 'Manage',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          ),
          isDropdown: true,
          children: [
            { 
              name: 'Class', 
              path: '/manage-class', 
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                </svg>
              )
            },
            { 
              name: 'Subject', 
              path: '/manage-subject', 
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              )
            },
            { 
              name: 'Users', 
              path: '/manage-user', 
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
              )
            }
          ]
        }
      ],
      teacher: [
        { 
          name: 'Home', 
          path: '/home', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9a.999.999 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13zm9-8.586 6 6V15l.001 5H6v-9.586l6-6z" />
            </svg>
          )
        },
        { 
          name: 'My Class', 
          path: '/my-class', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
            </svg>
          )
        },
        { 
          name: 'Attendance', 
          path: '/attendance', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V9h14v10zM5 7V5h14v2H5zm5.56 10.46l5.93-5.93-1.06-1.06-4.87 4.87-2.11-2.11-1.06 1.06z"/>
            </svg>
          )
        },
        { 
          name: 'Academic Ranking', 
          path: '/academic-ranking', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          )
        },
        {
          name: 'Summary of Quarterly Grade',
          path: '/summary-quarterly-grade',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-6 4h6a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
          className: 'text-xs'
        }
      ],
      student: [
        { 
          name: 'Home', 
          path: '/home', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9a.999.999 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13zm9-8.586 6 6V15l.001 5H6v-9.586l6-6z" />
            </svg>
          )
        },
        { 
          name: 'View Grades', 
          path: '/view-grade', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V10h16v11zm0-13H4V5h16v3z"/>
              <path fill="currentColor" d="M6 12h4v4H6zm6 0h6v1h-6zm0 3h6v1h-6z"/>
            </svg>
          )
        },
        { 
          name: 'Academic Ranking', 
          path: '/academic-ranking', 
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          )
        }
      ]
    };

    return allMenuItems[userType.toLowerCase()] || [];
  };

  const menuItems = getMenuItems(userType);

  const handleViewGradesClick = async (e) => {
    if (userType.toLowerCase() === 'teacher') {
      e.preventDefault();
      const teacherId = localStorage.getItem('userId');
      navigate(`/view-grade/${teacherId}`);
    }
  };

  // Handle dropdown toggle
  const handleDropdownToggle = (index) => {
    if (openDropdown === index) {
      setOpenDropdown(null);
    } else {
      setOpenDropdown(index);
    }
  };

  // Check if the current route is part of the manage dropdown
  const isManageActive = location.pathname === '/manage-class' || 
                         location.pathname === '/manage-subject' || 
                         location.pathname === '/manage-user';

  return (
    <aside className={`
      h-screen bg-white border-r border-gray-200
      transition-all duration-300
      ${isSidebarOpen ? 'w-64' : 'w-16'}
    `}>
      {/* Logo section */}
      <div className="h-20 flex items-center justify-center">
        <div className={`
          transition-all duration-300 overflow-hidden flex items-center justify-center
          ${isSidebarOpen ? 'w-56' : 'w-12'}
        `}>
          <img 
            src={lcaLogo} 
            alt="LCA Logo" 
            className={`
              transition-all duration-300
              ${isSidebarOpen ? 'w-[5rem] h-[5rem]' : 'w-10 h-10'}
              object-contain
            `}
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="h-[calc(100vh-80px)] overflow-y-auto">
        <ul className="space-y-1 p-2">
          {menuItems.map((item, index) => {
            const isActive = item.isDropdown 
              ? (isManageActive || openDropdown === index)
              : location.pathname === item.path;
            
            return (
              <li key={index} className="relative group">
                {item.isDropdown ? (
                  <div 
                    className={`
                      relative block w-full rounded-lg cursor-pointer
                      transition-all duration-200 ease-in-out
                      ${openDropdown === index && !location.pathname.startsWith('/manage-')
                        ? 'bg-[#7C9C70] text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                      }
                      ${openDropdown === index ? 'rounded-b-none' : ''}
                    `}
                    onClick={() => handleDropdownToggle(index)}
                  >
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-5 h-5 flex items-center justify-center">
                          {item.icon}
                        </div>
                        <span className={`
                          ml-3 font-medium whitespace-nowrap
                          ${item.name === 'Summary of Quarterly Grade' ? 'text-xs' : ''}
                          ${!isSidebarOpen ? 'opacity-0 translate-x-10 hidden' : 'opacity-100 translate-x-0'}
                        `}>
                          {item.name}
                        </span>
                      </div>
                      {isSidebarOpen && (
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className={`w-4 h-4 transition-transform ${openDropdown === index ? 'rotate-180' : ''}`} 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                    
                    {/* Dropdown Menu */}
                    {openDropdown === index && (
                      <div 
                        className={`
                          ${isSidebarOpen ? 'bg-white pb-2' : 'fixed left-16 top-0 mt-0 bg-white shadow-lg rounded-lg py-2 min-w-[180px] z-50'}
                          transition-all duration-200 ease-in-out
                        `}
                        style={!isSidebarOpen ? { top: `${55 + (index * 44)}px` } : {}}
                      >
                        {item.children.map((child, childIndex) => {
                          const isChildActive = location.pathname === child.path;
                          return (
                            <Link
                              key={childIndex}
                              to={child.path}
                              onClick={() => setOpenDropdown(null)}
                              className={`
                                block py-2 px-4 rounded-lg
                                transition-all duration-200 ease-in-out
                                ${isChildActive 
                                  ? 'bg-[#7C9C70] text-white' 
                                  : 'text-gray-600 hover:bg-gray-100'}
                              `}
                            >
                              <div className="flex items-center">
                                <div className="w-5 h-5 flex items-center justify-center">
                                  {child.icon}
                                </div>
                                <span className={`ml-3`}>{child.name}</span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link 
                    to={item.path}
                    onClick={(e) => {
                      if (item.name === 'View Grades') {
                        handleViewGradesClick(e);
                      }
                      setOpenDropdown(null);
                    }}
                    className={`
                      relative block w-full rounded-lg
                      ${isActive 
                        ? 'bg-[#7C9C70] text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                      }
                    `}
                  >
                    <div className="px-4 py-3 flex items-center">
                      <div className="relative flex items-center">
                        <div className="w-5 h-5 flex items-center justify-center">
                          {item.icon}
                        </div>
                        {/* Tooltip */}
                        {!isSidebarOpen && (
                          <div className={`
                            fixed left-16
                            bg-gray-800 text-white px-3 py-2
                            text-sm rounded whitespace-nowrap
                            opacity-0 group-hover:opacity-100
                            pointer-events-none
                            transition-all duration-200
                            z-[9999]
                            before:content-['']
                            before:absolute
                            before:left-[-8px]
                            before:top-1/2
                            before:-translate-y-1/2
                            before:border-4
                            before:border-transparent
                            before:border-r-gray-800
                          `}>
                            {item.name}
                          </div>
                        )}
                      </div>
                      <span className={`
                        ml-3 font-medium whitespace-nowrap
                        ${item.name === 'Summary of Quarterly Grade' ? 'text-xs' : ''}
                        ${!isSidebarOpen ? 'opacity-0 translate-x-10 hidden' : 'opacity-100 translate-x-0'}
                      `}>
                        {item.name}
                      </span>
                    </div>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;