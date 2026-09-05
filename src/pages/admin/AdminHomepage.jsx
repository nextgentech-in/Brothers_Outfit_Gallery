import { useState, useEffect, useRef } from 'react';
import { getHomepageConfig, saveHomepageConfig } from '../../services/adminService';
import { uploadImageToImageKit } from '../../utils/imageUtils';
import './AdminHomepage.css';

const PRESET_BANNERS = [
  { name: 'Studio Fashion (Default)', url: '/images/hero.png' },
  { name: 'Store Entrance Look', url: '/images/store-real-1.jpeg' },
  { name: 'Store Interior Gallery', url: '/images/store-real-2.jpeg' },
  { name: 'Streetwear Collection', url: '/images/trending-streetwear.png' },
];

export default function AdminHomepage() {
  const [activeTab, setActiveTab] = useState('hero'); // 'hero' | 'sections'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  const [config, setConfig] = useState({
    showHero: true,
    showTrending: true,
    showSaleSection: true,
    showNewArrivals: true,
    showShopCollection: true,
    showAboutPreview: true,
    showTrustBadges: true,
    showReviews: true,
    hero: {
      bannerImage: '/images/hero.png',
      mobileBannerImage: '',
      eyebrow: 'NEW SEASON 2026',
      heading: 'DEFINE YOUR\nEVERYDAY STYLE',
      description: "Premium men's clothing designed for confidence, comfort and effortless style.",
      saleButtonText: '🔥 SALE — UP TO 50% OFF',
      saleButtonLink: '/sale',
      primaryButtonText: 'EXPLORE CATALOG',
      primaryButtonLink: '/shop',
      overlayOpacity: 0.55
    }
  });

  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getHomepageConfig();
        if (data && Object.keys(data).length > 0) {
          setConfig(prev => ({
            ...prev,
            ...data,
            hero: {
              ...prev.hero,
              ...(data.hero || {})
            }
          }));
        }
      } catch (err) {
        console.error('Failed to load homepage config:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleHeroChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      hero: {
        ...prev.hero,
        [field]: value
      }
    }));
    setSaveStatus(null);
  };

  const handleToggle = (key) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    setSaveStatus(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('Image size exceeds 8MB. Please select a smaller image.');
      return;
    }

    setUploadingImage(true);
    setUploadProgress('Uploading to ImageKit CDN...');

    try {
      const result = await uploadImageToImageKit(file, 'hero/');
      if (result?.url) {
        handleHeroChange('bannerImage', result.url);
        setSaveStatus({ type: 'success', text: 'New hero banner uploaded successfully! Click "Save Changes" to publish.' });
      }
    } catch (err) {
      console.error('Hero upload error:', err);
      setSaveStatus({ type: 'error', text: 'Upload failed: ' + (err.message || 'Check server connection.') });
    } finally {
      setUploadingImage(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await saveHomepageConfig(config);
      setSaveStatus({ type: 'success', text: '🎉 Homepage & Hero banner updated! Changes are live on the store in 0ms.' });
      setTimeout(() => setSaveStatus(null), 6000);
    } catch (err) {
      console.error('Error saving homepage config:', err);
      setSaveStatus({ type: 'error', text: 'Failed to save settings: ' + err.message });
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

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        <div className="product-skeleton" style={{ maxWidth: '400px', height: '180px', margin: '0 auto 20px' }} />
        Loading homepage manager...
      </div>
    );
  }

  const sections = [
    { key: 'showHero', title: 'Hero Banner Section', desc: 'Main full-width banner with headline and calls to action' },
    { key: 'showTrending', title: 'Trending Now Carousel', desc: 'Infinite horizontal scrolling carousel of curated trends' },
    { key: 'showSaleSection', title: 'Limited Time Sale Banner', desc: 'Active sales products grid with live countdown timer' },
    { key: 'showNewArrivals', title: 'New Arrivals Grid', desc: 'Fresh arrivals catalog added in the last 15 days' },
    { key: 'showShopCollection', title: 'Shop Our Collection', desc: 'Featured full catalog category showcase' },
    { key: 'showAboutPreview', title: 'About Us Banner', desc: 'Brand story highlight and physical store photo' },
    { key: 'showTrustBadges', title: 'Why Shop With Us (Trust Bar)', desc: 'Shipping, exchanges, fabric quality, and concierge' },
    { key: 'showReviews', title: 'Customer Reviews Carousel', desc: 'Verified customer ratings & real reviews showcase' },
  ];

  const hero = config.hero || {};

  return (
    <div className="admin-homepage-mgr">
      {/* Page Header */}
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 className="admin-title">Homepage & Banner Manager</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
            Customize the storefront hero banner image, headline copy, and section visibility.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={saving}
            className="admin-btn-primary"
            style={{ padding: '10px 22px', fontSize: '13px', letterSpacing: '0.5px' }}
          >
            {saving ? 'SAVING...' : '✓ SAVE CHANGES'}
          </button>
          <a 
            href="/" 
            target="_blank" 
            rel="noreferrer" 
            className="admin-action-btn" 
            style={{ padding: '10px 18px', background: '#0f172a', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            View Live Store ↗
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '28px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('hero')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'hero' ? '2px solid #0f172a' : '2px solid transparent',
            color: activeTab === 'hero' ? '#0f172a' : '#64748b',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🎨 Hero Banner & Content
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sections')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'sections' ? '2px solid #0f172a' : '2px solid transparent',
            color: activeTab === 'sections' ? '#0f172a' : '#64748b',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          👁️ Section Visibility
        </button>
      </div>

      {saveStatus && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '8px',
          marginBottom: '24px',
          fontWeight: 600,
          fontSize: '14px',
          background: saveStatus.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: saveStatus.type === 'success' ? '#15803d' : '#b91c1c',
          border: `1px solid ${saveStatus.type === 'success' ? '#86efac' : '#fca5a5'}`
        }}>
          {saveStatus.text}
        </div>
      )}

      {/* TAB 1: HERO BANNER & DESIGN */}
      {activeTab === 'hero' && (
        <div className="hero-editor-container">
          {/* Live Preview Card */}
          <div className="hero-preview-box" style={{
            position: 'relative',
            borderRadius: '16px',
            overflow: 'hidden',
            minHeight: '280px',
            marginBottom: '32px',
            background: '#0f172a',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            padding: '36px 32px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
          }}>
            <img
              src={hero.bannerImage || '/images/hero.png'}
              alt="Hero Preview"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.85
              }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/images/hero.png';
              }}
            />
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to right, rgba(0,0,0,${Math.min((hero.overlayOpacity || 0.55) + 0.2, 0.95)}) 0%, rgba(0,0,0,${hero.overlayOpacity || 0.55}) 50%, rgba(0,0,0,0.2) 100%)`
            }} />
            
            <div style={{ position: 'relative', zIndex: 2, maxWidth: '520px' }}>
              <span style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.85)',
                padding: '4px 12px',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '4px',
                marginBottom: '12px'
              }}>
                {hero.eyebrow || 'NEW SEASON 2026'}
              </span>
              <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 10px', lineHeight: 1.15, textTransform: 'uppercase' }}>
                {(hero.heading || 'DEFINE YOUR\nEVERYDAY STYLE').split('\n').map((line, i) => (
                  <span key={i} style={{ display: 'block' }}>{line}</span>
                ))}
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: '0 0 20px', lineHeight: 1.4 }}>
                {hero.description || "Premium men's clothing designed for confidence, comfort and effortless style."}
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {hero.saleButtonText && (
                  <span style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                    {hero.saleButtonText}
                  </span>
                )}
                {hero.primaryButtonText && (
                  <span style={{ padding: '8px 16px', background: '#fff', color: '#0f172a', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                    {hero.primaryButtonText}
                  </span>
                )}
              </div>
            </div>

            <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 3, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
              LIVE PREVIEW
            </div>
          </div>

          <div className="hero-settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Banner Image Card */}
            <div className="editor-card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>🖼️ Hero Banner Image</h3>

              {/* Upload Input */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Upload New Banner to ImageKit CDN:
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={uploadingImage}
                  style={{ display: 'none' }}
                  id="hero-file-upload"
                />
                <label
                  htmlFor="hero-file-upload"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    cursor: uploadingImage ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: '#334155'
                  }}
                >
                  {uploadingImage ? (
                    <span>⏳ {uploadProgress || 'Uploading...'}</span>
                  ) : (
                    <span>📁 Choose Image from Computer / Phone</span>
                  )}
                </label>
              </div>

              {/* URL Direct Input */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Or Direct Image URL:
                </label>
                <input
                  type="text"
                  value={hero.bannerImage || ''}
                  onChange={(e) => handleHeroChange('bannerImage', e.target.value)}
                  placeholder="https://ik.imagekit.io/... or /images/hero.png"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* Mobile Banner Image URL */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Mobile Portrait Banner URL (Optional):
                </label>
                <input
                  type="text"
                  value={hero.mobileBannerImage || ''}
                  onChange={(e) => handleHeroChange('mobileBannerImage', e.target.value)}
                  placeholder="Leave empty to use main banner on mobile"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* Quick Presets */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Quick Presets:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {PRESET_BANNERS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => handleHeroChange('bannerImage', preset.url)}
                      style={{
                        padding: '6px 12px',
                        background: hero.bannerImage === preset.url ? '#0f172a' : '#f1f5f9',
                        color: hero.bannerImage === preset.url ? '#fff' : '#334155',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Overlay Opacity Slider */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  <span>Text Readability Darkness:</span>
                  <span>{Math.round((hero.overlayOpacity || 0.55) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.85"
                  step="0.05"
                  value={hero.overlayOpacity || 0.55}
                  onChange={(e) => handleHeroChange('overlayOpacity', parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Darkens the background photo to make white text crystal clear.
                </span>
              </div>
            </div>

            {/* Typography & Buttons Card */}
            <div className="editor-card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>✍️ Hero Headings & Copy</h3>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Eyebrow Tag (Small Top Badge):
                </label>
                <input
                  type="text"
                  value={hero.eyebrow || ''}
                  onChange={(e) => handleHeroChange('eyebrow', e.target.value)}
                  placeholder="NEW SEASON 2026"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Main Heading (Use Enter for line breaks):
                </label>
                <textarea
                  rows="2"
                  value={hero.heading || ''}
                  onChange={(e) => handleHeroChange('heading', e.target.value)}
                  placeholder="DEFINE YOUR&#10;EVERYDAY STYLE"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Description Subtitle:
                </label>
                <textarea
                  rows="2"
                  value={hero.description || ''}
                  onChange={(e) => handleHeroChange('description', e.target.value)}
                  placeholder="Premium men's clothing designed for confidence..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit' }}
                />
              </div>

              <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#334155' }}>
                Buttons & Links:
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Sale Button Text:</label>
                  <input
                    type="text"
                    value={hero.saleButtonText || ''}
                    onChange={(e) => handleHeroChange('saleButtonText', e.target.value)}
                    placeholder="🔥 SALE — UP TO 50% OFF"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Sale Button Link:</label>
                  <input
                    type="text"
                    value={hero.saleButtonLink || ''}
                    onChange={(e) => handleHeroChange('saleButtonLink', e.target.value)}
                    placeholder="/sale"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Catalog Button Text:</label>
                  <input
                    type="text"
                    value={hero.primaryButtonText || ''}
                    onChange={(e) => handleHeroChange('primaryButtonText', e.target.value)}
                    placeholder="EXPLORE CATALOG"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Catalog Button Link:</label>
                  <input
                    type="text"
                    value={hero.primaryButtonLink || ''}
                    onChange={(e) => handleHeroChange('primaryButtonLink', e.target.value)}
                    placeholder="/shop"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECTIONS VISIBILITY */}
      {activeTab === 'sections' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button 
              type="button" 
              onClick={handleEnableAll}
              style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
            >
              Enable All Sections
            </button>
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
                    checked={config[sec.key] !== false} 
                    onChange={() => handleToggle(sec.key)} 
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Save Action */}
      <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="admin-btn-primary"
          style={{ padding: '14px 36px', fontSize: '14px', letterSpacing: '1px' }}
        >
          {saving ? 'SAVING CHANGES...' : 'SAVE HOMEPAGE CONFIG'}
        </button>
        <span style={{ fontSize: '13px', color: '#64748b' }}>
          Changes apply across desktop and mobile storefront immediately.
        </span>
      </div>
    </div>
  );
}
