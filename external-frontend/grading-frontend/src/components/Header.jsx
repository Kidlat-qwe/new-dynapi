import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logoutUser, isFirebaseConfigured } from '../firebase';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useAuth, clearApiSession } from '../contexts/AuthContext';

const Header = ({ toggleSidebar }) => {
  const { logout: authLogout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [userFullName, setUserFullName] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const auth = isFirebaseConfigured ? getAuth() : null;
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      // Format the full name: First Middle Last
      const firstName = user.fname || '';
      const middleName = user.mname ? `${user.mname} ` : '';
      const lastName = user.lname || '';
      
      const fullName = `${firstName} ${middleName}${lastName}`.trim();
      setUserFullName(fullName || 'User Profile');
    }

    // Add click event listener to window
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    if (!isFirebaseConfigured) {
      clearApiSession();
      localStorage.removeItem('userId');
      sessionStorage.clear();
      if (authLogout) authLogout();
      window.location.href = '/login';
      return;
    }
    const result = await logoutUser();
    if (result.success) {
      clearApiSession();
      localStorage.removeItem('userId');
      sessionStorage.clear();
      if (authLogout) authLogout();
      window.location.href = '/login';
    } else {
      console.error('Logout failed:', result.error);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New password and confirm password do not match');
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      if (!auth) {
        setError('Change password is not available when using backend login.');
        setLoading(false);
        return;
      }
      const user = auth.currentUser;
      const email = user.email;

      // Create credentials with current password
      const credential = EmailAuthProvider.credential(
        email,
        passwordData.currentPassword
      );

      // Reauthenticate user
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, passwordData.newPassword);

      setSuccess('Password changed successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setSuccess('');
      }, 2000);

    } catch (error) {
      console.error('Error changing password:', error);
      switch (error.code) {
        case 'auth/wrong-password':
          setError('Current password is incorrect');
          break;
        case 'auth/requires-recent-login':
          setError('Please log out and log back in before changing your password');
          break;
        default:
          setError('Failed to change password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to get the title based on current path
  const getPageTitle = () => {
    // Handle dynamic routes first
    if (path.startsWith('/manage-class-view-subject/')) {
      return 'CLASS SUBJECTS';
    }
    if (path.startsWith('/manage-class-view-student/')) {
      return 'CLASS STUDENTS';
    }

    // Then handle static routes
    switch (path) {
      case '/Home':
        return 'HOME';
      case '/manage-class':
        return 'MANAGE CLASS';
      case '/manage-teacher':
        return 'TEACHER LIST';
      case '/manage-subject':
        return 'MANAGE SUBJECT';
      case '/view-grade':
        return 'VIEW GRADES';
      case '/academic-ranking':
        return 'ACADEMIC RANKING';
      case '/school-year':
        return 'SCHOOL YEAR';
      case '/manage-user':
        return 'MANAGE USER';
      case '/student-grade':
        return 'STUDENT GRADES';
      case '/my-grade':
        return 'MY GRADES';
      case '/my-class':
        return 'MY CLASS';
      case '/my-class-view':
        return 'CLASS RECORD';
      case '/grading-criteria':
        return 'GRADING CRITERIA';
      case '/attendance':
        return 'DAILY ATTENDANCE';
      case '/summary-quarterly-grade':
        return 'SUMMARY OF QUARTERLY GRADE';
      case '/student-list':
        return 'STUDENT LIST';
      default:
        return 'HOME';
    }
  };

  return (
    <div className="bg-[#BBC3B3] flex justify-between items-center h-[60px]"> {/* Fixed height to match logo */}
      <div className="flex items-center gap-4 px-4">
        <button 
          onClick={toggleSidebar}
          className="text-2xl cursor-pointer hover:text-gray-700"
        >
          ☰
        </button>
        <h1 className="text-xl font-medium">{getPageTitle()}</h1>
      </div>
      <div className="flex items-center gap-2 px-4 relative" ref={dropdownRef}>
        <button 
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 hover:bg-[#a8af9d] px-3 py-2 rounded-md transition-colors"
          id="user-profile-btn"
        >
          <div className="flex items-center">
            <span className="mr-2 font-sans font-semibold text-gray-800 text-xs cursor-pointer select-none">{userFullName}</span>
          </div>
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div
            className="absolute z-50 bg-white rounded-md shadow-lg py-1"
            style={{
              width: 'auto',
              left: 0,
              right: 'auto',
              top: '100%',
              marginTop: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              padding: 0,
              fontSize: '0.95rem',
              border: '1px solid #e5e7eb',
              minWidth: '100%',
              maxWidth: 'max-content',
            }}
          >
            <button
              onClick={() => {
                setShowChangePasswordModal(true);
                setShowDropdown(false);
              }}
              className="w-full text-left px-3 py-1.5 text-gray-700 hover:bg-gray-100 transition-colors text-sm"
              style={{minWidth: '100%'}}
            >
              Change Password
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-1.5 text-gray-700 hover:bg-gray-100 transition-colors text-sm"
              style={{minWidth: '100%'}}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <>
          {/* Apply blur to main content */}
          <div className="fixed inset-0 z-40">
            <div className="absolute inset-0 backdrop-blur-[2px]"></div>
          </div>

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md no-blur">
              <div className="bg-gradient-to-r from-[#3E5367] to-[#526D82] px-6 py-4 rounded-t-lg">
                <h2 className="text-xl font-semibold text-white">Change Password</h2>
              </div>

              <form onSubmit={handleChangePassword} className="p-6">
                {error && (
                  <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 text-red-700">
                    {error}
                  </div>
                )}
                
                {success && (
                  <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4 text-green-700">
                    {success}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePasswordModal(false);
                      setError('');
                      setSuccess('');
                      setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                      });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-[#526D82] text-white rounded-md hover:bg-[#3E5367] disabled:bg-gray-400"
                  >
                    {loading ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Header;
