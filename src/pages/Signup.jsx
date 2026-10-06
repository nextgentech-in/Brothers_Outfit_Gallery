import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/common/SEO';
import './AuthPage.css';

export default function Signup() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const { currentUser, signup, updateFirestoreProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match.');
    }
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }

    try {
      setError('');
      setLoadingEmail(true);
      const userCredential = await signup(formData.email.trim(), formData.password);

      // Store basic name and email without forcing lengthy address form upfront
      await updateFirestoreProfile(userCredential.user.uid, {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        provider: 'email/password'
      });

      navigate('/');
    } catch (err) {
      console.error("Signup error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account already exists with this email. Please sign in.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network connection error. Please try again.');
      } else {
        setError(err.message || 'Failed to create an account. Please verify input data.');
      }
    } finally {
      setLoadingEmail(false);
    }
  }

  return (
    <div className="auth-page">
      <SEO title="Create Account | Brother’s Outfit Gallery" noindex={true} />
      <div className="auth-split">
        <div className="auth-content">
          <div className="auth-box" style={{ maxWidth: '480px', margin: '40px auto' }}>
            <div className="auth-header">
              <h1 className="auth-title">CREATE YOUR ACCOUNT</h1>
              <p className="auth-subtitle">Join Brothers Outfit Gallery and start shopping.</p>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  className="form-input"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    name="password"
                    className="form-input"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="At least 6 chars"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Confirm Password *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    className="form-input"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-type password"
                    required
                  />
                </div>
              </div>

              <button disabled={loadingEmail} type="submit" className="btn-auth-primary">
                {loadingEmail ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </button>
            </form>

            <div className="auth-links">
              <p>Already have an account? <Link to="/login">Sign In</Link></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
