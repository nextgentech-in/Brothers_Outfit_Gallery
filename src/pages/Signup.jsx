import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function Signup() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    birthdate: '',
    age: '',
    addressLine: '',
    city: '',
    state: '',
    pincode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signup, updateFirestoreProfile, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'birthdate' && value) {
      const birthDate = new Date(value);
      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
        if (calculatedAge >= 0 && calculatedAge < 120) {
          setFormData(prev => ({ ...prev, birthdate: value, age: calculatedAge }));
          return;
        }
      }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }
    
    // Quick validation check matching phone numbers generically
    if (formData.phone.length < 10) {
      return setError('Please enter a valid 10-digit mobile number.');
    }

    try {
      setError('');
      setLoading(true);
      const userCredential = await signup(formData.email, formData.password);
      
      // Structure explicitly separating complex fields requested by user
      const addressData = {
        line1: formData.addressLine,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode
      };
      
      await updateFirestoreProfile(userCredential.user.uid, {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        birthdate: formData.birthdate || '',
        age: formData.age ? Number(formData.age) : null,
        address: addressData,
        provider: 'email/password'
      });

      navigate('/profile');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('An account already exists with this email. Please sign in.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError('Failed to create an account. Please verify input data.');
      }
      setLoading(false);
    }
  }

  async function handleGoogleSignin() {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate('/profile');
    } catch (err) {
      console.error("Google signin error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in window was closed.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized in Firebase Console > Authentication > Settings > Authorized domains.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in your Firebase Console > Authentication > Sign-in method.');
      } else {
        setError(`Google sign-in failed: ${err.message || 'Unable to connect to Google.'}`);
      }
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-split">
        <div className="auth-content">
          <div className="auth-box" style={{ maxWidth: '600px', margin: '40px auto' }}>
            <div className="auth-header">
              <h1 className="auth-title">CREATE YOUR ACCOUNT</h1>
              <p className="auth-subtitle">Join us and make your next style yours.</p>
            </div>
            
            {error && <div className="auth-error">{error}</div>}
            
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" name="fullName" className="form-input" value={formData.fullName} onChange={handleChange} required />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" name="email" className="form-input" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Mobile Number *</label>
                  <input type="tel" name="phone" className="form-input" value={formData.phone} onChange={handleChange} required maxLength="15" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Password *</label>
                  <input type="password" name="password" className="form-input" value={formData.password} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Confirm Password *</label>
                  <input type="password" name="confirmPassword" className="form-input" value={formData.confirmPassword} onChange={handleChange} required />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Date of Birth (Birthdate)</label>
                  <input 
                    type="date" 
                    name="birthdate" 
                    className="form-input" 
                    value={formData.birthdate} 
                    max={new Date().toISOString().split('T')[0]} 
                    onChange={handleChange} 
                  />
                </div>
                <div className="form-group">
                  <label>Age *</label>
                  <input type="number" name="age" min="13" max="100" className="form-input" value={formData.age} onChange={handleChange} required />
                </div>
              </div>

              <div className="form-group">
                <label>Address Line 1 *</label>
                <input type="text" name="addressLine" className="form-input" value={formData.addressLine} onChange={handleChange} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City *</label>
                  <input type="text" name="city" className="form-input" value={formData.city} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>State *</label>
                  <input type="text" name="state" className="form-input" value={formData.state} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Pincode *</label>
                  <input type="text" name="pincode" className="form-input" value={formData.pincode} onChange={handleChange} required />
                </div>
              </div>

              <button disabled={loading} type="submit" className="btn-auth-primary">
                {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </button>
            </form>

            <div className="auth-divider">OR</div>

            <button disabled={loading} onClick={handleGoogleSignin} className="btn-auth-google">
              <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
              {loading ? 'CONNECTING...' : 'CONTINUE WITH GOOGLE'}
            </button>

            <div className="auth-links">
              <p>Already have an account? <Link to="/login">Sign In</Link></p>
            </div>
          </div>
        </div>
        <div className="auth-image" style={{backgroundImage: "url('/images/hero-fashion.jpg')"}}></div>
      </div>
    </div>
  );
}
