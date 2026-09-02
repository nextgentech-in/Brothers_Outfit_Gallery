import { useState, useEffect } from 'react';
import { getStoreSettings, saveStoreSettings } from '../../services/adminService';
import './AdminSettings.css';

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    storeName: '',
    phone: '',
    email: '',
    address: '',
    whatsappNumber: '',
    freeShippingMin: 1500,
    autoDiscountThreshold: 2000,
    autoDiscountAmount: 250
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getStoreSettings();
      setSettings(prev => ({ ...prev, ...data }));
      setLoading(false);
    }
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await saveStoreSettings(settings);
    setSaving(false);
    alert('Store settings saved successfully!');
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

        <button type="submit" disabled={saving} className="admin-btn-primary" style={{padding: '14px 28px'}}>
          {saving ? 'SAVING...' : 'SAVE ALL SETTINGS'}
        </button>
      </form>
    </div>
  );
}
