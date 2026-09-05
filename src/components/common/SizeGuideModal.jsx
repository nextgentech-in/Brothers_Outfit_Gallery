import React, { useState, useEffect, useMemo } from 'react';
import './SizeGuideModal.css';

// Master sizing data for all categories
const SIZE_CHARTS = {
  shirts: {
    title: 'Shirts & T-Shirts',
    subtitle: 'Standard Indian apparel measurements for regular and oversized fits',
    icon: '👕',
    columns: ['Size', 'Chest', 'Length', 'Shoulder', 'Sleeve'],
    data: [
      { size: 'XS', chestIn: 36, chestCm: 91.4, lengthIn: 27, lengthCm: 68.6, shoulderIn: 16.5, shoulderCm: 41.9, sleeveIn: 8, sleeveCm: 20.3 },
      { size: 'S', chestIn: 38, chestCm: 96.5, lengthIn: 28, lengthCm: 71.1, shoulderIn: 17, shoulderCm: 43.2, sleeveIn: 8.5, sleeveCm: 21.6 },
      { size: 'M', chestIn: 40, chestCm: 101.6, lengthIn: 29, lengthCm: 73.7, shoulderIn: 18, shoulderCm: 45.7, sleeveIn: 9, sleeveCm: 22.9 },
      { size: 'L', chestIn: 42, chestCm: 106.7, lengthIn: 30, lengthCm: 76.2, shoulderIn: 19, shoulderCm: 48.3, sleeveIn: 9.5, sleeveCm: 24.1 },
      { size: 'XL', chestIn: 44, chestCm: 111.8, lengthIn: 31, lengthCm: 78.7, shoulderIn: 20, shoulderCm: 50.8, sleeveIn: 10, sleeveCm: 25.4 },
      { size: 'XXL', chestIn: 46, chestCm: 116.8, lengthIn: 31.5, lengthCm: 80.0, shoulderIn: 21, shoulderCm: 53.3, sleeveIn: 10.5, sleeveCm: 26.7 },
      { size: '3XL', chestIn: 48, chestCm: 121.9, lengthIn: 32, lengthCm: 81.3, shoulderIn: 22, shoulderCm: 55.9, sleeveIn: 11, sleeveCm: 27.9 },
    ],
    fitTip: '💡 For an Oversized / Drop-Shoulder aesthetic, order one size up. For a tailored slim look, order your standard size.'
  },
  jeans: {
    title: 'Jeans & Trousers',
    subtitle: 'Waist and length measurements across standard Indian sizes',
    icon: '👖',
    columns: ['Size', 'Waist', 'Hip', 'Inseam', 'Length', 'Thigh'],
    data: [
      { size: '28', waistIn: 28, waistCm: 71.1, hipIn: 36, hipCm: 91.4, inseamIn: 30, inseamCm: 76.2, lengthIn: 40, lengthCm: 101.6, thighIn: 22, thighCm: 55.9 },
      { size: '30', waistIn: 30, waistCm: 76.2, hipIn: 38, hipCm: 96.5, inseamIn: 31, inseamCm: 78.7, lengthIn: 41, lengthCm: 104.1, thighIn: 23, thighCm: 58.4 },
      { size: '32', waistIn: 32, waistCm: 81.3, hipIn: 40, hipCm: 101.6, inseamIn: 32, inseamCm: 81.3, lengthIn: 42, lengthCm: 106.7, thighIn: 24, thighCm: 61.0 },
      { size: '34', waistIn: 34, waistCm: 86.4, hipIn: 42, hipCm: 106.7, inseamIn: 32, inseamCm: 81.3, lengthIn: 42, lengthCm: 106.7, thighIn: 25, thighCm: 63.5 },
      { size: '36', waistIn: 36, waistCm: 91.4, hipIn: 44, hipCm: 111.8, inseamIn: 32, inseamCm: 81.3, lengthIn: 42, lengthCm: 106.7, thighIn: 26, thighCm: 66.0 },
      { size: '38', waistIn: 38, waistCm: 96.5, hipIn: 46, hipCm: 116.8, inseamIn: 32, inseamCm: 81.3, lengthIn: 42.5, lengthCm: 108.0, thighIn: 27, thighCm: 68.6 },
      { size: '40', waistIn: 40, waistCm: 101.6, hipIn: 48, hipCm: 121.9, inseamIn: 32, inseamCm: 81.3, lengthIn: 43, lengthCm: 109.2, thighIn: 28, thighCm: 71.1 },
      { size: '42', waistIn: 42, waistCm: 106.7, hipIn: 50, hipCm: 127.0, inseamIn: 32, inseamCm: 81.3, lengthIn: 43, lengthCm: 109.2, thighIn: 29, thighCm: 73.7 }
    ],
    fitTip: '💡 Measure your waist at the point where you naturally wear your trousers or jeans.'
  },
  jackets: {
    title: 'Jackets & Hoodies',
    subtitle: 'Outerwear sizing designed for layering over t-shirts and shirts',
    icon: '🧥',
    columns: ['Size', 'Chest', 'Length', 'Shoulder', 'Sleeve'],
    data: [
      { size: 'S', chestIn: 40, chestCm: 101.6, lengthIn: 26.5, lengthCm: 67.3, shoulderIn: 17.5, shoulderCm: 44.5, sleeveIn: 24.5, sleeveCm: 62.2 },
      { size: 'M', chestIn: 42, chestCm: 106.7, lengthIn: 27.5, lengthCm: 69.9, shoulderIn: 18.5, shoulderCm: 47.0, sleeveIn: 25, sleeveCm: 63.5 },
      { size: 'L', chestIn: 44, chestCm: 111.8, lengthIn: 28.5, lengthCm: 72.4, shoulderIn: 19.5, shoulderCm: 49.5, sleeveIn: 25.5, sleeveCm: 64.8 },
      { size: 'XL', chestIn: 46, chestCm: 116.8, lengthIn: 29.5, lengthCm: 74.9, shoulderIn: 20.5, shoulderCm: 52.1, sleeveIn: 26, sleeveCm: 66.0 },
      { size: 'XXL', chestIn: 48, chestCm: 121.9, lengthIn: 30.5, lengthCm: 77.5, shoulderIn: 21.5, shoulderCm: 54.6, sleeveIn: 26.5, sleeveCm: 67.3 },
      { size: '3XL', chestIn: 50, chestCm: 127.0, lengthIn: 31, lengthCm: 78.7, shoulderIn: 22.5, shoulderCm: 57.2, sleeveIn: 27, sleeveCm: 68.6 }
    ],
    fitTip: '💡 Jackets and hoodies feature extra ease around the chest to allow comfortable layering.'
  },
  footwear: {
    title: 'Footwear & Slippers',
    subtitle: 'Indian / UK standard shoe sizing with conversion to US & EU',
    icon: '🩴',
    columns: ['UK / IND Size', 'US Size', 'EU Size', 'Foot Length (CM)', 'Foot Length (IN)'],
    data: [
      { size: 'UK 6', us: 'US 7', eu: 'EU 40', lengthCm: 24.5, lengthIn: 9.6 },
      { size: 'UK 7', us: 'US 8', eu: 'EU 41', lengthCm: 25.4, lengthIn: 10.0 },
      { size: 'UK 8', us: 'US 9', eu: 'EU 42', lengthCm: 26.2, lengthIn: 10.3 },
      { size: 'UK 9', us: 'US 10', eu: 'EU 43', lengthCm: 27.1, lengthIn: 10.6 },
      { size: 'UK 10', us: 'US 11', eu: 'EU 44', lengthCm: 27.9, lengthIn: 11.0 },
      { size: 'UK 11', us: 'US 12', eu: 'EU 45', lengthCm: 28.8, lengthIn: 11.3 },
      { size: 'UK 12', us: 'US 13', eu: 'EU 46', lengthCm: 29.6, lengthIn: 11.6 }
    ],
    fitTip: '💡 Step firmly on a white paper, mark your heel and longest toe with a pen, and measure the distance in cm.'
  },
  perfumes: {
    title: 'Perfume Volume & Longevity Guide',
    subtitle: 'Understand bottle capacities, number of sprays, and fragrance duration',
    icon: '🧴',
    isPerfume: true,
    tiers: [
      { volume: '10ml', sprays: '~120 Sprays', duration: '2 - 3 Weeks', bestFor: 'Pocket spray, gym bag, travel & trial scent', badge: 'TRAVEL / POCKET' },
      { volume: '20ml', sprays: '~240 Sprays', duration: '1 Month', bestFor: 'Compact spray, quick refresh anywhere', badge: 'COMPACT' },
      { volume: '30ml', sprays: '~360 Sprays', duration: '1 - 2 Months', bestFor: 'Daily carry, rotation perfume', badge: 'PORTABLE' },
      { volume: '50ml', sprays: '~600 Sprays', duration: '3 - 4 Months', bestFor: 'Daily signature scent, work & university wear', badge: 'POPULAR' },
      { volume: '75ml', sprays: '~900 Sprays', duration: '4 - 5 Months', bestFor: 'Mid-size favorite bottle', badge: 'BALANCED' },
      { volume: '100ml', sprays: '~1,200 Sprays', duration: '6 - 8 Months', bestFor: 'Full-size flagship bottle, best price per ml', badge: 'BEST VALUE' },
      { volume: '150ml', sprays: '~1,800 Sprays', duration: '9 - 10 Months', bestFor: 'Heavy daily users', badge: 'EXTENDED' },
      { volume: '200ml', sprays: '~2,400 Sprays', duration: '12+ Months', bestFor: 'All-season signature aroma', badge: 'JUMBO' },
    ],
    applicationTips: [
      { title: 'Pulse Points', desc: 'Apply to pulse points where blood flows closest to the skin: wrists, neck, collarbones, and behind the ears for maximum sillage.' },
      { title: 'Concentration', desc: 'Brothers Outfit fragrances are crafted as Eau de Parfum (EDP) with 18-22% perfume oils, delivering 8 to 12 hours of projection.' },
      { title: 'Longevity Trick', desc: 'Hydrate your skin with an unscented moisturizer before applying fragrance; moisturized skin holds scent molecules twice as long.' }
    ]
  },
  accessories: {
    title: 'Belts & Accessories Guide',
    subtitle: 'Quick guidelines for belts, wallets, and standard accessories',
    icon: '🧣',
    isAccessory: true,
    beltData: [
      { pantWaist: '28" - 30"', recommendedBelt: '32', range: '28 - 32' },
      { pantWaist: '32" - 34"', recommendedBelt: '36', range: '32 - 36' },
      { pantWaist: '36" - 38"', recommendedBelt: '40', range: '36 - 40' },
      { pantWaist: '40" - 42"', recommendedBelt: '44', range: '40 - 44' },
    ],
    fitTip: '💡 Rule of thumb for belts: Order 2 inches larger than your current trouser waist size.'
  }
};

