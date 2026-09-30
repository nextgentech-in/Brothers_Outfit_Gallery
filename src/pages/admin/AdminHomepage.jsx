import { useState, useEffect, useRef, useMemo } from 'react';
import { getHomepageConfig, saveHomepageConfig, getAdminProducts, toggleProductTrending } from '../../services/adminService';
import { uploadImageToImageKit } from '../../utils/imageUtils';
import { useAdminUI } from '../../context/AdminUIContext';
import './AdminHomepage.css';

const PRESET_BANNERS = [
  { name: 'Studio Fashion (Default)', url: '/images/hero.png' },
  { name: 'Store Entrance Look', url: '/images/store-real-1.jpeg' },
  { name: 'Store Interior Gallery', url: '/images/store-real-2.jpeg' },
  { name: 'Streetwear Collection', url: '/images/trending-streetwear.png' },
];

const DEFAULT_CATEGORIES = [
  'Kurta', 'Shirts', 'T-Shirts', 'Jeans', 'Trousers', 'Shorts',
  'Jackets', 'Hoodies', 'Ethnic Wear', 'Perfumes', 'Slippers',
  'Caps', 'Sunglasses', 'Watches', 'Wallets', 'Belts', 'Accessories'
];

export default function AdminHomepage() {
  const [activeTab, setActiveTab] = useState('hero'); // 'hero' | 'categories' | 'trending' | 'sections'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);
  const { showToast } = useAdminUI();

  // Category image upload & management state
  const [categorySearch, setCategorySearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryUploadFolder, setCategoryUploadFolder] = useState('categories');
  const [uploadingCategory, setUploadingCategory] = useState(null);
  const [uploadingNewCategory, setUploadingNewCategory] = useState(false);
  const [activeUploadCategory, setActiveUploadCategory] = useState(null);
  const categoryFileInputRef = useRef(null);
  const newCategoryFileInputRef = useRef(null);

  // Catalog products for Trending & Category placement manager
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [trendingSearch, setTrendingSearch] = useState('');
  const [togglingTrendingId, setTogglingTrendingId] = useState(null);

  const [config, setConfig] = useState({
    showHero: true,
    showShopCategory: true,
    showTrending: true,
    showSaleSection: true,
    showNewArrivals: true,
    showShopCollection: true,
    showAboutPreview: true,
    showTrustBadges: true,
    showReviews: true,
    categoryImages: {},
    trending: {
      label: 'CURATED FOR YOU',
      title: 'TRENDING NOW',
      subtitle: "Discover the styles defining men's fashion right now."
    },
    hero: {
      bannerImage: '/images/hero.png',
      mobileBannerImage: '',
      eyebrow: '',
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
        const [data, productsData] = await Promise.all([
          getHomepageConfig(),
          getAdminProducts().catch(() => [])
        ]);
        if (data && Object.keys(data).length > 0) {
          setConfig(prev => ({
            ...prev,
            ...data,
            categoryImages: data.categoryImages || {},
            categoryUploadFolder: data.categoryUploadFolder || 'categories',
            hero: {
              ...prev.hero,
              ...(data.hero || {})
            },
            trending: {
              label: 'CURATED FOR YOU',
              title: 'TRENDING NOW',
              subtitle: "Discover the styles defining men's fashion right now.",
              ...(data.trending || {})
            }
          }));
          if (data.categoryUploadFolder) {
            setCategoryUploadFolder(data.categoryUploadFolder);
          }
        }
        setCatalogProducts(productsData || []);
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

  const handleTrendingConfigChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      trending: {
        ...prev.trending,
        [field]: value
      }
    }));
    setSaveStatus(null);
  };

  const handleToggleTrendingProduct = async (productId, currentStatus) => {
    const newStatus = !currentStatus;
    setTogglingTrendingId(productId);
    // Optimistic local state update
    setCatalogProducts(prev => prev.map(p => p.id === productId ? { ...p, isTrending: newStatus } : p));
    try {
      await toggleProductTrending(productId, newStatus);
      setSaveStatus({
        type: 'success',
        text: newStatus ? '🔥 Product added to Trending section!' : '✓ Product removed from Trending section.'
      });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      console.error('Failed to toggle trending:', err);
      setCatalogProducts(prev => prev.map(p => p.id === productId ? { ...p, isTrending: currentStatus } : p));
      setSaveStatus({ type: 'error', text: 'Failed to update trending status. Please try again.' });
    } finally {
      setTogglingTrendingId(null);
    }
  };

  const handleToggle = (key) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    setSaveStatus(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WEBP).', 'warning');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size exceeds 10MB. Please select a smaller image.', 'error');
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
      // Filter out any oversized data URLs that might cause Firestore entity errors
      const sanitizedCatImages = {};
      for (const [k, v] of Object.entries(config.categoryImages || {})) {
        if (typeof v === 'string' && v.trim()) {
          if (v.startsWith('data:image/') && v.length > 250000) continue;
          sanitizedCatImages[k] = v.trim();
        }
      }
      const toSave = {
        ...config,
        categoryImages: sanitizedCatImages,
        categoryUploadFolder: categoryUploadFolder || 'categories'
      };
      const saved = await saveHomepageConfig(toSave);
      if (saved) setConfig(prev => ({ ...prev, ...saved }));
      setSaveStatus({ type: 'success', text: '🎉 Homepage settings & Category Images updated! Changes are live on the store in 0ms.' });
      showToast('Homepage settings & Category Images saved successfully!', 'success');
      setTimeout(() => setSaveStatus(null), 6000);
    } catch (err) {
      console.error('Error saving homepage config:', err);
      setSaveStatus({ type: 'error', text: 'Failed to save settings: ' + (err.message || 'Please check your connection.') });
      showToast('Failed to save settings: ' + (err.message || 'Unknown error'), 'error');
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

  // Categories derived from default set, products, and custom images
  const allCategoryList = useMemo(() => {
    const list = [...DEFAULT_CATEGORIES];
    catalogProducts.forEach(p => {
      const c = p.categoryId || p.category;
      if (c && typeof c === 'string' && c.trim()) {
        const trimmed = c.trim();
        if (!list.some(item => item.toLowerCase() === trimmed.toLowerCase())) {
          list.push(trimmed);
        }
      }
    });
    if (config.categoryImages) {
      Object.keys(config.categoryImages).forEach(k => {
        if (k && typeof k === 'string' && k.trim()) {
          const trimmed = k.trim();
          if (!list.some(item => item.toLowerCase() === trimmed.toLowerCase())) {
            list.push(trimmed);
          }
        }
      });
    }
    return list;
  }, [catalogProducts, config.categoryImages]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return allCategoryList;
    const q = categorySearch.toLowerCase().trim();
    return allCategoryList.filter(c => c.toLowerCase().includes(q));
  }, [allCategoryList, categorySearch]);

  const getCategoryFallbackImage = (catName) => {
    const prods = catalogProducts.filter(p => {
      const c = (p.categoryId || p.category || '').toLowerCase();
      return c === catName.toLowerCase();
    });
    for (const p of prods) {
      const url = p.thumbnailUrl ||
        (Array.isArray(p.images) ? (p.images[0]?.url || (typeof p.images[0] === 'string' ? p.images[0] : null)) : null) ||
        p.image;
      if (url) return { url, count: prods.length };
    }
    return { url: null, count: prods.length };
  };

  const triggerCategoryUpload = (catName) => {
    setActiveUploadCategory(catName);
    if (categoryFileInputRef.current) {
      categoryFileInputRef.current.value = '';
      categoryFileInputRef.current.click();
    }
  };

  const handleCategoryFileChange = async (e) => {
    const file = e.target.files?.[0];
    const category = activeUploadCategory;
    if (!file || !category) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WEBP).', 'warning');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size exceeds 10MB. Please select a smaller image.', 'error');
      return;
    }

    setUploadingCategory(category);
    try {
      const folderTarget = `${categoryUploadFolder || 'categories'}/`;
      const result = await uploadImageToImageKit(file, folderTarget);
      if (result?.url) {
        handleCategoryImageUrlChange(category, result.url);
        showToast(`Image uploaded for "${category}" directly to folder "${categoryUploadFolder || 'categories'}"! Click "Save Changes" to publish.`, 'success');
      }
    } catch (err) {
      console.error('Category upload error:', err);
      showToast('Upload failed: ' + (err.message || 'Check network connection.'), 'error');
    } finally {
      setUploadingCategory(null);
      setActiveUploadCategory(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleAddNewCategoryWithFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      showToast('Please enter a category name first.', 'warning');
      if (e.target) e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WEBP).', 'warning');
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size exceeds 10MB. Please select a smaller image.', 'error');
      if (e.target) e.target.value = '';
      return;
    }

    setUploadingNewCategory(true);
    try {
      const folderTarget = `${categoryUploadFolder || 'categories'}/`;
      const result = await uploadImageToImageKit(file, folderTarget);
      if (result?.url) {
        setConfig(prev => ({
          ...prev,
          categoryImages: {
            ...(prev.categoryImages || {}),
            [trimmed]: result.url
          }
        }));
        setCategorySearch(trimmed);
        setNewCategoryName('');
        showToast(`🎉 Category "${trimmed}" added and image uploaded to folder "${categoryUploadFolder || 'categories'}"! Click "Save Changes" to publish.`, 'success');
      }
    } catch (err) {
      console.error('New category image upload error:', err);
      showToast('Upload failed: ' + (err.message || 'Check network connection.'), 'error');
    } finally {
      setUploadingNewCategory(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleCategoryImageUrlChange = (category, url) => {
    const cleanUrl = typeof url === 'string' ? url.trim() : '';
    if (cleanUrl.startsWith('data:image/') && cleanUrl.length > 250000) {
      showToast('Photo is too large for inline saving. Please select a smaller image.', 'warning');
      return;
    }
    setConfig(prev => ({
      ...prev,
      categoryImages: {
        ...(prev.categoryImages || {}),
        [category]: cleanUrl
      }
    }));
    setSaveStatus(null);
  };

  const handleRemoveCategoryImage = (category) => {
    setConfig(prev => {
      const updated = { ...(prev.categoryImages || {}) };
      delete updated[category];
      return {
        ...prev,
        categoryImages: updated
      };
    });
    showToast(`Removed custom image for "${category}". Reverted to catalog photo.`, 'info');
    setSaveStatus(null);
  };

  const handleAddCustomCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      showToast('Please enter a category name.', 'warning');
      return;
    }
    if (allCategoryList.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      showToast(`Category "${trimmed}" is already in the list.`, 'info');
      setCategorySearch(trimmed);
      setNewCategoryName('');
      return;
    }
    setConfig(prev => ({
      ...prev,
      categoryImages: {
        ...(prev.categoryImages || {}),
        [trimmed]: ''
      }
    }));
    setCategorySearch(trimmed);
    setNewCategoryName('');
    showToast(`Category "${trimmed}" added! You can now upload or set an image.`, 'success');
  };

  const sections = [
    { key: 'showHero', title: 'Hero Banner Section', desc: 'Main full-width banner with headline and calls to action' },
    { key: 'showShopCategory', title: 'Shop By Category Section', desc: 'Category cards showcase with large full-bleed imagery and small text' },
    { key: 'showTrending', title: 'Trending Now Carousel', desc: 'Infinite horizontal scrolling carousel of curated trends' },
    { key: 'showSaleSection', title: 'Limited Time Sale Banner', desc: 'Active sales products grid with live countdown timer' },
    { key: 'showNewArrivals', title: 'New Arrivals Grid', desc: 'Fresh arrivals catalog added in the last 15 days' },
    { key: 'showShopCollection', title: 'Shop Our Collection', desc: 'Featured full catalog category showcase' },
    { key: 'showAboutPreview', title: 'About Us Banner', desc: 'Brand story highlight and physical store photo' },
    { key: 'showTrustBadges', title: 'Why Shop With Us (Trust Bar)', desc: 'Shipping, exchanges, fabric quality, and concierge' },
    { key: 'showReviews', title: 'Customer Reviews Carousel', desc: 'Verified customer ratings & real reviews showcase' },
  ];

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        <div className="product-skeleton" style={{ maxWidth: '400px', height: '180px', margin: '0 auto 20px' }} />
        Loading homepage manager...
      </div>
    );
  }

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
            rel="noopener noreferrer" 
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
          onClick={() => setActiveTab('categories')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'categories' ? '2px solid #0f172a' : '2px solid transparent',
            color: activeTab === 'categories' ? '#0f172a' : '#64748b',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          📁 Category Images ({Object.values(config.categoryImages || {}).filter(Boolean).length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trending')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'trending' ? '2px solid #0f172a' : '2px solid transparent',
            color: activeTab === 'trending' ? '#0f172a' : '#64748b',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🔥 Trending Section ({catalogProducts.filter(p => p.isTrending === true).length})
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

      {/* TAB 2: CATEGORY IMAGES MANAGER */}
      {activeTab === 'categories' && (
        <div className="category-manager-container">
          {/* Header Card */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px', color: '#0f172a' }}>
                  📁 Shop By Category Images & Cards
                </h2>
                <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b' }}>
                  Upload full-card images for category cards shown on the homepage.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: '20px',
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #86efac'
                }}>
                  ● {Object.values(config.categoryImages || {}).filter(Boolean).length} Custom Images Active
                </span>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="admin-btn-primary"
                  style={{ padding: '8px 20px', fontSize: '13px' }}
                >
                  {saving ? 'SAVING...' : '✓ SAVE CHANGES'}
                </button>
              </div>
            </div>

            {/* Filter and Add Category Row */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px' }}>
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="🔍 Search categories (e.g. Kurta, Shirts, Jeans)..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', flex: '1 1 420px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCategory()}
                  placeholder="New category name (e.g. Blazers, Kurtis)..."
                  style={{
                    flex: '1 1 180px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  disabled={uploadingNewCategory}
                  onClick={() => {
                    if (!newCategoryName.trim()) {
                      showToast('Please type a category name first.', 'warning');
                      return;
                    }
                    if (newCategoryFileInputRef.current) {
                      newCategoryFileInputRef.current.value = '';
                      newCategoryFileInputRef.current.click();
                    }
                  }}
                  style={{
                    padding: '10px 16px',
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: uploadingNewCategory ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                  title={`Upload category picture directly to ImageKit folder "${categoryUploadFolder}" and add`}
                >
                  {uploadingNewCategory ? '⏳ Uploading...' : '📤 Upload Image & Add'}
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomCategory}
                  style={{
                    padding: '10px 14px',
                    background: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  + Add Empty
                </button>
              </div>
            </div>

            {/* Target ImageKit Folder Configuration Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              marginTop: '16px',
              padding: '10px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12.5px',
              color: '#334155'
            }}>
              <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                📁 ImageKit Upload Folder:
              </span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#64748b', fontFamily: 'monospace' }}>/</span>
                <input
                  type="text"
                  value={categoryUploadFolder}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
                    setCategoryUploadFolder(cleaned);
                    setConfig(prev => ({ ...prev, categoryUploadFolder: cleaned }));
                    setSaveStatus(null);
                  }}
                  placeholder="categories"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: '#0f172a',
                    background: '#ffffff',
                    width: '130px'
                  }}
                />
                <span style={{ color: '#64748b', fontFamily: 'monospace' }}>/</span>
              </div>
              <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '11.5px' }}>
                ✓ Direct CDN Upload active to folder: <strong>{categoryUploadFolder || 'categories'}</strong>
              </span>
            </div>
          </div>

          {/* Hidden File Input for New Category Direct Upload */}
          <input
            type="file"
            ref={newCategoryFileInputRef}
            onChange={handleAddNewCategoryWithFile}
            accept="image/png, image/jpeg, image/jpg, image/webp"
            style={{ display: 'none' }}
          />

          {/* Hidden File Input for Category Card Image Upload */}
          <input
            type="file"
            ref={categoryFileInputRef}
            onChange={handleCategoryFileChange}
            accept="image/png, image/jpeg, image/jpg, image/webp"
            style={{ display: 'none' }}
          />

          {/* Categories Grid */}
          {filteredCategories.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              No categories matching "{categorySearch}".
            </div>
          ) : (
            <div className="category-admin-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '14px'
            }}>
              {filteredCategories.map(catName => {
                const customImg = config.categoryImages?.[catName] || '';
                const fallback = getCategoryFallbackImage(catName);
                const displayImg = customImg;
                const isCustom = Boolean(customImg);
                const isUploading = uploadingCategory === catName;

                return (
                  <div
                    key={catName}
                    className="category-admin-card"
                    style={{
                      background: '#fff',
                      borderRadius: '12px',
                      border: isCustom ? '2px solid #0f172a' : '1px solid #e2e8f0',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: isCustom ? '0 4px 14px rgba(15, 23, 42, 0.08)' : '0 2px 6px rgba(0,0,0,0.03)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Live Preview of Category Card (compact 4 in a row matching homepage) */}
                    <div className="category-admin-preview" style={{
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      maxHeight: '175px',
                      background: '#1a1a1a',
                      overflow: 'hidden'
                    }}>
                      {displayImg ? (
                        <img
                          src={displayImg}
                          alt={catName}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center top'
                          }}
                          onError={(e) => {
                            e.target.style.opacity = '0.2';
                          }}
                        />
                      ) : (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          color: '#94a3b8',
                          padding: '20px',
                          textAlign: 'center'
                        }}>
                          <span style={{ fontSize: '36px', marginBottom: '8px' }}>🖼️</span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>No Image Assigned</span>
                          <span style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>Upload category image below</span>
                        </div>
                      )}

                      {/* Gradient Overlay for Text Legibility */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 45%, transparent 100%)',
                        pointerEvents: 'none'
                      }} />

                      {/* Status Badge */}
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        zIndex: 3
                      }}>
                        {isCustom ? (
                          <span style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: '#16a34a',
                            color: '#ffffff',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            letterSpacing: '0.3px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ✓ Active Category Image
                          </span>
                        ) : (
                          <span style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: 'rgba(71, 85, 105, 0.88)',
                            backdropFilter: 'blur(6px)',
                            color: '#ffffff'
                          }}>
                            No Image Assigned
                          </span>
                        )}
                      </div>

                      {/* Upload Spinner Overlay */}
                      {isUploading && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(15, 23, 42, 0.85)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          zIndex: 5
                        }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            border: '3px solid rgba(255,255,255,0.2)',
                            borderTopColor: '#fff',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            marginBottom: '10px'
                          }} />
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>Uploading to ImageKit...</span>
                        </div>
                      )}

                      {/* Category Label at bottom */}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '16px 18px',
                        zIndex: 2,
                        color: '#fff'
                      }}>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: 800,
                          letterSpacing: '1.2px',
                          textTransform: 'uppercase',
                          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                          lineHeight: 1.2
                        }}>
                          {catName}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'rgba(255, 255, 255, 0.75)',
                          marginTop: '3px'
                        }}>
                          {fallback.count} {fallback.count === 1 ? 'Product' : 'Products'} in catalog
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="category-admin-actions" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'space-between' }}>
                      <div className="category-admin-action-stack" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Device Upload Button */}
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => triggerCategoryUpload(catName)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: '#0f172a',
                            color: '#fff',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: isUploading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'background 0.2s'
                          }}
                          className="category-admin-upload-btn"
                        >
                          📤 {isCustom ? 'Replace Image' : 'Upload Image'}
                        </button>

                        {/* URL Input */}
                        <div>
                          <input
                            className="category-admin-url-input"
                            type="text"
                            value={customImg}
                            onChange={(e) => handleCategoryImageUrlChange(catName, e.target.value)}
                            placeholder="Or paste image URL (https://...)"
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>

                      {/* Reset Button (only if custom image is active) */}
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCategoryImage(catName)}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            background: '#fff1f2',
                            color: '#e11d48',
                            border: '1px solid #fecdd3',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          className="category-admin-remove-btn"
                        >
                          🗑️ Remove Custom Image
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TRENDING SECTION MANAGER */}
      {activeTab === 'trending' && (
        <div className="trending-editor-container">
          {/* Section 1: Heading & Copy Config */}
          <div className="editor-card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '28px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              ✍️ Trending Section Header & Copy
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
              Customize the title, eyebrow badge, and subtitle text displayed above the trending carousel on the homepage.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Eyebrow Label (Small Tag):
                </label>
                <input
                  type="text"
                  value={config.trending?.label || ''}
                  onChange={(e) => handleTrendingConfigChange('label', e.target.value)}
                  placeholder="CURATED FOR YOU"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Section Title:
                </label>
                <input
                  type="text"
                  value={config.trending?.title || ''}
                  onChange={(e) => handleTrendingConfigChange('title', e.target.value)}
                  placeholder="TRENDING NOW"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Subtitle Description:
                </label>
                <input
                  type="text"
                  value={config.trending?.subtitle || ''}
                  onChange={(e) => handleTrendingConfigChange('subtitle', e.target.value)}
                  placeholder="Discover the styles defining men's fashion right now."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Currently Featured in Trending */}
          {(() => {
            const trendingProducts = catalogProducts.filter(p => p.isTrending === true);
            return (
              <div className="editor-card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🔥 Featured Products in Trending ({trendingProducts.length})
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                      These products are shown in the animated infinite carousel on the storefront homepage.
                    </p>
                  </div>
                  <a
                    href="/admin/products"
                    className="admin-action-btn"
                    style={{ padding: '6px 12px', background: '#f1f5f9', color: '#334155', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, textDecoration: 'none' }}
                  >
                    View in Products Table →
                  </a>
                </div>

                {trendingProducts.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🛍️</div>
                    <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: '#334155' }}>
                      No products are currently marked as Trending.
                    </p>
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      Search below to add items from your catalog, or toggle the "🔥 Trending" button in the Products list.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                    {trendingProducts.map(p => {
                      const img = p.images?.[0]?.url || (typeof p.images?.[0] === 'string' ? p.images[0] : null) || p.thumbnailUrl || p.image || '/images/hero.png';
                      const price = p.salePrice || p.price || 0;
                      const mrp = p.mrp || p.compareAtPrice || 0;
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            gap: '12px',
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #fef3c7',
                            background: '#fffbeb',
                            alignItems: 'center',
                            transition: 'all 0.15s ease'
                          }}
                          className="category-admin-remove-btn"
                        >
                          <img
                            src={img}
                            alt={p.name}
                            style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #fed7aa', flexShrink: 0 }}
                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/hero.png'; }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ margin: '0 0 2px', fontSize: '13.5px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.name || 'Unnamed Product'}
                            </h4>
                            <div style={{ fontSize: '11.5px', color: '#78716c', marginBottom: '4px' }}>
                              {p.category || p.categoryId || 'General'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#b45309' }}>
                                ₹{price.toLocaleString('en-IN')}
                              </span>
                              {mrp > price && (
                                <span style={{ fontSize: '11px', color: '#a8a29e', textDecoration: 'line-through' }}>
                                  ₹{mrp.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={togglingTrendingId === p.id}
                            onClick={() => handleToggleTrendingProduct(p.id, true)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: '#fee2e2',
                              border: '1px solid #fca5a5',
                              color: '#b91c1c',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: togglingTrendingId === p.id ? 'not-allowed' : 'pointer',
                              flexShrink: 0
                            }}
                            title="Remove from Trending section"
                          >
                            {togglingTrendingId === p.id ? '...' : '✕ Remove'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Section 3: Add from Catalog */}
          <div className="editor-card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              ➕ Add Products from Catalog to Trending
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
              Search your catalog below and click "+ Add to Trending" to instantly feature products on the homepage.
            </p>

            {/* Search Input */}
            <div style={{ marginBottom: '18px' }}>
              <input
                type="text"
                value={trendingSearch}
                onChange={(e) => setTrendingSearch(e.target.value)}
                placeholder="Search products by title, SKU, or category to add..."
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px'
                }}
              />
            </div>

            {(() => {
              const nonTrending = catalogProducts.filter(p => {
                if (p.isTrending === true) return false;
                if (!trendingSearch) return true;
                const q = trendingSearch.toLowerCase();
                return (
                  p.name?.toLowerCase().includes(q) ||
                  p.category?.toLowerCase().includes(q) ||
                  p.categoryId?.toLowerCase().includes(q) ||
                  p.sku?.toLowerCase().includes(q)
                );
              });

              if (nonTrending.length === 0) {
                return (
                  <p style={{ color: '#64748b', fontSize: '13.5px', textAlign: 'center', padding: '24px 0' }}>
                    {trendingSearch ? 'No matching products found.' : 'All catalog products are already added to Trending!'}
                  </p>
                );
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {nonTrending.slice(0, 30).map(p => {
                    const img = p.images?.[0]?.url || (typeof p.images?.[0] === 'string' ? p.images[0] : null) || p.thumbnailUrl || p.image || '/images/hero.png';
                    const price = p.salePrice || p.price || 0;
                    const _mrp = p.mrp || p.compareAtPrice || 0;
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#fafafa'
                        }}
                      >
                        <img
                          src={img}
                          alt={p.name}
                          style={{ width: '46px', height: '46px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0', flexShrink: 0 }}
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/hero.png'; }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name || 'Unnamed Product'}
                          </h4>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {p.category || p.categoryId || 'General'} · ₹{price.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={togglingTrendingId === p.id}
                          onClick={() => handleToggleTrendingProduct(p.id, false)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#0f172a',
                            border: 'none',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: togglingTrendingId === p.id ? 'not-allowed' : 'pointer',
                            flexShrink: 0,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {togglingTrendingId === p.id ? '...' : '+ Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
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
