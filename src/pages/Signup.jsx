import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Login from './Login';

export default function Signup() {
  const navigate = useNavigate();

  // With mobile phone OTP authentication, accounts are automatically created upon verification.
  // We reuse the streamlined Login component for consistent, mobile-only authentication.
  return <Login />;
}
