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

export const saveHomepageConfig = async (config) => {
  homepageConfigCache = config;
  homepageConfigTimestamp = Date.now();
  try {
    localStorage.setItem('bo_homepage_config', JSON.stringify({ timestamp: Date.now(), data: config }));
  } catch {}
  const [{ doc, setDoc }, { db }] = await Promise.all([
    import('firebase/firestore'),
    import('../firebase/firebaseConfig')
  ]);
  await setDoc(doc(db, 'settings', 'homepage'), config, { merge: true });
};
