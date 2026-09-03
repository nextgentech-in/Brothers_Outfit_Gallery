import { useState, useEffect } from 'react';
import { getHomepageConfig, saveHomepageConfig } from '../../services/adminService';
import './AdminHomepage.css';

export default function AdminHomepage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    showHero: true,
    showTrending: true,
    showSaleSection: true,
    showNewArrivals: true,
    showShopCollection: true,
    showAboutPreview: true,
    showTrustBadges: true,
    showReviews: true
  });

  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getHomepageConfig();
        if (data && Object.keys(data).length > 0) {
          setConfig(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error('Failed to load homepage config:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggle = (key) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    setSaveStatus(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await saveHomepageConfig(config);
      setSaveStatus({ type: 'success', text: 'Homepage section settings saved successfully! Live homepage updated.' });
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (err) {
      console.error('Error saving homepage config:', err);
      setSaveStatus({ type: 'error', text: 'Failed to save homepage settings: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEnableAll = () => {
    const allEnabled = {};
    sections.forEach(s => { allEnabled[s.key] = true; });
    setConfig(prev => ({ ...prev, ...allEnabled }));
    setSaveStatus(null);
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading homepage manager...</div>;

  const sections = [
    { key: 'showHero', title: 'Hero Banner', desc: 'Main full-width video/carousel banner at top of home page' },
    { key: 'showTrending', title: 'Trending Now Carousel', desc: 'Infinite horizontal scrolling carousel of trending items' },
    { key: 'showSaleSection', title: 'Limited Time Sale Banner', desc: 'Active sales products grid with live countdown timer' },
    { key: 'showNewArrivals', title: 'New Arrivals Grid', desc: 'Products added in the last 10 days' },
    { key: 'showShopCollection', title: 'Shop Our Collection', desc: 'Featured full catalog preview' },
    { key: 'showAboutPreview', title: 'About Us Banner', desc: 'Story highlight and store image banner' },
    { key: 'showTrustBadges', title: 'Why Shop With Us', desc: 'Trust icons: Quality, Styles, Secure, Support' },
    { key: 'showReviews', title: 'Customer Reviews Carousel', desc: 'Verified customer ratings & reviews section' },
  ];

  return (
    <div className="admin-homepage-mgr">
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="admin-title">Homepage Section Visibility</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>Control which sections are displayed to visitors on the live storefront.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            type="button" 
            onClick={handleEnableAll}
            className="admin-action-btn"
            style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
          >
            Enable All Sections
          </button>
          <a 
            href="/" 
            target="_blank" 
            rel="noreferrer" 
            className="admin-action-btn" 
            style={{ padding: '8px 16px', background: '#1e293b', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            Preview Store ↗
          </a>
        </div>
      </div>

      {saveStatus && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontWeight: 600,
          fontSize: '14px',
          background: saveStatus.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: saveStatus.type === 'success' ? '#15803d' : '#b91c1c',
          border: `1px solid ${saveStatus.type === 'success' ? '#86efac' : '#fca5a5'}`
        }}>
          {saveStatus.text}
        </div>
      )}

      <div className="homepage-sections-list">
        {sections.map(sec => (
          <div key={sec.key} className="section-toggle-card">
            <div>
              <h3>{sec.title}</h3>
              <p>{sec.desc}</p>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={config[sec.key] !== false} 
                onChange={() => handleToggle(sec.key)} 
              />
              <span className="slider round"></span>
            </label>
          </div>
        ))}
      </div>

      <button 
        onClick={handleSave} 
        disabled={saving} 
        className="admin-btn-primary"
        style={{marginTop: '24px', padding: '14px 32px', fontSize: '14px', letterSpacing: '1px'}}
      >
        {saving ? 'SAVING CHANGES...' : 'SAVE HOMEPAGE CONFIG'}
      </button>
    </div>
  );
}
