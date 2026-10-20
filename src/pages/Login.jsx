import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/common/SEO';
import './AuthPage.css';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputRef = useRef(null);
  const { currentUser, startPhoneSignIn, verifyPhoneSignIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already signed in
  useEffect(() => {
    if (currentUser) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [currentUser, navigate, location]);

  // Focus OTP input when code is sent
  useEffect(() => {
    if (phoneConfirmation && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [phoneConfirmation]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handlePhoneCodeRequest = async (e) => {
    if (e) e.preventDefault();
    const cleanDigits = phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanDigits)) {
      return setError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
    }

    try {
      setError('');
      setLoadingPhone(true);
      const confirmation = await startPhoneSignIn(cleanDigits, 'phone-signin-recaptcha');
      setPhoneConfirmation(confirmation);
      setResendCooldown(30);
    } catch (err) {
      console.error('Phone sign-in code request error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Mobile sign-in is not enabled. Please enable Phone in Firebase Console.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many verification requests. Please wait a few minutes and try again.');
      } else {
        setError(err.message || 'Unable to send verification code. Please check your number.');
      }
    } finally {
      setLoadingPhone(false);
    }
  };

  const handlePhoneVerification = async (e) => {
    e.preventDefault();
    const cleanCode = verificationCode.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      return setError('Please enter the complete 6-digit verification code.');
    }

    try {
      setError('');
      setLoadingPhone(true);
      const result = await verifyPhoneSignIn(phoneConfirmation, cleanCode);
      if (result?.user) {
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    } catch (err) {
      console.error('Phone verification error:', err);
      setError(
        err.code === 'auth/invalid-verification-code'
          ? 'That verification code is incorrect. Please check the SMS and try again.'
          : (err.message || 'Unable to verify code.')
      );
    } finally {
      setLoadingPhone(false);
    }
  };

  return (
    <div className="auth-page">
      <SEO title="Mobile Sign In | Brother’s Outfit Gallery" noindex={true} />
      <div className="auth-split">
        <div className="auth-image"></div>
        <div className="auth-content">
          <div className="auth-box">
            <div className="auth-header">
              <h1 className="auth-title">
                {phoneConfirmation ? 'VERIFY OTP' : 'SIGN IN / REGISTER'}
              </h1>
              <p className="auth-subtitle">
                {phoneConfirmation 
                  ? `Enter the 6-digit code sent to +91 ${phone.replace(/\D/g, '').slice(-10)}`
                  : 'Enter your 10-digit mobile number for instant verification'
                }
              </p>
            </div>

            {error && <div className="auth-error">{error}</div>}

            {!phoneConfirmation ? (
              /* Step 1: Mobile Phone Number Entry */
              <form onSubmit={handlePhoneCodeRequest} className="auth-form auth-phone-form">
                <div className="form-group">
                  <label htmlFor="auth-phone-input">Mobile Number</label>
                  <div className="phone-input-wrapper">
                    <span className="phone-country-prefix">🇮🇳 +91</span>
                    <input
                      id="auth-phone-input"
                      type="tel"
                      className="form-input phone-input-field"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhone(val);
                        if (error) setError('');
                      }}
                      placeholder="98765 43210"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <button 
                  disabled={loadingPhone || phone.replace(/\D/g, '').length < 10} 
                  type="submit" 
                  className="btn-auth-primary"
                  style={{ marginTop: '8px' }}
                >
                  {loadingPhone ? 'SENDING OTP...' : 'CONTINUE WITH MOBILE'}
                </button>

                <div className="auth-help-banner">
                  <span className="help-icon">🔒</span>
                  <span>Fast & passwordless login. New accounts are automatically created upon verification.</span>
                </div>
              </form>
            ) : (
              /* Step 2: 6-Digit OTP Verification */
              <form onSubmit={handlePhoneVerification} className="auth-form auth-phone-form">
                <div className="form-group">
                  <label htmlFor="auth-otp-input">6-Digit Verification Code</label>
                  <input
                    id="auth-otp-input"
                    ref={otpInputRef}
                    type="text"
                    className="form-input otp-large-input"
                    value={verificationCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setVerificationCode(val);
                      if (error) setError('');
                    }}
                    placeholder="• • • • • •"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                  />
                </div>

                <button 
                  disabled={loadingPhone || verificationCode.length < 6} 
                  type="submit" 
                  className="btn-auth-primary"
                >
                  {loadingPhone ? 'VERIFYING...' : 'VERIFY & SIGN IN'}
                </button>

                <div className="otp-resend-row">
                  {resendCooldown > 0 ? (
                    <span className="cooldown-text">
                      Resend code in <strong>{resendCooldown}s</strong>
                    </span>
                  ) : (
                    <button 
                      type="button" 
                      className="auth-text-button" 
                      onClick={handlePhoneCodeRequest}
                      disabled={loadingPhone}
                    >
                      Resend OTP Code
                    </button>
                  )}
                  <span className="dot-sep">•</span>
                  <button 
                    type="button" 
                    className="auth-text-button" 
                    onClick={() => { 
                      setPhoneConfirmation(null); 
                      setVerificationCode(''); 
                      setError(''); 
                    }}
                  >
                    Change Number
                  </button>
                </div>
              </form>
            )}

            {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
            <div id="phone-signin-recaptcha" />
          </div>
        </div>
      </div>
    </div>
  );
}
