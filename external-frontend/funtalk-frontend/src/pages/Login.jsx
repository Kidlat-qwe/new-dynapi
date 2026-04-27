import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { API_BASE_URL } from '@/config/api.js';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotState, setForgotState] = useState({
    isLoading: false,
    error: '',
    success: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({}); // Clear previous errors

    try {
      // Step 1: Authenticate with Firebase
      const email = formData.email.trim().toLowerCase();
      let firebaseToken;

      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          formData.password
        );
        
        // Get Firebase ID token
        firebaseToken = await userCredential.user.getIdToken();
      } catch (firebaseError) {
        // Handle Firebase authentication errors
        let errorMessage = 'Invalid email or password. Please try again.';
        
        if (firebaseError.code === 'auth/user-not-found') {
          errorMessage = 'No account found with this email address.';
        } else if (firebaseError.code === 'auth/wrong-password') {
          errorMessage = 'Incorrect password. Please try again.';
        } else if (firebaseError.code === 'auth/invalid-email') {
          errorMessage = 'Invalid email address.';
        } else if (firebaseError.code === 'auth/user-disabled') {
          errorMessage = 'This account has been disabled. Please contact administrator.';
        } else if (firebaseError.code === 'auth/too-many-requests') {
          errorMessage = 'Too many failed login attempts. Please try again later.';
        }
        
        setErrors({ submit: errorMessage });
        setIsLoading(false);
        return;
      }

      // Step 2: Send Firebase token to backend to get JWT
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          firebaseToken: firebaseToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle different error types
        if (data.message && data.message.includes('not active')) {
          setErrors({
            submit: 'Your account is not active. Please contact administrator.',
          });
        } else {
          setErrors({
            submit: data.message || 'An error occurred during login. Please try again.',
          });
        }
        return;
      }

      // Success - store token and redirect
      if (data.success && data.data.token) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));

        // Redirect based on user type
        const userType = data.data.user.userType;
        switch (userType) {
          case 'superadmin':
            navigate('/superadmin/dashboard');
            break;
          case 'admin':
            // Legacy role fallback: route old admin accounts to superadmin area.
            navigate('/superadmin/dashboard');
            break;
          case 'school':
            navigate('/school/dashboard');
            break;
          case 'teacher':
            navigate('/teacher/dashboard');
            break;
          default:
            navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({
        submit: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openForgotPasswordModal = () => {
    setForgotEmail(formData.email.trim());
    setForgotState({ isLoading: false, error: '', success: '' });
    setIsForgotModalOpen(true);
  };

  const closeForgotPasswordModal = () => {
    if (forgotState.isLoading) return;
    setIsForgotModalOpen(false);
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    const email = forgotEmail.trim().toLowerCase();

    if (!email) {
      setForgotState((prev) => ({ ...prev, error: 'Email is required', success: '' }));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setForgotState((prev) => ({
        ...prev,
        error: 'Please enter a valid email address',
        success: '',
      }));
      return;
    }

    setForgotState({ isLoading: true, error: '', success: '' });

    try {
      await sendPasswordResetEmail(auth, email);
      setForgotState({
        isLoading: false,
        error: '',
        success: `Password reset email sent to ${email}. Please check your inbox.`,
      });
    } catch (error) {
      let message = 'Failed to send password reset email. Please try again.';
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      }

      setForgotState({ isLoading: false, error: message, success: '' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50 px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
      <div className="max-w-md w-full space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="text-center">
          <img
            src="/funtalk-logo.png"
            alt="Funtalk Logo"
            className="mx-auto h-12 sm:h-14 md:h-16 w-auto object-contain"
          />
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">Funtalk Online Tutor</h1>
          <p className="mt-1 text-xs sm:text-sm md:text-base text-gray-600">
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Form */}
        <div className="card card-padded shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                className={`input-field ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder="Enter your email"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="error-message">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`input-field pr-10 ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="error-message">{errors.password}</p>
              )}
            </div>

            {/* Forgot Password */}
            <div className="text-xs sm:text-sm text-right">
              <button
                type="button"
                onClick={openForgotPasswordModal}
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="error-message text-center">{errors.submit}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="mt-6 text-center text-xs sm:text-sm md:text-base text-gray-600">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {isForgotModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close forgot password modal"
            className="absolute inset-0 bg-black/50"
            onClick={closeForgotPasswordModal}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 p-5 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Reset password</h3>
            <p className="mt-1 text-sm text-gray-600">
              Enter your email and we will send a Firebase password reset link.
            </p>

            <form onSubmit={handleForgotPasswordSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="forgot-email" className="label">Email Address</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => {
                    setForgotEmail(e.target.value);
                    if (forgotState.error || forgotState.success) {
                      setForgotState((prev) => ({ ...prev, error: '', success: '' }));
                    }
                  }}
                  className="input-field"
                  placeholder="Enter your email"
                  disabled={forgotState.isLoading}
                  autoFocus
                />
              </div>

              {forgotState.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{forgotState.error}</p>
                </div>
              )}

              {forgotState.success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">{forgotState.success}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeForgotPasswordModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                  disabled={forgotState.isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium disabled:opacity-60"
                  disabled={forgotState.isLoading}
                >
                  {forgotState.isLoading ? 'Sending...' : 'Send reset link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

