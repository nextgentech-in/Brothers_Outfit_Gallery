import { useState, useEffect } from 'react';
import { getStoreSettings, saveStoreSettings, DEFAULT_OFFERS_CONFIG } from '../../services/adminService';
import { getCategories } from '../../services/productService';
import { useAdminUI } from '../../context/AdminUIContext';
import './AdminSettings.css';

const FALLBACK_CATEGORIES = [
  'Kurta',
  'Shirts',
  'T-Shirts',
  'Jeans',
  'Trousers',
  'Shorts',
  'Jackets',
  'Hoodies',
  'Ethnic Wear',
  'Perfumes',
  'Accessories',
  'Watches',
  'Wallets',
  'Belts'
];

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useAdminUI();
  const [availableCategories, setAvailableCategories] = useState(FALLBACK_CATEGORIES);
  const [settings, setSettings] = useState({
    storeName: '',
    phone: '',
    email: '',
    address: '',
    whatsappNumber: '',
    freeShippingMin: 1500,
    autoDiscountThreshold: 2000,
    autoDiscountAmount: 250,
    exchangeWindowDays: 2,
    offersConfig: DEFAULT_OFFERS_CONFIG
  });

  const [savedSettings, setSavedSettings] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [storeData, dbCategories] = await Promise.all([
          getStoreSettings(),
          getCategories()
        ]);

        const mergedOffersConfig = {
          ...DEFAULT_OFFERS_CONFIG,
          ...(storeData?.offersConfig || {})
        };

        setSettings(prev => ({
          ...prev,
          ...storeData,
          offersConfig: mergedOffersConfig
        }));
        setSavedSettings({
          ...storeData,
          offersConfig: mergedOffersConfig
        });

        if (Array.isArray(dbCategories) && dbCategories.length > 0) {
          const catNames = dbCategories.map(c => c.name || c.title || c.id).filter(Boolean);
          const combined = Array.from(new Set([...catNames, ...FALLBACK_CATEGORIES]));
          setAvailableCategories(combined);
        }
      } catch (err) {
        console.error('Error loading admin settings:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  // Offers configuration helpers
  const handleOffersToggle = (enabled) => {
    setSettings(prev => ({
      ...prev,
      offersConfig: {
        ...(prev.offersConfig || DEFAULT_OFFERS_CONFIG),
        enabled
      }
    }));
  };

  const handleOffersTitleChange = (title) => {
    setSettings(prev => ({
      ...prev,
      offersConfig: {
        ...(prev.offersConfig || DEFAULT_OFFERS_CONFIG),
        title
      }
    }));
  };

  const handleAllCategoriesToggle = (checked) => {
    setSettings(prev => ({
      ...prev,
      offersConfig: {
        ...(prev.offersConfig || DEFAULT_OFFERS_CONFIG),
        categories: checked ? ['all'] : []
      }
    }));
  };

  const handleCategorySelection = (categoryName) => {
    setSettings(prev => {
      const currentCats = (prev.offersConfig?.categories || ['all']).filter(c => c !== 'all' && c !== 'All');
      const isSelected = currentCats.some(c => c.toLowerCase() === categoryName.toLowerCase());
      const nextCats = isSelected
        ? currentCats.filter(c => c.toLowerCase() !== categoryName.toLowerCase())
        : [...currentCats, categoryName];

      return {
        ...prev,
        offersConfig: {
          ...(prev.offersConfig || DEFAULT_OFFERS_CONFIG),
          categories: nextCats.length === 0 ? ['all'] : nextCats
        }
      };
    });
  };

  const handleOfferItemChange = (index, field, value) => {
    setSettings(prev => {
      const currentItems = [...(prev.offersConfig?.items || DEFAULT_OFFERS_CONFIG.items)];
      currentItems[index] = {
        ...currentItems[index],
        [field]: value
      };
      return {
        ...prev,
        offersConfig: {
          ...(prev.offersConfig || DEFAULT_OFFERS_CONFIG),
          items: currentItems
        }
      };
    });
  };

  const handleAddOfferItem = () => {
    setSettings(prev => {
      const currentItems = [...(prev.offersConfig?.items || DEFAULT_OFFERS_CONFIG.items)];
      currentItems.push({
        id: `offer-${Date.now()}`,
        text: 'New special discount or promo offer',
        icon: 'discount',
        link: ''
      });
      return {
        ...prev,
        offersConfig: {
          ...(prev.offersConfig || DEFAULT_OFFERS_CONFIG),
          items: currentItems
        }
      };
    });
  };

  const handleRemoveOfferItem = (index) => {
    setSettings(prev => {
      const currentItems = [...(prev.offersConfig?.items || DEFAULT_OFFERS_CONFIG.items)];
      currentItems.splice(index, 1);
      return {
        ...prev,
        offersConfig: {
          ...(prev.offersConfig || DEFAULT_OFFERS_CONFIG),
          items: currentItems
        }
      };
    });
  };

  const handleResetOffers = () => {
    if (window.confirm('Reset all offers to default configuration?')) {
      setSettings(prev => ({
        ...prev,
        offersConfig: DEFAULT_OFFERS_CONFIG
      }));
      showToast('Offers reset to default format', 'info');
    }
  };

  const handleSave = async (e, customSettings = null) => {
    if (e && e.preventDefault) e.preventDefault();
    setSaving(true);
    const toSave = customSettings || settings;
    const previous = savedSettings ? { ...savedSettings } : { ...settings };

    // 1. Optimistic UI update
    showToast('Store settings saved successfully!', 'success');
    setSavedSettings(toSave);

    // 2. Background update
    try {
      await saveStoreSettings(toSave);
      try {
        sessionStorage.setItem('bo_offers_config', JSON.stringify(toSave.offersConfig));
      } catch {}
    } catch (err) {
      console.error('Failed to save store settings:', err);
      // 3. Rollback on failure
      setSettings(previous);
      setSavedSettings(previous);
      showToast(err.message || 'Failed to save store settings', 'error', 7000, {
        label: 'Retry',
        onClick: () => handleSave(null, toSave)
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading store settings...</div>;

  const currentOffersConfig = settings.offersConfig || DEFAULT_OFFERS_CONFIG;
  const isAllCategories = (currentOffersConfig.categories || ['all']).includes('all') || (currentOffersConfig.categories || []).length === 0;
  const selectedCategories = currentOffersConfig.categories || ['all'];

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

        {/* ─── OFFERS BOX CUSTOMIZATION ──────────────────────────────── */}
        <section className="admin-form-section offers-settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, padding: 0, border: 'none' }}>Product Page Offers Section</h3>
            <button
              type="button"
              onClick={handleResetOffers}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              ↺ Reset to Defaults
            </button>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', margin: 0 }}>
              <input 
                type="checkbox"
                checked={currentOffersConfig.enabled !== false}
                onChange={(e) => handleOffersToggle(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0f172a' }}
              />
              <div>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', display: 'block' }}>
                  Enable Offers Section on Product Pages
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Controls whether the "Offers For You" promo box appears on product detail pages.
                </span>
              </div>
            </label>
          </div>

          {currentOffersConfig.enabled !== false && (
            <>
              <div className="admin-form-group">
                <label>Offers Header Banner Text</label>
                <input 
                  type="text"
                  value={currentOffersConfig.title || 'OFFERS FOR YOU – SHOP MORE, SAVE MORE!'}
                  onChange={(e) => handleOffersTitleChange(e.target.value)}
                  placeholder="e.g. OFFERS FOR YOU – SHOP MORE, SAVE MORE!"
                />
              </div>

              {/* Category Visibility Selection */}
              <div className="admin-form-group" style={{ marginTop: '20px' }}>
                <label>Category Visibility</label>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '10px' }}>
                  Choose which product categories display this offers box.
                </span>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                    <input 
                      type="checkbox"
                      checked={isAllCategories}
                      onChange={(e) => handleAllCategoriesToggle(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#0f172a' }}
                    />
                    <span>Show on ALL Categories</span>
                  </label>
                </div>

                {!isAllCategories && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {availableCategories.map(cat => {
                      const isChecked = selectedCategories.some(c => c.toLowerCase() === cat.toLowerCase());
                      return (
                        <button
                          type="button"
                          key={cat}
                          onClick={() => handleCategorySelection(cat)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12.5px',
                            fontWeight: isChecked ? '700' : '500',
                            background: isChecked ? '#0f172a' : '#ffffff',
                            color: isChecked ? '#ffffff' : '#334155',
                            border: isChecked ? '1px solid #0f172a' : '1px solid #cbd5e1',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isChecked ? '✓ ' : '+ '}{cat}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Multiline Textarea for instant editing */}
              <div className="admin-form-group" style={{ marginTop: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Quick Edit All Offers (One offer per line)</label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Type or paste lines below</span>
                </div>
                <textarea
                  rows="4"
                  value={
                    Array.isArray(currentOffersConfig.items)
                      ? currentOffersConfig.items.map(i => typeof i === 'string' ? i : (i.text || '')).join('\n')
                      : ''
                  }
                  onChange={(e) => {
                    const lines = e.target.value.split('\n');
                    const newItems = lines.map((line, idx) => {
                      const existing = currentOffersConfig.items?.[idx];
                      const isWa = String(line).toLowerCase().includes('whatsapp');
                      return {
                        id: existing?.id || `offer-${idx + 1}`,
                        text: line,
                        icon: existing?.icon || (isWa ? 'whatsapp' : 'discount'),
                        link: existing?.link || (isWa ? 'https://wa.me/917737225825' : '')
                      };
                    });
                    setSettings(prev => ({
                      ...prev,
                      offersConfig: {
                        ...(prev.offersConfig || DEFAULT_OFFERS_CONFIG),
                        items: newItems
                      }
                    }));
                  }}
                  placeholder="Type each offer on a separate line"
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.5, padding: '12px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Offer Items Editor */}
              <div className="admin-form-group" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ margin: 0 }}>Fine-Tune Items & Icons ({currentOffersConfig.items?.length || 0})</label>
                  <button
                    type="button"
                    onClick={handleAddOfferItem}
                    style={{
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    + Add New Offer
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(currentOffersConfig.items || []).map((item, idx) => (
                    <div 
                      key={item.id || idx} 
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', width: '24px' }}>
                          #{idx + 1}
                        </span>

                        <select
                          value={item.icon || 'discount'}
                          onChange={(e) => handleOfferItemChange(idx, 'icon', e.target.value)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: '#f8fafc',
                            color: '#334155'
                          }}
                        >
                          <option value="discount">🏷️ Discount Badge</option>
                          <option value="whatsapp">💬 WhatsApp / Support</option>
                          <option value="shipping">🚚 Express Shipping</option>
                          <option value="star">✨ Star / Special</option>
                        </select>

                        <input 
                          type="text"
                          value={item.text || ''}
                          onChange={(e) => handleOfferItemChange(idx, 'text', e.target.value)}
                          placeholder="e.g. Buy 2 & Get Flat Rs. 300 OFF"
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px'
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveOfferItem(idx)}
                          style={{
                            background: '#fee2e2',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                          title="Delete offer"
                        >
                          ✕
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '34px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Optional Link / Action:</span>
                        <input 
                          type="text"
                          value={item.link || ''}
                          onChange={(e) => handleOfferItemChange(idx, 'link', e.target.value)}
                          placeholder="e.g. https://wa.me/917737225825 or leave empty"
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            borderRadius: '4px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                            color: '#475569'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
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
