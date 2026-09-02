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

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getHomepageConfig();
      setConfig(prev => ({ ...prev, ...data }));
      setLoading(false);
    }
    load();
  }, []);

  const handleToggle = (key) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveHomepageConfig(config);
    setSaving(false);
    alert('Homepage configuration saved!');
  };

  if (loading) return <div>Loading homepage manager...</div>;

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
      <div className="admin-header">
        <h1 className="admin-title">Homepage Section Visibility</h1>
      </div>

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
                checked={config[sec.key]} 
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
        style={{marginTop: '24px', padding: '14px 28px'}}
      >
        {saving ? 'SAVING...' : 'SAVE HOMEPAGE CONFIG'}
      </button>
    </div>
  );
}
