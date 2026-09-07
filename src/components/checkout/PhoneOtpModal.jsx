import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { sendPhoneOtp, verifyPhoneOtp } from '../../services/otpService';
import './PhoneOtpModal.css';

export default function PhoneOtpModal({
  isOpen,
  phone,
  onClose,
  onSuccess,
  onChangePhone,
  title = "Verify Phone Number",
  subtitle = null,
  submitText = "VERIFY & PLACE ORDER"
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState(null);

  const inputRefs = useRef([]);

  // Clean phone number for display (+91 XXXXX XXXXX)
  const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
  const formattedPhone = cleanPhone.length === 10
    ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`
    : phone;

  // Send OTP upon opening modal
  useEffect(() => {
    if (isOpen && cleanPhone) {
      setDigits(['', '', '', '', '', '']);
      setError('');
      setDevOtpHint(null);
      handleSendOtp();
    }
  }, [isOpen, cleanPhone]);

  // Resend Countdown Timer
  useEffect(() => {
    let timer;
    if (isOpen && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Auto focus first input after opening
      setTimeout(() => {
        if (inputRefs.current[0]) inputRefs.current[0].focus();
      }, 150);
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  const handleSendOtp = async () => {
    try {
      setSendingOtp(true);
      setError('');
      setCanResend(false);
      setCountdown(30);
      const res = await sendPhoneOtp(cleanPhone);
      if (res?.devOtp) {
        setDevOtpHint(res.devOtp);
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP to this number. Please check connection.');
      setCanResend(true);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleDigitChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const copy = [...digits];
      copy[index] = '';
      setDigits(copy);
      return;
    }

    // If multiple characters (e.g. autofill), distribute across inputs
    if (cleaned.length > 1) {
      handlePasteDigits(cleaned);
      return;
    }

    const copy = [...digits];
    copy[index] = cleaned;
    setDigits(copy);

    // Focus next input if available
    if (index < 5 && cleaned) {
      inputRefs.current[index + 1]?.focus();
    }

    // If last digit filled, auto submit
    if (index === 5 && cleaned) {
      const fullOtp = [...copy.slice(0, 5), cleaned].join('');
      if (fullOtp.length === 6) {
        handleVerifyOtp(fullOtp);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePasteDigits = (pasteValue) => {
    const raw = String(pasteValue).replace(/\D/g, '').slice(0, 6);
    if (!raw) return;
    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < raw.length; i++) {
      newDigits[i] = raw[i];
    }
    setDigits(newDigits);
    const targetFocus = Math.min(raw.length, 5);
    inputRefs.current[targetFocus]?.focus();

    if (raw.length === 6) {
      handleVerifyOtp(raw);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    handlePasteDigits(pasted);
  };

  const handleVerifyOtp = async (otpOverride = null) => {
    const otpToSubmit = otpOverride || digits.join('');
    if (otpToSubmit.length !== 6) {
      setError('Please enter all 6 digits of the OTP.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await verifyPhoneOtp(cleanPhone, otpToSubmit);
      if (res?.success || res?.verified) {
        onSuccess(cleanPhone);
      } else {
        setError(res.error || 'Verification failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Incorrect or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isComplete = digits.every(d => d !== '');

  return createPortal(
    <div className="phone-otp-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="phone-otp-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="phone-otp-close-btn"
          onClick={onClose}
          aria-label="Close verification modal"
        >
          ✕
        </button>

        <div className="phone-otp-header">
          <div className="phone-otp-icon-wrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <span className="phone-otp-badge">ORDER SECURITY VERIFICATION</span>
          <h2 className="phone-otp-title">{title}</h2>
          <p className="phone-otp-subtitle">
            {subtitle || (
              <>
                Enter the 6-digit code sent via SMS to{' '}
                <strong className="phone-otp-number">{formattedPhone}</strong>
              </>
            )}
          </p>
          {onChangePhone && (
            <button
              type="button"
              className="phone-otp-edit-btn"
              onClick={() => { onClose(); onChangePhone(); }}
            >
              Change Phone Number
            </button>
          )}
        </div>

        {/* Development / Sandbox Quick Auto-fill Hint */}
        {devOtpHint && (
          <div className="phone-otp-dev-hint">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#854d0e' }}>
                ⚡ Test Mode (Add SMS key to .env for real SMS)
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#1e293b', letterSpacing: '1px' }}>
                OTP: {devOtpHint}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handlePasteDigits(devOtpHint)}
              className="phone-otp-autofill-btn"
              style={{ marginTop: '6px', width: '100%' }}
            >
              Click to Auto-fill ({devOtpHint})
            </button>
          </div>
        )}

        {error && <div className="phone-otp-error">{error}</div>}

        {/* 6-box input */}
        <div className="phone-otp-boxes" onPaste={handlePaste}>
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => (inputRefs.current[idx] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className={`phone-otp-box ${digit ? 'filled' : ''}`}
              disabled={loading || sendingOtp}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {/* Resend Action */}
        <div className="phone-otp-resend-row">
          {canResend ? (
            <button
              type="button"
              disabled={sendingOtp || loading}
              onClick={handleSendOtp}
              className="phone-otp-resend-btn"
            >
              {sendingOtp ? 'Sending code...' : 'Resend OTP via SMS'}
            </button>
          ) : (
            <span className="phone-otp-timer-text">
              Resend OTP in <strong>{countdown}s</strong>
            </span>
          )}
        </div>

        {/* Submit action */}
        <button
          type="button"
          disabled={!isComplete || loading || sendingOtp}
          onClick={() => handleVerifyOtp()}
          className="phone-otp-submit-btn"
        >
          {loading ? 'VERIFYING...' : submitText}
        </button>

        <p className="phone-otp-footer-note">
          🔒 Verification is required once to secure your order and prevent delivery failed attempts.
        </p>
      </div>
    </div>,
    document.body
  );
}
