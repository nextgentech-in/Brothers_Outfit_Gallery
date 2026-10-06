/**
 * Central Color Master for Brother's Outfit Gallery
 * Standardized color definitions for Indian & Western apparel.
 *
 * Each color contains:
 * - id: unique slug identifier (e.g. 'rani', 'navy-blue')
 * - name: official standardized color name (e.g. 'Rani', 'Navy Blue')
 * - slug: URL-friendly identifier
 * - hex: primary hex code
 * - aliases: alternative names / search keywords (e.g. 'rani pink', 'deep pink')
 * - active: whether available for selection
 * - displayOrder: ranking order in listings
 * - isFrequentlyUsed: prioritized in Quick Picks
 */

export const DEFAULT_COLOR_MASTER = [
  {
    id: 'black',
    name: 'Black',
    slug: 'black',
    hex: '#000000',
    aliases: ['jet black', 'pure black', 'matte black', 'noir', 'nero', 'dark black'],
    active: true,
    displayOrder: 1,
    isFrequentlyUsed: true,
    category: 'Neutrals'
  },
  {
    id: 'white',
    name: 'White',
    slug: 'white',
    hex: '#FFFFFF',
    aliases: ['pure white', 'snow white', 'crisp white', 'bright white', 'milky white'],
    active: true,
    displayOrder: 2,
    isFrequentlyUsed: true,
    category: 'Neutrals'
  },
  {
    id: 'navy-blue',
    name: 'Navy Blue',
    slug: 'navy-blue',
    hex: '#1F2A44',
    aliases: ['navy', 'dark blue', 'midnight blue', 'deep navy', 'marine blue', 'ink blue'],
    active: true,
    displayOrder: 3,
    isFrequentlyUsed: true,
    category: 'Blues'
  },
  {
    id: 'rani',
    name: 'Rani',
    slug: 'rani',
    hex: '#C41242',
    aliases: ['rani pink', 'deep pink', 'fuchsia', 'fuchsia pink', 'magenta', 'hot pink', 'dark pink'],
    active: true,
    displayOrder: 4,
    isFrequentlyUsed: true,
    category: 'Traditional & Festive'
  },
  {
    id: 'maroon',
    name: 'Maroon',
    slug: 'maroon',
    hex: '#800020',
    aliases: ['maron', 'dark red', 'deep red', 'blood red', 'crimson maroon', 'garnet'],
    active: true,
    displayOrder: 5,
    isFrequentlyUsed: true,
    category: 'Reds & Earthy'
  },
  {
    id: 'beige',
    name: 'Beige',
    slug: 'beige',
    hex: '#D6C3A1',
    aliases: ['sand', 'nude', 'cream beige', 'wheat', 'biscuit', 'oatmeal'],
    active: true,
    displayOrder: 6,
    isFrequentlyUsed: true,
    category: 'Earth & Neutrals'
  },
  {
    id: 'grey',
    name: 'Grey',
    slug: 'grey',
    hex: '#6B7280',
    aliases: ['gray', 'slate', 'ash grey', 'silver grey', 'medium grey', 'steel grey'],
    active: true,
    displayOrder: 7,
    isFrequentlyUsed: true,
    category: 'Neutrals'
  },
  {
    id: 'olive',
    name: 'Olive',
    slug: 'olive',
    hex: '#556B2F',
    aliases: ['olive green', 'military green', 'army green', 'mehendi', 'mehndi', 'moss green'],
    active: true,
    displayOrder: 8,
    isFrequentlyUsed: true,
    category: 'Greens'
  },
  {
    id: 'off-white',
    name: 'Off White',
    slug: 'off-white',
    hex: '#FAF9F6',
    aliases: ['cream', 'ivory', 'milk white', 'eggshell', 'vanilla', 'pearl white'],
    active: true,
    displayOrder: 9,
    isFrequentlyUsed: true,
    category: 'Neutrals'
  },
  {
    id: 'royal-blue',
    name: 'Royal Blue',
    slug: 'royal-blue',
    hex: '#1E40AF',
    aliases: ['blue', 'bright blue', 'cobalt blue', 'electric blue', 'classic blue'],
    active: true,
    displayOrder: 10,
    isFrequentlyUsed: false,
    category: 'Blues'
  },
  {
    id: 'sky-blue',
    name: 'Sky Blue',
    slug: 'sky-blue',
    hex: '#7DD3FC',
    aliases: ['light blue', 'powder blue', 'baby blue', 'ice blue', 'pastel blue'],
    active: true,
    displayOrder: 11,
    isFrequentlyUsed: false,
    category: 'Blues'
  },
  {
    id: 'wine',
    name: 'Wine',
    slug: 'wine',
    hex: '#58111A',
    aliases: ['burgundy', 'dark wine', 'merlot', 'berry', 'deep burgundy'],
    active: true,
    displayOrder: 12,
    isFrequentlyUsed: false,
    category: 'Reds & Earthy'
  },
  {
    id: 'bottle-green',
    name: 'Bottle Green',
    slug: 'bottle-green',
    hex: '#09472A',
    aliases: ['dark green', 'emerald green', 'forest green', 'pine green', 'deep green'],
    active: true,
    displayOrder: 13,
    isFrequentlyUsed: false,
    category: 'Greens'
  },
  {
    id: 'sage-green',
    name: 'Sage Green',
    slug: 'sage-green',
    hex: '#9CAEA9',
    aliases: ['sage', 'mint green', 'pista', 'light green', 'seafoam', 'pastel green'],
    active: true,
    displayOrder: 14,
    isFrequentlyUsed: false,
    category: 'Greens'
  },
  {
    id: 'khaki',
    name: 'Khaki',
    slug: 'khaki',
    hex: '#C3B091',
    aliases: ['kaki', 'chino', 'tan khaki', 'safari'],
    active: true,
    displayOrder: 15,
    isFrequentlyUsed: false,
    category: 'Earth & Neutrals'
  },
  {
    id: 'tan',
    name: 'Tan',
    slug: 'tan',
    hex: '#C19A6B',
    aliases: ['camel', 'caramel', 'light brown', 'cognac', 'leather tan'],
    active: true,
    displayOrder: 16,
    isFrequentlyUsed: false,
    category: 'Earth & Neutrals'
  },
  {
    id: 'brown',
    name: 'Brown',
    slug: 'brown',
    hex: '#5C4033',
    aliases: ['chocolate', 'dark brown', 'coffee', 'espresso', 'mocha'],
    active: true,
    displayOrder: 17,
    isFrequentlyUsed: false,
    category: 'Earth & Neutrals'
  },
  {
    id: 'charcoal',
    name: 'Charcoal Grey',
    slug: 'charcoal-grey',
    hex: '#374151',
    aliases: ['charcoal', 'dark grey', 'anthracite', 'graphite', 'gunmetal'],
    active: true,
    displayOrder: 18,
    isFrequentlyUsed: false,
    category: 'Neutrals'
  },
  {
    id: 'mustard',
    name: 'Mustard Yellow',
    slug: 'mustard-yellow',
    hex: '#D97706',
    aliases: ['mustard', 'haldi', 'ochre', 'dark yellow', 'golden yellow', 'yellow'],
    active: true,
    displayOrder: 19,
    isFrequentlyUsed: false,
    category: 'Traditional & Festive'
  },
  {
    id: 'rust',
    name: 'Rust',
    slug: 'rust',
    hex: '#B45309',
    aliases: ['terracotta', 'brick red', 'copper', 'burnt orange', 'earthen red'],
    active: true,
    displayOrder: 20,
    isFrequentlyUsed: false,
    category: 'Reds & Earthy'
  },
  {
    id: 'peach',
    name: 'Peach',
    slug: 'peach',
    hex: '#F87171',
    aliases: ['coral', 'salmon', 'apricot', 'light coral'],
    active: true,
    displayOrder: 21,
    isFrequentlyUsed: false,
    category: 'Pastels'
  },
  {
    id: 'lavender',
    name: 'Lavender',
    slug: 'lavender',
    hex: '#A78BFA',
    aliases: ['lilac', 'light purple', 'mauve', 'pastel purple', 'violet light'],
    active: true,
    displayOrder: 22,
    isFrequentlyUsed: false,
    category: 'Pastels'
  },
  {
    id: 'purple',
    name: 'Purple',
    slug: 'purple',
    hex: '#6B21A8',
    aliases: ['violet', 'deep purple', 'jamuni', 'eggplant', 'plum'],
    active: true,
    displayOrder: 23,
    isFrequentlyUsed: false,
    category: 'Traditional & Festive'
  },
  {
    id: 'teal',
    name: 'Teal',
    slug: 'teal',
    hex: '#0F766E',
    aliases: ['teal green', 'teal blue', 'turquoise', 'cyan', 'peacock blue'],
    active: true,
    displayOrder: 24,
    isFrequentlyUsed: false,
    category: 'Blues'
  },
  {
    id: 'red',
    name: 'Red',
    slug: 'red',
    hex: '#DC2626',
    aliases: ['bright red', 'scarlet', 'ruby', 'cherry red'],
    active: true,
    displayOrder: 25,
    isFrequentlyUsed: false,
    category: 'Reds & Earthy'
  },
  {
    id: 'pink',
    name: 'Pink',
    slug: 'pink',
    hex: '#F472B6',
    aliases: ['light pink', 'baby pink', 'blush pink', 'rose pink'],
    active: true,
    displayOrder: 26,
    isFrequentlyUsed: false,
    category: 'Pastels'
  },
  {
    id: 'orange',
    name: 'Orange',
    slug: 'orange',
    hex: '#EA580C',
    aliases: ['tangerine', 'kesar', 'saffron', 'bright orange'],
    active: true,
    displayOrder: 27,
    isFrequentlyUsed: false,
    category: 'Traditional & Festive'
  },
  {
    id: 'gold',
    name: 'Gold',
    slug: 'gold',
    hex: '#D4AF37',
    aliases: ['golden', 'metallic gold', 'zari gold', 'antique gold'],
    active: true,
    displayOrder: 28,
    isFrequentlyUsed: false,
    category: 'Traditional & Festive'
  }
];

