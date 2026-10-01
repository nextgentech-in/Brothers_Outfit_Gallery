let homepageConfigCache = null;
let homepageConfigTimestamp = 0;

export const getHomepageConfig = async () => {
  const now = Date.now();
  if (homepageConfigCache && (now - homepageConfigTimestamp < 5 * 60 * 1000)) {
    return homepageConfigCache;
  }
  try {
    const raw = localStorage.getItem('bo_homepage_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.timestamp && (now - parsed.timestamp < 5 * 60 * 1000) && parsed.data) {
        homepageConfigCache = parsed.data;
        homepageConfigTimestamp = parsed.timestamp;
        return homepageConfigCache;
      }
    }
  } catch {}

  try {
    const [{ doc, getDoc }, { db }] = await Promise.all([
      import('firebase/firestore'),
      import('../firebase/firebaseConfig')
    ]);
    const snap = await getDoc(doc(db, 'settings', 'homepage'));
    const config = snap.exists() ? snap.data() : {
      showHero: true,
      showTrending: true,
      showSaleSection: true,
      showNewArrivals: true,
      showShopCollection: true,
      showAboutPreview: true,
      showTrustBadges: true,
      showReviews: true
    };
    homepageConfigCache = config;
    homepageConfigTimestamp = now;
    try {
      localStorage.setItem('bo_homepage_config', JSON.stringify({ timestamp: now, data: config }));
    } catch {}
    return config;
  } catch (_err) {
    return homepageConfigCache || {};
  }
};

export const sanitizeHomepageConfig = (raw) => {
  if (!raw || typeof raw !== 'object') return {};

  const clean = {
    showHero: raw.showHero !== false,
    showShopCategory: raw.showShopCategory !== false,
    showTrending: raw.showTrending !== false,
    showSaleSection: raw.showSaleSection !== false,
    showNewArrivals: raw.showNewArrivals !== false,
    showShopCollection: raw.showShopCollection !== false,
    showAboutPreview: raw.showAboutPreview !== false,
    showTrustBadges: raw.showTrustBadges !== false,
    showReviews: raw.showReviews !== false,
  };

  // Clean hero fields
  if (raw.hero && typeof raw.hero === 'object') {
    clean.hero = {
      bannerImage: typeof raw.hero.bannerImage === 'string' ? raw.hero.bannerImage : '/images/brothers-storefront.jpg',
      mobileBannerImage: typeof raw.hero.mobileBannerImage === 'string' ? raw.hero.mobileBannerImage : '',
      eyebrow: typeof raw.hero.eyebrow === 'string' ? raw.hero.eyebrow : '',
      heading: typeof raw.hero.heading === 'string' ? raw.hero.heading : 'DEFINE YOUR\nEVERYDAY STYLE',
      description: typeof raw.hero.description === 'string' ? raw.hero.description : '',
      saleButtonText: typeof raw.hero.saleButtonText === 'string' ? raw.hero.saleButtonText : 'Season Sale — Up to 50% Off',
      saleButtonLink: typeof raw.hero.saleButtonLink === 'string' ? raw.hero.saleButtonLink : '/sale',
      primaryButtonText: typeof raw.hero.primaryButtonText === 'string' ? raw.hero.primaryButtonText : 'Explore Catalog',
      primaryButtonLink: typeof raw.hero.primaryButtonLink === 'string' ? raw.hero.primaryButtonLink : '/shop',
      overlayOpacity: typeof raw.hero.overlayOpacity === 'number' ? raw.hero.overlayOpacity : 0.55
    };
  }

  // Clean trending fields
  if (raw.trending && typeof raw.trending === 'object') {
    clean.trending = {
      label: typeof raw.trending.label === 'string' ? raw.trending.label : 'CURATED FOR YOU',
      title: typeof raw.trending.title === 'string' ? raw.trending.title : 'TRENDING NOW',
      subtitle: typeof raw.trending.subtitle === 'string' ? raw.trending.subtitle : ''
    };
  }

  // Clean categoryImages map: strictly sanitize keys and ensure values are valid string URLs only
  const cleanCategoryImages = {};
  if (raw.categoryImages && typeof raw.categoryImages === 'object') {
    for (const [key, val] of Object.entries(raw.categoryImages)) {
      if (!key || typeof key !== 'string') continue;
      // Strip forbidden Firestore map key characters like dots, slashes, brackets, tildes
      const safeKey = key.trim().replace(/[./\\~*[\]]/g, '_');
      if (!safeKey) continue;

      let urlStr = '';
      if (typeof val === 'string') {
        urlStr = val.trim();
      } else if (val && typeof val === 'object' && typeof val.url === 'string') {
        urlStr = val.url.trim();
      }

      // Only save if it's a valid string URL
      if (urlStr && (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('/images/'))) {
        cleanCategoryImages[safeKey] = urlStr;
      } else if (urlStr && urlStr.startsWith('data:image/')) {
        // Prevent Firestore 1MB entity overflow by capping base64 length
        if (urlStr.length < 250000) {
          cleanCategoryImages[safeKey] = urlStr;
        }
      }
    }
  }
  clean.categoryImages = cleanCategoryImages;
  clean.categoryUploadFolder = typeof raw.categoryUploadFolder === 'string' && raw.categoryUploadFolder.trim()
    ? raw.categoryUploadFolder.trim()
    : 'categories';

  return clean;
};

export const saveHomepageConfig = async (rawConfig) => {
  const config = sanitizeHomepageConfig(rawConfig);
  homepageConfigCache = config;
  homepageConfigTimestamp = Date.now();
  try {
    localStorage.setItem('bo_homepage_config', JSON.stringify({ timestamp: Date.now(), data: config }));
  } catch {}

  const [{ doc, setDoc }, { db }] = await Promise.all([
    import('firebase/firestore'),
    import('../firebase/firebaseConfig')
  ]);
  // Set document directly to overwrite and fix any previous invalid nested entities in Firestore
  try {
    await setDoc(doc(db, 'settings', 'homepage'), config);
  } catch (err) {
    console.warn("Direct overwrite failed, falling back to merge:", err);
    await setDoc(doc(db, 'settings', 'homepage'), config, { merge: true });
  }
  return config;
};
