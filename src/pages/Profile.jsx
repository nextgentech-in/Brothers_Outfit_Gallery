import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Profile.css';

export default function Profile() {
  const { currentUser, userProfile, logout, updateFirestoreProfile } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Initialize with null safety 
  const [formData, setFormData] = useState({
    fullName: userProfile?.fullName || '',
    phone: userProfile?.phone || '',
    age: userProfile?.age || '',
    addressLine: userProfile?.address?.line1 || '',
    city: userProfile?.address?.city || '',
    state: userProfile?.address?.state || '',
    pincode: userProfile?.address?.pincode || ''
  });

  if (!userProfile) return null; // Avoid rendering if protected route block is still calculating

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  async function handleSave(e) {
    e.preventDefault();
    try {
      setMessage('');
      setLoading(true);
      const addressData = {
        line1: formData.addressLine,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode
      };

      await updateFirestoreProfile(currentUser.uid, {
        fullName: formData.fullName,
        phone: formData.phone,
        age: Number(formData.age),
        address: addressData
      });

      setMessage('PROFILE UPDATED SUCCESSFULLY');
      setIsEditing(false);
    } catch (err) {
      setMessage('Failed to update profile.');
    } finally {
      setLoading(false);
      // Auto clear success message
      setTimeout(() => setMessage(''), 3000);
    }
  }

  // Derive an avatar photo or fallback specifically mapped securely 
  const avatarImage = currentUser.photoURL || `https://ui-avatars.com/api/?name=${userProfile.fullName}&background=2E3A59&color=fff&size=100`;

  return (
    <div className="profile-page">
      <div className="profile-container">

        <div className="profile-sidebar">
          <div className="profile-avatar-block">
            <img src={avatarImage} alt={userProfile.fullName} className="profile-avatar" />
            <h2 className="profile-name">{userProfile.fullName}</h2>
            <p className="profile-email">{userProfile.email}</p>
          </div>
          <nav className="profile-nav">
            <button className="active">My Profile</button>
            <button onClick={() => alert("Orders route available for extension.")}>My Orders</button>
            <button onClick={handleLogout} style={{ color: '#c0392b' }}>Logout</button>
          </nav>
        </div>

        <div className="profile-content">
          <div className="profile-header">
            <h1>MY ACCOUNT</h1>
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="btn-edit">
                EDIT PROFILE
              </button>
            )}
          </div>

          {message && <div className="profile-message">{message}</div>}

          {isEditing ? (
            <form onSubmit={handleSave} className="profile-form">
              <h3 className="section-title">PERSONAL INFORMATION</h3>
              <div className="form-group">
                <label>Email (Cannot be changed)</label>
                <input type="email" className="form-input" value={userProfile.email} readOnly style={{ background: '#f5f5f5' }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" name="fullName" className="form-input" value={formData.fullName} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Mobile Number</label>
                  <input type="tel" name="phone" className="form-input" value={formData.phone} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-group">
                <label>Age</label>
                <input type="number" name="age" className="form-input" value={formData.age} onChange={handleChange} required />
              </div>

              <h3 className="section-title" style={{ marginTop: '32px' }}>DELIVERY ADDRESS</h3>
              <div className="form-group">
                <label>Address Line 1</label>
                <input type="text" name="addressLine" className="form-input" value={formData.addressLine} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input type="text" name="city" className="form-input" value={formData.city} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input type="text" name="state" className="form-input" value={formData.state} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Pincode</label>
                  <input type="text" name="pincode" className="form-input" value={formData.pincode} onChange={handleChange} required />
                </div>
              </div>

              <div className="profile-actions">
                <button type="button" onClick={() => setIsEditing(false)} className="btn-ghost">CANCEL</button>
                <button type="submit" disabled={loading} className="btn-auth-primary" style={{ width: 'auto', marginTop: 0 }}>
                  {loading ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-view">
              <h3 className="section-title">PERSONAL INFORMATION</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Full Name</span>
                  <span className="info-value">{userProfile.fullName}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Email</span>
                  <span className="info-value">{userProfile.email}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Mobile Number</span>
                  <span className="info-value">{userProfile.phone}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Age</span>
                  <span className="info-value">{userProfile.age}</span>
                </div>
              </div>

              <h3 className="section-title" style={{ marginTop: '40px' }}>DELIVERY ADDRESS</h3>
              <div className="address-card">
                <p>{userProfile.address?.line1}</p>
                <p>{userProfile.address?.city}, {userProfile.address?.state}</p>
                <p>{userProfile.address?.pincode}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