const LOCAL_STORAGE_KEY_CUSTOM = 'brothers_admin_custom_colors';
const LOCAL_STORAGE_KEY_RECENT = 'brothers_admin_recent_colors';

/**
 * Load custom colors created by admin from localStorage
 */
export function getCustomColors() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_CUSTOM);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse custom colors from localStorage:', err);
    return [];
  }
}

/**
 * Save a new standardized custom color into localStorage
 */
export function saveCustomColor(colorObj) {
  if (!colorObj || !colorObj.name || !colorObj.hex) return null;
  const customColors = getCustomColors();
  const slug = colorObj.slug || colorObj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const id = colorObj.id || slug;

  const existingIdx = customColors.findIndex(c => c.id === id || c.name.toLowerCase() === colorObj.name.toLowerCase());
  const entry = {
    id,
    name: colorObj.name.trim(),
    slug,
    hex: colorObj.hex.trim().toUpperCase(),
    aliases: Array.isArray(colorObj.aliases) ? colorObj.aliases : [colorObj.name.toLowerCase()],
    active: true,
    displayOrder: 999,
    isFrequentlyUsed: false,
    isCustom: true
  };

  let updated;
  if (existingIdx >= 0) {
    customColors[existingIdx] = entry;
    updated = customColors;
  } else {
    updated = [...customColors, entry];
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOM, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save custom color to localStorage:', err);
  }

  recordRecentColor(entry.id);
  return entry;
}

