import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/common/SEO';
import './AuthPage.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [loadingReset, setLoadingReset] = useState(false);
  const { currentUser, login, startPhoneSignIn, verifyPhoneSignIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  // Redirect if already signed in.
  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoadingEmail(true);
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      console.error("Login error:", err);
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Incorrect email or password. Please verify your credentials or create an account.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Access temporarily disabled due to many failed attempts. Please try again in a few minutes.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network connection error. Please check your internet connection.');
      } else {
        setError(err.message || 'Incorrect email or password.');
      }
    } finally {
      setLoadingEmail(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetEmail.trim()) {
      return setError('Please enter your email address.');
    }
    try {
      setError('');
      setResetSuccess('');
      setLoadingReset(true);
      await resetPassword(resetEmail.trim());
      setResetSuccess(`Password reset email sent to ${resetEmail.trim()}! Please check your inbox and spam folder.`);
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account exists with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Unable to send password reset email.');
      }
    } finally {
      setLoadingReset(false);
    }
  }

  async function handlePhoneCodeRequest(e) {
    e.preventDefault();
    try {
      setError('');
      setLoadingPhone(true);
      const confirmation = await startPhoneSignIn(phone, 'phone-signin-recaptcha');
      setPhoneConfirmation(confirmation);
    } catch (err) {
      console.error('Phone sign-in code request error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Mobile sign-in is not enabled yet. Enable Phone in Firebase Console > Authentication > Sign-in method.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many verification requests. Please wait and try again.');
      } else {
        setError(err.message || 'Unable to send a verification code.');
      }
    } finally {
      setLoadingPhone(false);
    }
  }

  async function handlePhoneVerification(e) {
    e.preventDefault();
    try {
      setError('');
      setLoadingPhone(true);
      const result = await verifyPhoneSignIn(phoneConfirmation, verificationCode);
      if (result?.user) navigate('/');
    } catch (err) {
      console.error('Phone verification error:', err);
      setError(err.code === 'auth/invalid-verification-code'
        ? 'That verification code is incorrect. Please try again.'
        : (err.message || 'Unable to verify the code.'));
    } finally {
      setLoadingPhone(false);
    }
  }

  return (
    <div className="auth-page">
      <SEO title="Account Login | Brother’s Outfit Gallery" noindex={true} />
      <div className="auth-split">
        <div className="auth-image"></div>
        <div className="auth-content">
          <div className="auth-box">
            {resetMode ? (
              /* Password Reset Form */
              <>
                <div className="auth-header">
                  <h1 className="auth-title">RESET PASSWORD</h1>
                  <p className="auth-subtitle">Enter your registered email to receive a password reset link.</p>
                </div>

                {error && <div className="auth-error">{error}</div>}
                {resetSuccess && (
                  <div style={{ background: '#dcfce7', color: '#15803d', padding: '12px 16px', borderRadius: '6px', fontSize: '13.5px', marginBottom: '16px', border: '1px solid #bbf7d0' }}>
                    {resetSuccess}
                  </div>
                )}

                {!resetSuccess ? (
                  <form onSubmit={handleResetPassword} className="auth-form">
                    <div className="form-group">
                      <label>Email Address</label>
                      <input 
                        type="email" 
                        className="form-input" 
                        value={resetEmail} 
                        onChange={(e) => setResetEmail(e.target.value)} 
                        placeholder="yourname@example.com"
                        required 
                      />
                    </div>
                    <button disabled={loadingReset} type="submit" className="btn-auth-primary">
                      {loadingReset ? 'SENDING RESET LINK...' : 'SEND PASSWORD RESET LINK'}
                    </button>
                  </form>
                ) : null}

                <div className="auth-links" style={{ marginTop: '20px' }}>
                  <p>
                    <a href="#back" onClick={(e) => { e.preventDefault(); setResetMode(false); setError(''); setResetSuccess(''); }}>
                      ← Back to Sign In
                    </a>
                  </p>
                </div>
              </>
            ) : (
              /* Normal Sign In Form */
              <>
                <div className="auth-header">
                  <h1 className="auth-title">WELCOME BACK</h1>
                  <p className="auth-subtitle">Sign in to continue shopping.</p>
                </div>
                
                {error && <div className="auth-error">{error}</div>}
                
                {!phoneConfirmation ? (
                  <form onSubmit={handlePhoneCodeRequest} className="auth-form auth-phone-form">
                    <div className="form-group">
                      <label>Mobile Number</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s-]/g, ''))}
                        placeholder="10-digit mobile number"
                        inputMode="numeric"
                        autoComplete="tel"
                        required
                      />
                    </div>
                    <button disabled={loadingEmail || loadingPhone} type="submit" className="btn-auth-phone">
                      {loadingPhone ? 'SENDING CODE...' : 'CONTINUE WITH MOBILE NUMBER'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handlePhoneVerification} className="auth-form auth-phone-form">
                    <div className="form-group">
                      <label>Verification Code</label>
                      <input
                        type="text"
                        className="form-input"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                      />
                    </div>
                    <button disabled={loadingPhone} type="submit" className="btn-auth-phone">
                      {loadingPhone ? 'VERIFYING...' : 'VERIFY & SIGN IN'}
                    </button>
                    <button type="button" className="auth-text-button" onClick={() => { setPhoneConfirmation(null); setVerificationCode(''); setError(''); }}>
                      Use a different mobile number
                    </button>
                  </form>
                )}

                <div className="auth-divider">OR SIGN IN WITH EMAIL</div>

                <form onSubmit={handleSubmit} className="auth-form">
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      className="form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button disabled={loadingEmail || loadingPhone} type="submit" className="btn-auth-primary">
                    {loadingEmail ? 'SIGNING IN...' : 'SIGN IN'}
                  </button>
                </form>

                <div id="phone-signin-recaptcha" />

                <div className="auth-links">
                  <p><a href="#forgot" onClick={(e) => { e.preventDefault(); setResetMode(true); setResetEmail(email); setError(''); setResetSuccess(''); }}>Forgot Password?</a></p>
                  <p>Don't have an account? <Link to="/signup">Create Account</Link></p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
