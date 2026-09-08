import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFocusTrap } from '../../utils/a11yUtils';
import './AuthModal.css';

export default function AuthModal({ isOpen, onClose, onSuccess, initialTab = 'login', message }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'login', 'signup', or 'reset'
  const { login, signup, loginWithGoogle, updateFirestoreProfile, resetPassword } = useAuth();
  const modalRef = useRef(null);

  useFocusTrap(modalRef, isOpen, onClose);

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [loadingForm, setLoadingForm] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setError('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialTab]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoadingForm(true);
      const cred = await login(loginEmail.trim(), loginPassword);
      setLoadingForm(false);
      if (onSuccess) onSuccess(cred.user);
      onClose();
    } catch (err) {
      console.error('Login error:', err);
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Incorrect email or password. Please try again or create an account.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please wait a few minutes.');
      } else {
        setError(err.message || 'Incorrect email or password. Please try again.');
      }
      setLoadingForm(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (signupPassword !== signupConfirmPassword) {
      return setError('Passwords do not match.');
    }
    if (signupPassword.length < 6) {
      return setError('Password must be at least 6 characters.');
    }

    try {
      setError('');
      setLoadingForm(true);
      const userCredential = await signup(signupEmail.trim(), signupPassword);
      
      // Save basic profile name without prompting long address form
      await updateFirestoreProfile(userCredential.user.uid, {
        fullName: signupName.trim(),
        email: signupEmail.trim(),
        provider: 'email/password'
      });

      setLoadingForm(false);
      if (onSuccess) onSuccess(userCredential.user);
      onClose();
    } catch (err) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account already exists with this email. Please sign in.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError('Failed to create account. Please check your details.');
      }
      setLoadingForm(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setError('');
      setLoadingGoogle(true);
      const res = await loginWithGoogle();
      if (res?.user) {
        if (onSuccess) onSuccess(res.user);
        onClose();
      }
    } catch (err) {
      console.error('Google auth error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in window was closed.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Domain not authorized in Firebase Console. Please add this domain under Firebase Console > Authentication > Settings > Authorized domains.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in Firebase Console > Authentication > Sign-in method.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error during Google sign-in. Please try again.');
      } else {
        setError(err.message || 'Failed to sign in with Google.');
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      return setError('Please enter your email address.');
    }
    try {
      setError('');
      setResetSuccess('');
      setLoadingForm(true);
      await resetPassword(loginEmail.trim());
      setResetSuccess(`Password reset email sent to ${loginEmail.trim()}! Please check your inbox and spam folder.`);
    } catch (err) {
      console.error('Reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Failed to send reset email.');
      }
    } finally {
      setLoadingForm(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div ref={modalRef} className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Close modal">
          ✕
        </button>

        <div className="auth-modal-header">
          <span className="auth-modal-badge">SECURE ORDERING</span>
          <h2 className="auth-modal-title">
            {activeTab === 'login' ? 'SIGN IN TO CONTINUE' : (activeTab === 'reset' ? 'RESET PASSWORD' : 'CREATE YOUR ACCOUNT')}
          </h2>
          <p className="auth-modal-subtitle">
            {activeTab === 'reset' ? 'Enter your email to receive a password reset link.' : (message || 'Sign in or create an account to place your order.')}
          </p>
        </div>

        {/* Tab switch */}
        {activeTab !== 'reset' && (
          <div className="auth-modal-tabs">
            <button
              type="button"
              className={`auth-modal-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => { setActiveTab('login'); setError(''); setResetSuccess(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-modal-tab ${activeTab === 'signup' ? 'active' : ''}`}
              onClick={() => { setActiveTab('signup'); setError(''); setResetSuccess(''); }}
            >
              Create Account
            </button>
          </div>
        )}

        {error && <div className="auth-modal-error">{error}</div>}

        {activeTab !== 'reset' && (
          <>
            {/* Quick Google Sign In */}
            <button
              type="button"
              disabled={loadingForm || loadingGoogle}
              onClick={handleGoogleAuth}
              className="auth-modal-google-btn"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
              <span>{loadingGoogle ? 'Connecting with Google...' : 'Continue with Google'}</span>
            </button>

            <div className="auth-modal-divider">
              <span>OR CONTINUE WITH EMAIL</span>
            </div>
          </>
        )}

        {activeTab === 'reset' ? (
          <form onSubmit={handleResetSubmit} className="auth-modal-form">
            {resetSuccess ? (
              <div style={{ background: '#dcfce7', color: '#15803d', padding: '12px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '14px', border: '1px solid #bbf7d0' }}>
                {resetSuccess}
              </div>
            ) : (
              <>
                <div className="auth-modal-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="auth-modal-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingForm}
                  className="auth-modal-submit-btn"
                >
                  {loadingForm ? 'SENDING RESET LINK...' : 'SEND RESET LINK'}
                </button>
              </>
            )}
            <div className="auth-modal-footer-note" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="auth-modal-text-link"
                onClick={() => { setActiveTab('login'); setError(''); setResetSuccess(''); }}
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        ) : activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="auth-modal-form">
            <div className="auth-modal-group">
              <label>Email Address</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@example.com"
                className="auth-modal-input"
              />
            </div>
            <div className="auth-modal-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>Password</label>
                <button
                  type="button"
                  className="auth-modal-text-link"
                  style={{ fontSize: '11px' }}
                  onClick={() => { setActiveTab('reset'); setError(''); setResetSuccess(''); }}
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="auth-modal-input"
                style={{ marginTop: '4px' }}
              />
            </div>
            <button
              type="submit"
              disabled={loadingForm || loadingGoogle}
              className="auth-modal-submit-btn"
            >
              {loadingForm ? 'SIGNING IN...' : 'SIGN IN & PROCEED'}
            </button>
            <div className="auth-modal-footer-note">
              <span>Don't have an account? </span>
              <button
                type="button"
                className="auth-modal-text-link"
                onClick={() => { setActiveTab('signup'); setError(''); }}
              >
                Create Account
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignupSubmit} className="auth-modal-form">
            <div className="auth-modal-group">
              <label>Full Name</label>
              <input
                type="text"
                required
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="John Doe"
                className="auth-modal-input"
              />
            </div>
            <div className="auth-modal-group">
              <label>Email Address</label>
              <input
                type="email"
                required
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="name@example.com"
                className="auth-modal-input"
              />
            </div>
            <div className="auth-modal-row">
              <div className="auth-modal-group">
                <label>Password</label>
                <input
                  type="password"
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="At least 6 chars"
                  className="auth-modal-input"
                />
              </div>
              <div className="auth-modal-group">
                <label>Confirm</label>
                <input
                  type="password"
                  required
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="auth-modal-input"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loadingForm || loadingGoogle}
              className="auth-modal-submit-btn"
            >
              {loadingForm ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT & PROCEED'}
            </button>
            <div className="auth-modal-footer-note">
              <span>Already have an account? </span>
              <button
                type="button"
                className="auth-modal-text-link"
                onClick={() => { setActiveTab('login'); setError(''); }}
              >
                Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