/**
 * Get all active colors (Standard + Custom)
 */
export function getAllColors() {
  const custom = getCustomColors();
  return [...DEFAULT_COLOR_MASTER, ...custom];
}

/**
 * Record a color selection to recent history for personalized "Frequently Used"
 */
export function recordRecentColor(colorIdOrName) {
  if (typeof window === 'undefined' || !colorIdOrName) return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_RECENT);
    let recents = raw ? JSON.parse(raw) : [];
    const cleanId = String(colorIdOrName).toLowerCase().trim();
    recents = [cleanId, ...recents.filter(id => id !== cleanId)].slice(0, 8);
    localStorage.setItem(LOCAL_STORAGE_KEY_RECENT, JSON.stringify(recents));
  } catch (err) {
    console.warn('Failed to record recent color:', err);
  }
}

/**
 * Get frequently used / recent colors prioritized for 1-click access
 */
export function getFrequentlyUsedColors() {
  const all = getAllColors();
  const defaultFrequent = all.filter(c => c.isFrequentlyUsed);

  if (typeof window === 'undefined') return defaultFrequent;

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_RECENT);
    if (!raw) return defaultFrequent;
    const recentIds = JSON.parse(raw);

    const recentColors = [];
    recentIds.forEach(rId => {
      const match = all.find(c => c.id === rId || c.slug === rId || c.name.toLowerCase() === rId);
      if (match && !recentColors.some(x => x.id === match.id)) {
        recentColors.push(match);
      }
    });

    // Merge recent with defaults (up to 8 items total)
    const combined = [...recentColors];
    defaultFrequent.forEach(df => {
      if (!combined.some(x => x.id === df.id)) {
        combined.push(df);
      }
    });
    return combined.slice(0, 8);
  } catch {
    return defaultFrequent;
  }
}

