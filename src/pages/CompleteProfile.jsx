import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function CompleteProfile() {
  const { currentUser, updateFirestoreProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    fullName: currentUser?.displayName || '',
    phone: '',
    age: '',
    addressLine: '',
    city: '',
    state: '',
    pincode: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (formData.phone.length < 10) {
      return setError('Please enter a valid 10-digit mobile number.');
    }

    try {
      setError('');
      setLoading(true);
      
      const addressData = {
        line1: formData.addressLine,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode
      };
      
      await updateFirestoreProfile(currentUser.uid, {
        fullName: formData.fullName,
        email: currentUser.email,
        phone: formData.phone,
        age: Number(formData.age),
        address: addressData,
        provider: 'google'
      });

      navigate('/profile');
    } catch (err) {
      setError('Failed to save profile. Please verify your data.');
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-split">
        <div className="auth-content">
          <div className="auth-box" style={{ maxWidth: '600px', margin: '40px auto' }}>
            <div className="auth-header">
              <h1 className="auth-title">COMPLETE YOUR PROFILE</h1>
              <p className="auth-subtitle">We need a few more details to set up your account.</p>
            </div>
            
            {error && <div className="auth-error">{error}</div>}
            
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label>Email (Verified via Google)</label>
                <input type="email" className="form-input" value={currentUser?.email || ''} readOnly style={{ background: '#f5f5f5' }} />
              </div>
              
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" name="fullName" className="form-input" value={formData.fullName} onChange={handleChange} required />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Mobile Number *</label>
                  <input type="tel" name="phone" className="form-input" value={formData.phone} onChange={handleChange} required maxLength="15" />
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
                {loading ? 'SAVING PROFILE...' : 'SAVE PROFILE'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
