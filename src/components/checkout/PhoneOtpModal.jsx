import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { sendPhoneOtp, verifyPhoneOtp } from '../../services/otpService';
import './PhoneOtpModal.css';

export default function PhoneOtpModal({ isOpen, phone, onClose, onSuccess, onChangePhone }) {
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
    // Handle typing single digit
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const copy = [...digits];
      copy[index] = '';
      setDigits(copy);
      return;
    }

    // If user pasted or typed multiple digits
    if (cleaned.length > 1) {
      handlePasteDigits(cleaned);
      return;
    }

    const copy = [...digits];
    copy[index] = cleaned[0];
    setDigits(copy);
    setError('');

    // Auto-advance to next input box
    if (index < 5 && cleaned[0]) {
      inputRefs.current[index + 1]?.focus();
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
    } else if (e.key === 'Enter') {
      const fullOtp = digits.join('');
      if (fullOtp.length === 6) {
        handleVerifyOtp(fullOtp);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      handlePasteDigits(pasted);
    }
  };

  const handlePasteDigits = (numStr) => {
    const arr = numStr.slice(0, 6).split('');
    const newDigits = ['', '', '', '', '', ''];
    arr.forEach((d, idx) => {
      newDigits[idx] = d;
    });
    setDigits(newDigits);
    setError('');

    // Focus last filled or next empty
    const nextIdx = Math.min(arr.length, 5);
    inputRefs.current[nextIdx]?.focus();

    if (arr.length === 6) {
      handleVerifyOtp(arr.join(''));
    }
  };

  const handleVerifyOtp = async (otpToVerify = null) => {
    const code = otpToVerify || digits.join('');
    if (code.length !== 6) {
      return setError('Please enter the complete 6-digit verification code.');
    }

    try {
      setLoading(true);
      setError('');
      const res = await verifyPhoneOtp(cleanPhone, code);
      if (res?.verified) {
        onSuccess(cleanPhone);
      }
    } catch (err) {
      setError(err.message || 'Incorrect OTP code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const fullCode = digits.join('');
  const isComplete = fullCode.length === 6;

  return createPortal(
    <div className="phone-otp-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="phone-otp-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="phone-otp-close"
          onClick={onClose}
          aria-label="Close OTP verification"
        >
          ✕
        </button>

        <div className="phone-otp-header">
          <div className="phone-otp-icon-wrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <span className="phone-otp-badge">ORDER SECURITY VERIFICATION</span>
          <h2 className="phone-otp-title">Verify Phone Number</h2>
          <p className="phone-otp-subtitle">
            Enter the 6-digit code sent via SMS to{' '}
            <strong className="phone-otp-number">{formattedPhone}</strong>
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
            <span>⚡ Test Sandbox OTP: <strong>{devOtpHint}</strong></span>
            <button
              type="button"
              onClick={() => handlePasteDigits(devOtpHint)}
              className="phone-otp-autofill-btn"
            >
              Auto Fill
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
          {loading ? 'VERIFYING...' : 'VERIFY & PLACE ORDER'}
        </button>

        <p className="phone-otp-footer-note">
          🔒 Verification is required once to secure your order and prevent delivery failed attempts.
        </p>
      </div>
    </div>,
    document.body
  );
}