/**
 * Search colors by name, slug, ID, or aliases (supports fuzzy/multi-word matching)
 */
export function searchColors(query) {
  const all = getAllColors();
  if (!query || !query.trim()) return all;

  const q = query.trim().toLowerCase();

  return all.filter(color => {
    // 1. Exact or substring match in name
    if (color.name.toLowerCase().includes(q)) return true;
    // 2. Slug or ID match
    if (color.id.toLowerCase().includes(q) || color.slug.toLowerCase().includes(q)) return true;
    // 3. Aliases match
    if (Array.isArray(color.aliases) && color.aliases.some(alias => alias.toLowerCase().includes(q) || q.includes(alias.toLowerCase()))) {
      return true;
    }
    // 4. Category match
    if (color.category && color.category.toLowerCase().includes(q)) return true;
    return false;
  });
}

/**
 * Normalize an arbitrary color (legacy string, object, or user input) to a standardized Color Master object
 *
 * Example:
 * 'rani pink' -> { id: 'rani', name: 'Rani', slug: 'rani', hex: '#C41242' }
 * 'dark blue' -> { id: 'navy-blue', name: 'Navy Blue', slug: 'navy-blue', hex: '#1F2A44' }
 * { name: 'White', hex: '#ffffff' } -> { id: 'white', name: 'White', slug: 'white', hex: '#FFFFFF' }
 */
export function normalizeToStandardColor(raw) {
  if (!raw) return null;

  const all = getAllColors();

  // If already a standard color object with id & hex
  if (typeof raw === 'object' && raw.name) {
    const rawName = String(raw.name).trim();
    const rawLower = rawName.toLowerCase();

    // Direct match by ID or exact name
    const directMatch = all.find(c => c.id === raw.id || c.name.toLowerCase() === rawLower);
    if (directMatch) {
      return {
        id: directMatch.id,
        name: directMatch.name,
        slug: directMatch.slug,
        hex: directMatch.hex
      };
    }

    // Match via alias
    const aliasMatch = all.find(c =>
      Array.isArray(c.aliases) && c.aliases.some(a => a.toLowerCase() === rawLower || rawLower.includes(a.toLowerCase()))
    );
    if (aliasMatch) {
      return {
        id: aliasMatch.id,
        name: aliasMatch.name,
        slug: aliasMatch.slug,
        hex: aliasMatch.hex
      };
    }

    // Preserve custom object with cleaned structure
    return {
      id: raw.id || rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      name: rawName,
      slug: raw.slug || rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      hex: raw.hex || '#6B7280'
    };
  }

  // If string
  if (typeof raw === 'string') {
    const cleanStr = raw.trim();
    const lower = cleanStr.toLowerCase();

    // Direct match
    const directMatch = all.find(c => c.id === lower || c.slug === lower || c.name.toLowerCase() === lower);
    if (directMatch) {
      return {
        id: directMatch.id,
        name: directMatch.name,
        slug: directMatch.slug,
        hex: directMatch.hex
      };
    }

    // Alias match
    const aliasMatch = all.find(c =>
      Array.isArray(c.aliases) && c.aliases.some(a => a.toLowerCase() === lower || lower.includes(a.toLowerCase()))
    );
    if (aliasMatch) {
      return {
        id: aliasMatch.id,
        name: aliasMatch.name,
        slug: aliasMatch.slug,
        hex: aliasMatch.hex
      };
    }

    // Fallback if not matched
    return {
      id: lower.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      name: cleanStr.charAt(0).toUpperCase() + cleanStr.slice(1),
      slug: lower.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      hex: '#6B7280'
    };
  }

  return null;
}