export default function SizeGuideModal({ isOpen, onClose, category = 'Shirts', onSelectSize }) {
  // Determine initial tab based on product category
  const detectCategoryTab = (cat) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('perfume') || c.includes('fragrance')) return 'perfumes';
    if (c.includes('jean') || c.includes('trouser') || c.includes('pant')) return 'jeans';
    if (c.includes('jacket') || c.includes('hoodie')) return 'jackets';
    if (c.includes('slipper') || c.includes('shoe') || c.includes('footwear')) return 'footwear';
    if (c.includes('belt') || c.includes('wallet') || c.includes('accessory') || c.includes('accessories')) return 'accessories';
    return 'shirts';
  };

  const [userSelectedTab, setUserSelectedTab] = useState(null);
  const activeTab = userSelectedTab || detectCategoryTab(category);
  const setActiveTab = (tab) => setUserSelectedTab(tab);

  const [unit, setUnit] = useState('in'); // 'in' or 'cm'
  const [measurementInput, setMeasurementInput] = useState('');
  const [fitPreference, setFitPreference] = useState('regular'); // 'slim', 'regular', 'relaxed'

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const currentChart = SIZE_CHARTS[activeTab] || SIZE_CHARTS.shirts;

  // Fit Finder Recommendation Engine
  const recommendation = useMemo(() => {
    const val = parseFloat(measurementInput);
    if (!val || isNaN(val) || val <= 0) return null;

    if (activeTab === 'shirts' || activeTab === 'jackets') {
      const chestInches = unit === 'cm' ? (val / 2.54) : val;
      let targetInches = chestInches;
      if (fitPreference === 'slim') targetInches -= 1;
      if (fitPreference === 'relaxed') targetInches += 2;

      const chart = SIZE_CHARTS[activeTab];
      const match = chart.data.find(row => row.chestIn >= targetInches) || chart.data[chart.data.length - 1];
      return {
        size: match.size,
        text: `Based on your ${val} ${unit.toUpperCase()} chest measurement (${fitPreference} fit):`,
        recommendedSize: match.size
      };
    }

    if (activeTab === 'jeans') {
      const waistInches = unit === 'cm' ? Math.round(val / 2.54) : Math.round(val);
      const chart = SIZE_CHARTS.jeans;
      const match = chart.data.find(row => row.waistIn >= waistInches) || chart.data[chart.data.length - 1];
      return {
        size: match.size,
        text: `Based on your ${val} ${unit.toUpperCase()} waist measurement:`,
        recommendedSize: match.size
      };
    }

    if (activeTab === 'footwear') {
      const lengthCm = unit === 'in' ? (val * 2.54) : val;
      const match = SIZE_CHARTS.footwear.data.find(row => row.lengthCm >= lengthCm) || SIZE_CHARTS.footwear.data[SIZE_CHARTS.footwear.data.length - 1];
      return {
        size: match.size,
        text: `Based on your ${val} ${unit.toUpperCase()} foot length:`,
        recommendedSize: match.size
      };
    }

    return null;
  }, [measurementInput, activeTab, unit, fitPreference]);

  if (!isOpen) return null;

  return (
    <div className="size-guide-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Size Guide">
      <div className="size-guide-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="size-guide-header">
          <div className="size-guide-title-wrap">
            <h2 className="size-guide-title">
              <span className="size-guide-icon">{currentChart.icon}</span>
              {currentChart.title}
            </h2>
            <p className="size-guide-subtitle">{currentChart.subtitle}</p>
          </div>
          <button className="size-guide-close-btn" onClick={onClose} aria-label="Close size guide">
            ✕
          </button>
        </div>

        {/* Category Tabs */}
        <div className="size-guide-tabs">
          <button 
            type="button"
            className={`size-tab ${activeTab === 'shirts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shirts')}
          >
            👕 Shirts / T-Shirts
          </button>
          <button 
            type="button"
            className={`size-tab ${activeTab === 'jeans' ? 'active' : ''}`}
            onClick={() => setActiveTab('jeans')}
          >
            👖 Jeans / Pants
          </button>
          <button 
            type="button"
            className={`size-tab ${activeTab === 'jackets' ? 'active' : ''}`}
            onClick={() => setActiveTab('jackets')}
          >
            🧥 Jackets / Hoodies
          </button>
          <button 
            type="button"
            className={`size-tab ${activeTab === 'footwear' ? 'active' : ''}`}
            onClick={() => setActiveTab('footwear')}
          >
            🩴 Footwear
          </button>
          <button 
            type="button"
            className={`size-tab ${activeTab === 'perfumes' ? 'active' : ''}`}
            onClick={() => setActiveTab('perfumes')}
          >
            🧴 Perfume Volumes
          </button>
          <button 
            type="button"
            className={`size-tab ${activeTab === 'accessories' ? 'active' : ''}`}
            onClick={() => setActiveTab('accessories')}
          >
            🧣 Belts & More
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="size-guide-body">
          
          {/* Section 1: Apparel / Footwear Tables */}
          {!currentChart.isPerfume && !currentChart.isAccessory && (
            <>
              {/* Controls Bar: Unit Switcher & Fit Tip */}
              <div className="size-guide-controls">
                <div className="unit-toggle-group">
                  <span className="unit-label">Unit of Measure:</span>
                  <div className="unit-buttons">
                    <button 
                      type="button"
                      className={`unit-btn ${unit === 'in' ? 'active' : ''}`}
                      onClick={() => setUnit('in')}
                    >
                      Inches (in)
                    </button>
                    <button 
                      type="button"
                      className={`unit-btn ${unit === 'cm' ? 'active' : ''}`}
                      onClick={() => setUnit('cm')}
                    >
                      Centimeters (cm)
                    </button>
                  </div>
                </div>

                {currentChart.fitTip && (
                  <div className="size-guide-fit-tip">
                    {currentChart.fitTip}
                  </div>
                )}
              </div>

              {/* Interactive Fit Finder / Recommender Tool */}
              <div className="fit-finder-box">
                <div className="fit-finder-header">
                  <span className="fit-finder-title">🎯 Instant Fit Finder</span>
                  <span className="fit-finder-sub">Enter your measurement to find your perfect size</span>
                </div>

                <div className="fit-finder-inputs">
                  <div className="fit-input-field">
                    <label>
                      {activeTab === 'jeans' ? `Your Waist (${unit.toUpperCase()})` : activeTab === 'footwear' ? `Foot Length (${unit.toUpperCase()})` : `Chest Size (${unit.toUpperCase()})`}:
                    </label>
                    <input 
                      type="number"
                      placeholder={activeTab === 'jeans' ? (unit === 'in' ? 'e.g. 32' : 'e.g. 81') : activeTab === 'footwear' ? (unit === 'in' ? 'e.g. 10.3' : 'e.g. 26.2') : (unit === 'in' ? 'e.g. 40' : 'e.g. 102')}
                      value={measurementInput}
                      onChange={(e) => setMeasurementInput(e.target.value)}
                    />
                  </div>

                  {(activeTab === 'shirts' || activeTab === 'jackets') && (
                    <div className="fit-input-field">
                      <label>Preferred Fit:</label>
                      <select value={fitPreference} onChange={(e) => setFitPreference(e.target.value)}>
                        <option value="slim">Tailored / Slim Fit</option>
                        <option value="regular">Regular Comfortable Fit</option>
                        <option value="relaxed">Relaxed / Oversized Fit</option>
                      </select>
                    </div>
                  )}
                </div>

                {recommendation && (
                  <div className="fit-recommendation-result">
                    <span>{recommendation.text}</span>
                    <strong className="recommendation-badge">{recommendation.recommendedSize}</strong>
                    {onSelectSize && (
                      <button 
                        type="button"
                        className="btn-apply-recommended-size"
                        onClick={() => {
                          onSelectSize(recommendation.recommendedSize);
                          onClose();
                        }}
                      >
                        Select Size {recommendation.recommendedSize}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Data Table */}
              <div className="size-table-container">
                <table className="size-guide-table">
                  <thead>
                    <tr>
                      {currentChart.columns.map((col, idx) => (
                        <th key={idx}>{col}</th>
                      ))}
                      {onSelectSize && <th style={{ textAlign: 'center' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === 'footwear' ? (
                      currentChart.data.map((row) => (
                        <tr key={row.size} className={recommendation?.recommendedSize === row.size ? 'highlighted-row' : ''}>
                          <td><strong>{row.size}</strong></td>
                          <td>{row.us}</td>
                          <td>{row.eu}</td>
                          <td>{row.lengthCm} cm</td>
                          <td>{row.lengthIn} in</td>
                          {onSelectSize && (
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                type="button"
                                className="btn-choose-size-row"
                                onClick={() => { onSelectSize(row.size); onClose(); }}
                              >
                                Pick {row.size}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : activeTab === 'jeans' ? (
                      currentChart.data.map((row) => (
                        <tr key={row.size} className={recommendation?.recommendedSize === row.size ? 'highlighted-row' : ''}>
                          <td><strong>{row.size}</strong></td>
                          <td>{unit === 'in' ? `${row.waistIn}"` : `${row.waistCm} cm`}</td>
                          <td>{unit === 'in' ? `${row.hipIn}"` : `${row.hipCm} cm`}</td>
                          <td>{unit === 'in' ? `${row.inseamIn}"` : `${row.inseamCm} cm`}</td>
                          <td>{unit === 'in' ? `${row.lengthIn}"` : `${row.lengthCm} cm`}</td>
                          <td>{unit === 'in' ? `${row.thighIn}"` : `${row.thighCm} cm`}</td>
                          {onSelectSize && (
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                type="button"
                                className="btn-choose-size-row"
                                onClick={() => { onSelectSize(row.size); onClose(); }}
                              >
                                Pick {row.size}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      currentChart.data.map((row) => (
                        <tr key={row.size} className={recommendation?.recommendedSize === row.size ? 'highlighted-row' : ''}>
                          <td><strong>{row.size}</strong></td>
                          <td>{unit === 'in' ? `${row.chestIn}"` : `${row.chestCm} cm`}</td>
                          <td>{unit === 'in' ? `${row.lengthIn}"` : `${row.lengthCm} cm`}</td>
                          <td>{unit === 'in' ? `${row.shoulderIn}"` : `${row.shoulderCm} cm`}</td>
                          <td>{unit === 'in' ? `${row.sleeveIn}"` : `${row.sleeveCm} cm`}</td>
                          {onSelectSize && (
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                type="button"
                                className="btn-choose-size-row"
                                onClick={() => { onSelectSize(row.size); onClose(); }}
                              >
                                Pick {row.size}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* How to Measure Section */}
              <div className="how-to-measure-section">
                <h4 className="how-to-measure-title">📏 How to Measure Yourself Accurately</h4>
                <div className="measure-grid">
                  <div className="measure-card">
                    <span className="measure-num">1</span>
                    <div>
                      <strong>Chest:</strong>
                      <p>Wrap the tape measure around the fullest part of your chest, right beneath the armpits. Keep the tape straight and snug without pulling tight.</p>
                    </div>
                  </div>
                  <div className="measure-card">
                    <span className="measure-num">2</span>
                    <div>
                      <strong>Waist:</strong>
                      <p>Measure around your natural waistline, where your trousers or jeans comfortably sit. Keep one finger between your body and the tape.</p>
                    </div>
                  </div>
                  <div className="measure-card">
                    <span className="measure-num">3</span>
                    <div>
                      <strong>Shoulder:</strong>
                      <p>Measure across the back from the tip of one shoulder bone straight to the tip of the other.</p>
                    </div>
                  </div>
                  <div className="measure-card">
                    <span className="measure-num">4</span>
                    <div>
                      <strong>Length:</strong>
                      <p>Measure from the highest point of your shoulder seam near the collar down to the bottom hem of the garment.</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Section 2: Perfumes Volume Guide */}
          {currentChart.isPerfume && (
            <div className="perfume-guide-section">
              <div className="perfume-tiers-grid">
                {currentChart.tiers.map((t, idx) => (
                  <div key={idx} className="perfume-tier-card">
                    <div className="perfume-tier-header">
                      <span className="perfume-vol">{t.volume}</span>
                      <span className="perfume-badge">{t.badge}</span>
                    </div>
                    <div className="perfume-stats">
                      <div className="perfume-stat-item">
                        <span className="stat-label">Spray Count</span>
                        <strong className="stat-value">{t.sprays}</strong>
                      </div>
                      <div className="perfume-stat-item">
                        <span className="stat-label">Estimated Duration</span>
                        <strong className="stat-value">{t.duration}</strong>
                      </div>
                    </div>
                    <p className="perfume-desc">{t.bestFor}</p>
                    {onSelectSize && (
                      <button 
                        type="button"
                        className="btn-choose-size-row full-width"
                        onClick={() => { onSelectSize(t.volume); onClose(); }}
                      >
                        Choose {t.volume}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Fragrance Longevity & Projection Advice */}
              <div className="perfume-tips-box">
                <h4>✨ Fragrance Tips from Brothers Outfit Master Perfumers</h4>
                <div className="perfume-tips-grid">
                  {currentChart.applicationTips.map((tip, idx) => (
                    <div key={idx} className="perfume-tip-item">
                      <strong>{tip.title}</strong>
                      <p>{tip.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Accessories & Belts Guide */}
          {currentChart.isAccessory && (
            <div className="accessory-guide-section">
              <div className="size-guide-fit-tip" style={{ marginBottom: '20px' }}>
                {currentChart.fitTip}
              </div>

              <div className="size-table-container">
                <table className="size-guide-table">
                  <thead>
                    <tr>
                      <th>Trouser / Pant Waist</th>
                      <th>Recommended Belt Size</th>
                      <th>Belt Buckle Adjustment Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentChart.beltData.map((b, idx) => (
                      <tr key={idx}>
                        <td><strong>{b.pantWaist}</strong></td>
                        <td><strong style={{ color: '#0f172a' }}>{b.recommendedBelt}</strong></td>
                        <td>{b.range} inches</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="accessory-faq">
                <h4>👜 Wallets & Everyday Carry (EDC)</h4>
                <p>All Brothers Outfit genuine leather wallets are crafted with RFID blocking and calibrated to comfortably fit Indian currency notes (₹500, ₹200, ₹100) and up to 8 cards without excessive pocket bulk.</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="size-guide-footer">
          <span className="size-guide-guarantee">
            🔄 <strong>100% Fit Guarantee:</strong> Hassle-free 7-day size exchanges available on all unworn items.
          </span>
          <button type="button" className="size-guide-btn-done" onClick={onClose}>
            Got It
          </button>
        </div>

      </div>
    </div>
  );
}
