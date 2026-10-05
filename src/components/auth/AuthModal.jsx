import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useFocusTrap } from '../../utils/a11yUtils';
import './AuthModal.css';

export default function AuthModal({ isOpen, onClose, onSuccess, initialTab = 'login', message }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'login', 'signup', or 'reset'
  const { login, signup, updateFirestoreProfile, resetPassword } = useAuth();
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

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
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
              disabled={loadingForm}
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
              disabled={loadingForm}
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
    </div>,
    document.body
  );
}
