import { useState, useEffect } from 'react';
import { getAdminCoupons, createCoupon, deleteCoupon } from '../../services/adminService';
import './AdminCoupons.css';

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'percentage', // 'percentage' or 'flat'
    discountValue: '',
    minOrderAmount: '',
    expiryDate: ''
  });

  const fetchCoupons = async () => {
    setLoading(true);
    const data = await getAdminCoupons();
    setCoupons(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.discountValue) {
      return alert('Please enter code and discount value');
    }
    await createCoupon({
      ...newCoupon,
      discountValue: Number(newCoupon.discountValue),
      minOrderAmount: Number(newCoupon.minOrderAmount) || 0,
      active: true
    });
    setNewCoupon({ code: '', discountType: 'percentage', discountValue: '', minOrderAmount: '', expiryDate: '' });
    setShowModal(false);
    fetchCoupons();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this coupon code?")) {
      await deleteCoupon(id);
      fetchCoupons();
    }
  };

  return (
    <div className="admin-coupons-page">
      <div className="admin-header">
        <h1 className="admin-title">Discount Coupons ({coupons.length})</h1>
        <button onClick={() => setShowModal(true)} className="admin-btn-primary">
          + CREATE COUPON
        </button>
      </div>

      {showModal && (
        <div className="coupon-modal-backdrop">
          <form className="coupon-modal-form" onSubmit={handleCreate}>
            <h3>Create New Discount Coupon</h3>
            
            <div className="admin-form-group">
              <label>Coupon Code (e.g. BROTHERS10)</label>
              <input 
                type="text" 
                value={newCoupon.code} 
                onChange={(e) => setNewCoupon({...newCoupon, code: e.target.value})}
                placeholder="WELCOME25"
                required
              />
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Discount Type</label>
                <select 
                  value={newCoupon.discountType}
                  onChange={(e) => setNewCoupon({...newCoupon, discountType: e.target.value})}
                >
                  <option value="percentage">Percentage (% OFF)</option>
                  <option value="flat">Flat Amount (₹ OFF)</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label>Discount Value</label>
                <input 
                  type="number" 
                  value={newCoupon.discountValue}
                  onChange={(e) => setNewCoupon({...newCoupon, discountValue: e.target.value})}
                  placeholder="15"
                  required
                />
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Min Order Amount (₹)</label>
                <input 
                  type="number" 
                  value={newCoupon.minOrderAmount}
                  onChange={(e) => setNewCoupon({...newCoupon, minOrderAmount: e.target.value})}
                  placeholder="999"
                />
              </div>

              <div className="admin-form-group">
                <label>Expiry Date</label>
                <input 
                  type="date" 
                  value={newCoupon.expiryDate}
                  onChange={(e) => setNewCoupon({...newCoupon, expiryDate: e.target.value})}
                />
              </div>
            </div>

            <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
              <button type="submit" className="admin-btn-primary">SAVE COUPON</button>
              <button type="button" onClick={() => setShowModal(false)} className="admin-btn-secondary">CANCEL</button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>CODE</th>
              <th>DISCOUNT</th>
              <th>MIN ORDER</th>
              <th>EXPIRY</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px'}}>Loading coupons...</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px'}}>No coupons created yet. Click "+ CREATE COUPON".</td></tr>
            ) : coupons.map(c => (
              <tr key={c.id}>
                <td><strong>{c.code}</strong></td>
                <td>
                  {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`}
                </td>
                <td>₹{c.minOrderAmount || 0}</td>
                <td>{c.expiryDate || 'No Expiry'}</td>
                <td>
                  <span className="admin-badge admin-badge--active">Active</span>
                </td>
                <td>
                  <button onClick={() => handleDelete(c.id)} className="admin-action-btn delete">
                    DELETE
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
