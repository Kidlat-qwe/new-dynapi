import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithEmailAndPassword, resendVerificationEmail, sendPasswordResetEmail, isFirebaseConfigured } from './firebase';
import { fetchGrading, setApiToken } from './lib/api';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
    // Clear error when user starts typing
    setError('');
    setVerificationSent(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setVerificationSent(false);

    const { email, password } = formData;

    try {
      // When Firebase is not configured, use Grading backend login (username/password → JWT)
      if (!isFirebaseConfigured) {
        const response = await fetchGrading('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email, password }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.message || 'Invalid email or password');
          setLoading(false);
          return;
        }
        if (!data.success || !data.token || !data.user) {
          setError('Invalid response from server. Please try again.');
          setLoading(false);
          return;
        }
        const u = data.user;
        const userData = {
          user_id: u.id,
          user_type: u.userType || data.userType,
          email: u.username || email,
          fname: u.fname,
          mname: u.mname,
          lname: u.lname,
        };
        setApiToken(data.token);
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userType', userData.user_type);
        localStorage.setItem('userId', String(userData.user_id));
        localStorage.setItem('userData', JSON.stringify(userData));
        window.location.href = '/home';
        return;
      }

      const result = await loginWithEmailAndPassword(email, password);

      if (result.success) {
        console.log('Firebase login successful, fetching user data from backend');
        const firebaseUser = result.user;
        const response = await fetchGrading(`/users/byEmail/${email}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Your account exists but is not linked to the system. Please contact an administrator.');
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch user data from backend');
        }

        const userData = await response.json();
        const idToken = await firebaseUser.getIdToken();
        localStorage.setItem('userToken', idToken);
        localStorage.setItem('userType', userData.user_type);
        localStorage.setItem('userId', userData.user_id);
        localStorage.setItem('userData', JSON.stringify(userData));

        if (userData.user_id) {
          try {
            await fetchGrading(`/users/${userData.user_id}/last-logged-in`, { method: 'PUT' });
          } catch (err) {
            console.error('Failed to update last_logged_in:', err);
          }
        }

        window.location.href = '/home';
      } else {
        if (result.code === 'auth/user-not-found' || result.code === 'auth/wrong-password' || result.code === 'auth/invalid-credential') {
          setError('Invalid email or password');
        } else if (result.code === 'auth/too-many-requests') {
          setError('Too many failed login attempts. Please try again later.');
        } else {
          setError(result.error || 'Login failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const { email, password } = formData;
      const result = await loginWithEmailAndPassword(email, password);
      
      if (result.success) {
        const verificationResult = await resendVerificationEmail(result.user);
        if (verificationResult.success) {
          setVerificationSent(true);
          setError('');
        } else {
          setError('Failed to send verification email. Please try again.');
        }
      } else {
        setError('Cannot resend verification email. Please check your credentials.');
      }
    } catch (error) {
      console.error('Error resending verification:', error);
      setError('An error occurred while trying to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!resetEmail || !resetEmail.includes('@')) {
      setResetError('Please enter a valid email address');
      return;
    }
    
    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);
    
    try {
      const result = await sendPasswordResetEmail(resetEmail);
      
      if (result.success) {
        setResetSuccess(true);
        // After 5 seconds, close the modal
        setTimeout(() => {
          setShowForgotPassword(false);
          setResetSuccess(false);
        }, 5000);
      } else {
        // Handle specific Firebase error codes
        if (result.code === 'auth/user-not-found') {
          setResetError('No account found with this email address');
        } else if (result.code === 'auth/invalid-email') {
          setResetError('Please enter a valid email address');
        } else if (result.code === 'auth/too-many-requests') {
          setResetError('Too many requests. Please try again later');
        } else {
          setResetError(result.error || 'Failed to send reset email. Please try again.');
        }
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setResetError('An unexpected error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-8 py-6 bg-white rounded-lg shadow-md">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Sign In
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error}
            {error.includes('not verified') && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={loading || verificationSent}
                  className="text-blue-600 hover:text-blue-800 underline focus:outline-none"
                >
                  Resend verification email
                </button>
              </div>
            )}
          </div>
        )}

        {verificationSent && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
            Verification email sent! Please check your inbox and spam folder.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              EMAIL
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 
                focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="example@email.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              PASSWORD
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 
                focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="Enter your password here"
              value={formData.password}
              onChange={handleChange}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium 
            text-white bg-[#E5A853] hover:bg-[#d69843] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500
            disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="flex items-center justify-between text-sm">
          <button 
            type="button"
            onClick={() => {
              setShowForgotPassword(true);
              setResetEmail(formData.email || '');
              setResetError('');
              setResetSuccess(false);
            }}
            className="font-medium text-gray-600 hover:text-gray-500 focus:outline-none"
          >
            Forgot Password?
          </button>
        </div>
      </form>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-10 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Reset Password</h3>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {resetSuccess ? (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm mb-4">
                Password reset email sent successfully! Please check your inbox and spam folder.
                <p className="mt-2 text-green-700">
                  This dialog will close automatically in a few seconds.
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                {resetError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-4">
                    {resetError}
                  </div>
                )}
                
                <p className="text-gray-600 mb-4">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                
                <div className="mb-4">
                  <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 
                      focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="example@email.com"
                    required
                  />
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="mr-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 
                      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#E5A853] hover:bg-[#d69843]
                      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 rounded-md
                      disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
