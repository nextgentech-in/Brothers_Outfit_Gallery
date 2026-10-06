import { useState, useEffect } from 'react';
import { getStoreSettings, saveStoreSettings } from '../../services/adminService';
import { useAdminUI } from '../../context/AdminUIContext';
import './AdminSettings.css';

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useAdminUI();
  const [settings, setSettings] = useState({
    storeName: '',
    phone: '',
    email: '',
    address: '',
    whatsappNumber: '',
    freeShippingMin: 1500,
    autoDiscountThreshold: 2000,
    autoDiscountAmount: 250,
    exchangeWindowDays: 2
  });

  const [savedSettings, setSavedSettings] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getStoreSettings();
      setSettings(prev => ({ ...prev, ...data }));
      setSavedSettings(prev => ({ ...prev, ...data }));
      setLoading(false);
    }
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e, customSettings = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const toSave = customSettings || settings;
    const previous = savedSettings ? { ...savedSettings } : { ...settings };

    // 1. Optimistic UI update
    showToast('Store settings saved successfully!', 'success');
    setSavedSettings(toSave);

    // 2. Background update
    try {
      await saveStoreSettings(toSave);
    } catch (err) {
      console.error('Failed to save store settings:', err);
      // 3. Rollback on failure
      setSettings(previous);
      setSavedSettings(previous);
      showToast(err.message || 'Failed to save store settings', 'error', 7000, {
        label: 'Retry',
        onClick: () => handleSave(null, toSave)
      });
    }
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="admin-settings-page">
      <div className="admin-header">
        <h1 className="admin-title">Store Settings</h1>
      </div>

      <form onSubmit={handleSave} className="admin-settings-form">
        <section className="admin-form-section">
          <h3>General Business Info</h3>
          <div className="admin-form-group">
            <label>Store Name</label>
            <input 
              type="text" 
              name="storeName" 
              value={settings.storeName} 
              onChange={handleChange}
            />
          </div>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Business Phone</label>
              <input 
                type="text" 
                name="phone" 
                value={settings.phone} 
                onChange={handleChange}
              />
            </div>
            <div className="admin-form-group">
              <label>WhatsApp Support Number</label>
              <input 
                type="text" 
                name="whatsappNumber" 
                value={settings.whatsappNumber} 
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="admin-form-group">
            <label>Support Email</label>
            <input 
              type="email" 
              name="email" 
              value={settings.email} 
              onChange={handleChange}
            />
          </div>
          <div className="admin-form-group">
            <label>Physical Address</label>
            <textarea 
              name="address" 
              rows="2"
              value={settings.address} 
              onChange={handleChange}
            />
          </div>
        </section>

        <section className="admin-form-section">
          <h3>Shipping & Offer Thresholds</h3>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Free Shipping Min Amount (₹)</label>
              <input 
                type="number" 
                name="freeShippingMin" 
                value={settings.freeShippingMin} 
                onChange={handleChange}
              />
            </div>
            <div className="admin-form-group">
              <label>Auto-Discount Cart Threshold (₹)</label>
              <input 
                type="number" 
                name="autoDiscountThreshold" 
                value={settings.autoDiscountThreshold} 
                onChange={handleChange}
              />
            </div>
            <div className="admin-form-group">
              <label>Auto-Discount Amount (₹)</label>
              <input 
                type="number" 
                name="autoDiscountAmount" 
                value={settings.autoDiscountAmount} 
                onChange={handleChange}
              />
            </div>
          </div>
        </section>

        <section className="admin-form-section">
          <h3>Exchange Policy Settings</h3>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Exchange Window (Days from Delivery)</label>
              <input 
                type="number" 
                name="exchangeWindowDays" 
                min="1"
                max="30"
                value={settings.exchangeWindowDays || 2} 
                onChange={handleChange}
              />
              <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Default is 2 days (48 hours per published store policy). Exchange button and requests are only valid within this window.
              </span>
            </div>
          </div>
        </section>

        <button type="submit" disabled={saving} className="admin-btn-primary" style={{padding: '14px 28px'}}>
          {saving ? 'SAVING...' : 'SAVE ALL SETTINGS'}
        </button>
      </form>
    </div>
  );
}
