import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GARMENTS, GarmentView } from './GarmentDiagrams';
import './SizeGuideModal.css';

// Cleanly convert any custom size guide value (single number, decimals, ranges, or labels)
export const convertMeasurementValue = (val, fromUnit, toUnit) => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';
  if (fromUnit === toUnit) return str;

  // Handle range format e.g. "38-40", "38 - 40", "38 to 40"
  const rangeMatch = str.match(/^([\d.]+)\s*(?:-|to)\s*([\d.]+)(.*)$/i);
  if (rangeMatch) {
    const num1 = parseFloat(rangeMatch[1]);
    const num2 = parseFloat(rangeMatch[2]);
    if (!isNaN(num1) && !isNaN(num2)) {
      const conv1 = fromUnit === 'in' && toUnit === 'cm' ? num1 * 2.54 : num1 / 2.54;
      const conv2 = fromUnit === 'in' && toUnit === 'cm' ? num2 * 2.54 : num2 / 2.54;
      const r1 = Math.round(conv1 * 10) / 10;
      const r2 = Math.round(conv2 * 10) / 10;
      return `${r1} - ${r2}`;
    }
  }

  // Handle single number e.g. "38", "38.5", "38\"", "38 in", "96.5 cm"
  const singleMatch = str.match(/^([\d.]+)/);
  if (singleMatch) {
    const num = parseFloat(singleMatch[1]);
    if (!isNaN(num)) {
      const converted = fromUnit === 'in' && toUnit === 'cm' ? num * 2.54 : num / 2.54;
      const rounded = Math.round(converted * 10) / 10;
      return String(rounded);
    }
  }

  // Non-numeric text (e.g. "S", "M", "Free", "-"): preserve as is
  return str;
};

// Convert column header unit label dynamically (e.g. Chest (in) -> Chest (cm))
export const convertColumnHeader = (colName, activeUnit) => {
  if (!colName || typeof colName !== 'string') return colName;
  const trimmed = colName.trim();
  // Don't modify Size / Tag name columns
  if (/^(?:size|tag|uk|us|eu)/i.test(trimmed)) return trimmed;

  if (activeUnit === 'cm') {
    if (/\(in(?:ches)?\)/i.test(trimmed)) {
      return trimmed.replace(/\(in(?:ches)?\)/i, '(cm)');
    }
    if (!/\(cm\)/i.test(trimmed)) {
      return `${trimmed} (cm)`;
    }
  } else if (activeUnit === 'in') {
    if (/\(cm\)/i.test(trimmed)) {
      return trimmed.replace(/\(cm\)/i, '(in)');
    }
    if (!/\(in\)/i.test(trimmed)) {
      return `${trimmed} (in)`;
    }
  }
  return trimmed;
};

// Detect base unit of the custom size guide table
export const detectBaseUnit = (columns = [], customSizeGuide = {}) => {
  if (customSizeGuide?.unit && (customSizeGuide.unit === 'cm' || customSizeGuide.unit === 'in')) {
    return customSizeGuide.unit;
  }
  const hasCmInHeaders = Array.isArray(columns) && columns.some(c => typeof c === 'string' && /\(cm\)/i.test(c));
  if (hasCmInHeaders) return 'cm';
  return 'in'; // Standard default in Indian menswear
};

/* ───────────────────────── Master size charts ─────────────────────────
 * All measurements are garment measurements in inches. Columns flagged
 * `text: true` are labels (US / EU sizes, etc.) and are never converted. */

const SIZE_CHARTS = {
  tshirts: {
    title: 'T-Shirts & Polos',
    garment: 'tee',
    fitKey: 'chest',
    fitEase: true,
    columns: [
      { key: 'chest', label: 'Chest' },
      { key: 'length', label: 'Length' },
      { key: 'shoulder', label: 'Shoulder' },
      { key: 'sleeve', label: 'Sleeve' },
    ],
    rows: [
      ['XS', 36, 26, 16, 7.5],
      ['S', 38, 27, 17, 8],
      ['M', 40, 28, 18, 8.5],
      ['L', 42, 29, 19, 9],
      ['XL', 44, 30, 20, 9.5],
      ['XXL', 46, 31, 21, 10],
      ['3XL', 48, 31.5, 22, 10.5],
    ],
    fitTip: 'Regular fit. For an oversized / drop-shoulder look, go one size up.',
  },
  shirts: {
    title: 'Shirts',
    garment: 'shirt',
    fitKey: 'chest',
    fitEase: true,
    columns: [
      { key: 'chest', label: 'Chest' },
      { key: 'length', label: 'Length' },
      { key: 'shoulder', label: 'Shoulder' },
      { key: 'sleeve', label: 'Sleeve' },
    ],
    rows: [
      ['XS', 37, 26, 16, 24.5],
      ['S', 39.5, 27, 17, 25],
      ['M', 41.75, 28, 18, 25.5],
      ['L', 45, 29, 19, 26],
      ['XL', 47.5, 30, 20, 26.88],
      ['XXL', 50.5, 30.63, 21.25, 27.13],
      ['3XL', 52.5, 31, 22, 27.5],
      ['4XL', 54.5, 31.5, 22.75, 27.75],
      ['5XL', 56.5, 32, 23.5, 28],
      ['6XL', 58.5, 32.5, 24.25, 28.25],
    ],
    fitTip: 'Order your usual size for a tailored look, one size up for a relaxed fit.',
  },
  kurta: {
    title: 'Kurta & Ethnic Wear',
    garment: 'kurta',
    fitKey: 'chest',
    fitEase: true,
    columns: [
      { key: 'chest', label: 'Chest' },
      { key: 'length', label: 'Length' },
      { key: 'shoulder', label: 'Shoulder' },
      { key: 'sleeve', label: 'Sleeve' },
    ],
    rows: [
      ['36 (S)', 38, 40, 17, 24],
      ['38 (M)', 40, 42, 17.5, 24.5],
      ['40 (L)', 42, 44, 18, 25],
      ['42 (XL)', 44, 45, 18.5, 25.5],
      ['44 (XXL)', 46, 46, 19, 26],
      ['46 (3XL)', 48, 46, 19.5, 26],
    ],
    fitTip: 'Kurtas are cut with 2–4" of ease over your body chest for an easy drape.',
  },
  jeans: {
    title: 'Jeans & Trousers',
    garment: 'jeans',
    fitKey: 'waist',
    columns: [
      { key: 'waist', label: 'Waist' },
      { key: 'hip', label: 'Hip' },
      { key: 'thigh', label: 'Thigh' },
      { key: 'inseam', label: 'Inseam' },
      { key: 'outseam', label: 'Outseam' },
    ],
    rows: [
      ['28', 28, 36, 22, 30, 40],
      ['30', 30, 38, 23, 31, 41],
      ['32', 32, 40, 24, 32, 42],
      ['34', 34, 42, 25, 32, 42],
      ['36', 36, 44, 26, 32, 42],
      ['38', 38, 46, 27, 32, 42.5],
      ['40', 40, 48, 28, 32, 43],
      ['42', 42, 50, 29, 32, 43],
    ],
    fitTip: 'Pick the size that matches where you normally wear your waistband.',
  },
  shorts: {
    title: 'Shorts',
    garment: 'shorts',
    fitKey: 'waist',
    columns: [
      { key: 'waist', label: 'Waist' },
      { key: 'hip', label: 'Hip' },
      { key: 'inseam', label: 'Inseam' },
      { key: 'length', label: 'Length' },
    ],
    rows: [
      ['28', 28, 37, 7, 18],
      ['30', 30, 39, 7, 18.5],
      ['32', 32, 41, 7.5, 19],
      ['34', 34, 43, 7.5, 19.5],
      ['36', 36, 45, 8, 20],
      ['38', 38, 47, 8, 20.5],
      ['40', 40, 49, 8, 21],
    ],
    fitTip: 'Elasticated waists stretch about 2" — stay with your jeans size.',
  },
  jackets: {
    title: 'Jackets, Hoodies & Sweatshirts',
    garment: 'hoodie',
    fitKey: 'chest',
    fitEase: true,
    columns: [
      { key: 'chest', label: 'Chest' },
      { key: 'length', label: 'Length' },
      { key: 'shoulder', label: 'Shoulder' },
      { key: 'sleeve', label: 'Sleeve' },
    ],
    rows: [
      ['S', 40, 26.5, 17.5, 24.5],
      ['M', 42, 27.5, 18.5, 25],
      ['L', 44, 28.5, 19.5, 25.5],
      ['XL', 46, 29.5, 20.5, 26],
      ['XXL', 48, 30.5, 21.5, 26.5],
      ['3XL', 50, 31, 22.5, 27],
    ],
    fitTip: 'Cut with extra room through the chest so you can layer a tee or shirt underneath.',
  },
  footwear: {
    title: 'Footwear',
    garment: 'foot',
    fitKey: 'length',
    columns: [
      { key: 'us', label: 'US', text: true },
      { key: 'eu', label: 'EU', text: true },
      { key: 'length', label: 'Foot Length' },
    ],
    rows: [
      ['UK 6', 'US 7', 'EU 40', 9.6],
      ['UK 7', 'US 8', 'EU 41', 10],
      ['UK 8', 'US 9', 'EU 42', 10.3],
      ['UK 9', 'US 10', 'EU 43', 10.6],
      ['UK 10', 'US 11', 'EU 44', 11],
      ['UK 11', 'US 12', 'EU 45', 11.3],
      ['UK 12', 'US 13', 'EU 46', 11.6],
    ],
    fitTip: 'Between sizes? Go half a size up — our footwear runs true to UK sizing.',
  },
  belts: {
    title: 'Belts',
    garment: 'belt',
    columns: [
      { key: 'fits', label: 'Fits Waist' },
      { key: 'length', label: 'Belt Length' },
    ],
    rows: [
      ['30', '28 - 29', 30],
      ['32', '30 - 31', 32],
      ['34', '32 - 33', 34],
      ['36', '34 - 35', 36],
      ['38', '36 - 37', 38],
      ['40', '38 - 39', 40],
      ['42', '40 - 41', 42],
      ['44', '42 - 43', 44],
    ],
    fitTip: 'Choose a belt 2" larger than your trouser waist size.',
  },
  perfumes: {
    title: 'Perfume Volume Guide',
    isPerfume: true,
    tiers: [
      { volume: '10ml', sprays: '~120', duration: '2–3 weeks', bestFor: 'Pocket & travel, try a new scent' },
      { volume: '20ml', sprays: '~240', duration: '1 month', bestFor: 'Compact refresh anywhere' },
      { volume: '30ml', sprays: '~360', duration: '1–2 months', bestFor: 'Daily carry, rotation perfume' },
      { volume: '50ml', sprays: '~600', duration: '3–4 months', bestFor: 'Everyday signature scent', badge: 'Popular' },
      { volume: '75ml', sprays: '~900', duration: '4–5 months', bestFor: 'Mid-size favourite' },
      { volume: '100ml', sprays: '~1,200', duration: '6–8 months', bestFor: 'Full size, best price per ml', badge: 'Best value' },
      { volume: '150ml', sprays: '~1,800', duration: '9–10 months', bestFor: 'Heavy daily users' },
      { volume: '200ml', sprays: '~2,400', duration: '12+ months', bestFor: 'All-season signature' },
    ],
    tips: [
      { title: 'Pulse points', desc: 'Wrists, neck, collarbones and behind the ears — warm skin projects scent best.' },
      { title: 'Concentration', desc: 'Our Eau de Parfums carry 18–22% perfume oil for 8–12 hours of wear.' },
      { title: 'Last longer', desc: 'Moisturise with an unscented lotion first; hydrated skin holds fragrance longer.' },
    ],
  },
  accessories: {
    title: 'Accessories',
    isInfo: true,
    notes: [
      { title: 'Caps', desc: 'Adjustable snapback / buckle strap. Free size, fits head circumference 54–60 cm.' },
      { title: 'Sunglasses', desc: 'Lightweight frames with UV400 protection, sized for a universal fit.' },
      { title: 'Wallets', desc: 'Fits Indian currency notes flat and holds up to 8 cards without bulk.' },
      { title: 'Watches', desc: 'Straps are adjustable and fit wrists from roughly 15 to 21 cm.' },
    ],
  },
};

const HOW_TO_MEASURE = {
  chest: 'Lay the garment flat and measure straight across, 1" below the armholes. Shown as the full round.',
  length: 'From the highest point of the shoulder, next to the collar, straight down to the hem.',
  shoulder: 'Straight across the back, from one shoulder seam to the other.',
  sleeve: 'From the shoulder seam down to the end of the sleeve or cuff.',
  waist: 'Around the top edge of the waistband with the button done up.',
  hip: 'Around the fullest part of the seat, about 7" below the waistband.',
  thigh: 'Around the widest part of the leg, just below the crotch seam.',
  inseam: 'From the crotch seam down the inside of the leg to the hem.',
  outseam: 'From the top of the waistband down the outer side seam to the hem.',
  fits: 'Your usual trouser waist size.',
  footLength: 'Stand on paper, mark your heel and longest toe, and measure the distance between them.',
  beltLength: 'From where the leather meets the buckle to the middle hole.',
};

// Pick the chart from category first, then product name — many catalogue
// categories are colour or occasion groups ("Blues", "Traditional & Festive").
export function detectSizeChart(category = '', name = '') {
  const match = (raw) => {
    const c = String(raw || '').toLowerCase();
    if (!c) return null;
    if (/perfume|fragrance|attar|deo/.test(c)) return 'perfumes';
    if (/slipper|shoe|sneaker|footwear|sandal|loafer|flip/.test(c)) return 'footwear';
    if (/belt/.test(c)) return 'belts';
    if (/wallet|watch|cap\b|caps|sunglass|goggle|accessor/.test(c)) return 'accessories';
    if (/kurta|ethnic|sherwani|festive|traditional/.test(c)) return 'kurta';
    if (/short(s)?\b|bermuda/.test(c) && !/shirt/.test(c)) return 'shorts';
    if (/jean|trouser|pant|denim|cargo|jogger|chino|bottom/.test(c)) return 'jeans';
    if (/jacket|hoodie|sweatshirt|blazer|coat|sweater|outerwear/.test(c)) return 'jackets';
    if (/t-shirt|tshirt|t shirt|tee|polo|oversized/.test(c)) return 'tshirts';
    if (/shirt/.test(c)) return 'shirts';
    return null;
  };
  return match(category) || match(name) || 'tshirts';
}

const normSize = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '');
const sizeTokens = (s) => String(s ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// "38 (M)" matches product size "M" or "38"; "UK 8" matches "UK 8" or "8".
function sizesMatch(rowLabel, productSize) {
  if (!rowLabel || !productSize) return false;
  if (normSize(rowLabel) === normSize(productSize)) return true;
  const rowT = sizeTokens(rowLabel);
  const prodT = sizeTokens(productSize);
  if (prodT.length === 1 && rowT.includes(prodT[0])) return true;
  if (rowT.length === 1 && prodT.includes(rowT[0])) return true;
  return false;
}

// Map a free-text custom column header ("Chest (in)", "Front Length") to a diagram key.
function keyForHeader(header) {
  const h = String(header || '').toLowerCase();
  const keys = ['chest', 'shoulder', 'sleeve', 'waist', 'hip', 'thigh', 'inseam', 'outseam', 'length'];
  return keys.find((k) => h.includes(k)) || h.replace(/\(.*?\)/g, '').trim();
}

const fmt = (n) => {
  const v = Math.round(Number(n) * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
};

export default function SizeGuideModal({
  isOpen,
  onClose,
  category = '',
  productName = '',
  product,
  price,
  mrp,
  discount,
  image,
  selectedSize,
  availableSizes,
  onSelectSize,
  onAddToCart,
  customSizeGuide,
}) {
  const chartKey = useMemo(
    () => detectSizeChart(category || product?.category, productName || product?.name),
    [category, productName, product?.category, product?.name]
  );
  const chart = SIZE_CHARTS[chartKey];

  const [tab, setTab] = useState('chart');
  const [unit, setUnit] = useState('in');
  const [picked, setPicked] = useState(selectedSize || null);
  const [viewIdx, setViewIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef(null);
  const carouselRef = useRef(null);

  // Fit finder
  const [bodyInput, setBodyInput] = useState('');
  const [fitPref, setFitPref] = useState('regular');

  useEffect(() => {
    if (isOpen) {
      setPicked(selectedSize || null);
      setTab('chart');
      setViewIdx(0);
      setExpanded(false);
      setClosing(false);
      setDragY(0);
    }
  }, [isOpen, selectedSize]);

  const requestClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose?.();
    }, 220);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (expanded) setExpanded(false);
      else requestClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, expanded, requestClose]);

  /* ── Build one normalised table: columns [{key,label,text}] + rows [{size, cells[]}] in base unit ── */
  const table = useMemo(() => {
    const custom = customSizeGuide?.enabled && Array.isArray(customSizeGuide?.columns) && customSizeGuide.columns.length > 1
      && Array.isArray(customSizeGuide?.rows) && customSizeGuide.rows.length > 0;

    if (custom) {
      const cols = customSizeGuide.columns;
      const rows = customSizeGuide.rows.map((row) => {
        if (Array.isArray(row)) return row;
        if (row && typeof row === 'object') {
          if (Array.isArray(row.cells)) return row.cells;
          return cols.map((col, idx) => row[`c${idx}`] ?? row[idx] ?? row[col] ?? '');
        }
        return [];
      }).filter((r) => r.length && String(r[0] ?? '').trim());
      return {
        custom: true,
        baseUnit: detectBaseUnit(cols, customSizeGuide),
        sizeLabel: String(cols[0] || 'Size').replace(/\(.*?\)/g, '').trim() || 'Size',
        columns: cols.slice(1).map((c) => ({
          key: keyForHeader(c),
          label: String(c).replace(/\s*\((?:in|inches|cm)\)\s*/gi, '').trim(),
          text: /^(?:us|eu|uk)\b/i.test(String(c).trim()),
        })),
        rows: rows.map((r) => ({ size: String(r[0]).trim(), cells: r.slice(1) })),
      };
    }

    if (!chart || !chart.columns) return null;
    return {
      custom: false,
      baseUnit: 'in',
      sizeLabel: chartKey === 'footwear' ? 'UK / IND' : 'Size',
      columns: chart.columns,
      rows: chart.rows.map((r) => ({ size: r[0], cells: r.slice(1) })),
    };
  }, [customSizeGuide, chart, chartKey]);

  const displayCell = useCallback((col, val) => {
    if (val === null || val === undefined || String(val).trim() === '') return '–';
    if (col.text) return String(val);
    if (!table) return String(val);
    if (table.custom) return convertMeasurementValue(val, table.baseUnit, unit) || '–';
    if (typeof val === 'number') return unit === 'cm' ? fmt(val * 2.54) : fmt(val);
    return convertMeasurementValue(val, 'in', unit);
  }, [table, unit]);

  const productSizeFor = useCallback((rowLabel) => {
    if (!Array.isArray(availableSizes)) return rowLabel;
    return availableSizes.find((s) => sizesMatch(rowLabel, s)) || null;
  }, [availableSizes]);

  const pickedRow = useMemo(() => {
    if (!table || !picked) return null;
    return table.rows.find((r) => sizesMatch(r.size, picked)) || null;
  }, [table, picked]);

  // Diagram key -> table column (custom charts often call the outseam "Length").
  const columnIndexFor = useCallback((key) => {
    if (!table) return -1;
    const cols = table.columns;
    let idx = cols.findIndex((c) => c.key === key);
    if (idx < 0 && key === 'length') idx = cols.findIndex((c) => /length/.test(c.key));
    if (idx < 0 && key === 'outseam') idx = cols.findIndex((c) => c.key === 'length' || /length/.test(c.key));
    return idx;
  }, [table]);

  const hasMeasure = useCallback((key) => columnIndexFor(key) >= 0, [columnIndexFor]);

  const valueFor = useCallback((key) => {
    if (!pickedRow || !table) return null;
    const idx = columnIndexFor(key);
    if (idx < 0) return null;
    const v = displayCell(table.columns[idx], pickedRow.cells[idx]);
    if (!v || v === '–') return null;
    return unit === 'in' ? `${v}"` : `${v}cm`;
  }, [pickedRow, table, displayCell, unit, columnIndexFor]);

  /* ── Fit finder recommendation ── */
  const recommendation = useMemo(() => {
    const val = parseFloat(bodyInput);
    if (!table || !chart?.fitKey || !val || val <= 0) return null;
    const colIdx = table.columns.findIndex((c) => c.key === chart.fitKey);
    if (colIdx < 0) return null;
    let target = unit === 'cm' ? val / 2.54 : val;
    if (chart.fitEase) target += fitPref === 'slim' ? 1 : fitPref === 'relaxed' ? 4 : 2;
    const toIn = (cell) => {
      const n = parseFloat(String(cell));
      if (isNaN(n)) return NaN;
      return table.custom && table.baseUnit === 'cm' ? n / 2.54 : n;
    };
    const candidates = table.rows.filter((r) => !isNaN(toIn(r.cells[colIdx])));
    if (!candidates.length) return null;
    return (candidates.find((r) => toIn(r.cells[colIdx]) >= target - 0.25) || candidates[candidates.length - 1]).size;
  }, [bodyInput, table, chart, unit, fitPref]);

  const garment = chart?.garment ? GARMENTS[chart.garment] : null;
  const views = garment?.views || [];

  const programmaticScroll = useRef(null);
  const onCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el || programmaticScroll.current) return;
    const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (idx !== viewIdx) setViewIdx(idx);
  };
  const goToView = (idx) => {
    const el = carouselRef.current;
    clearTimeout(programmaticScroll.current);
    programmaticScroll.current = setTimeout(() => { programmaticScroll.current = null; }, 600);
    if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
    setViewIdx(idx);
  };

  // Swipe the sheet down from its handle to dismiss (mobile).
  const onDragStart = (e) => { dragStart.current = e.touches[0].clientY; };
  const onDragMove = (e) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
  };
  const onDragEnd = () => {
    if (dragY > 110) requestClose();
    else setDragY(0);
    dragStart.current = null;
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const pickedProductSize = picked ? productSizeFor(pickedRow?.size || picked) : null;
  const unitWord = unit === 'in' ? 'Inches' : 'Centimetres';
  const showPrice = Number(price) > 0;

  const measureKeys = (() => {
    if (chart?.garment === 'foot') return [['Foot Length', HOW_TO_MEASURE.footLength]];
    if (chart?.garment === 'belt') return [['Belt Length', HOW_TO_MEASURE.beltLength]];
    const cols = table?.columns || [];
    return cols.filter((c) => HOW_TO_MEASURE[c.key]).map((c) => [c.label, HOW_TO_MEASURE[c.key]]);
  })();

  const footerLabel = (() => {
    if (!picked) return chart?.isPerfume ? 'Select a volume' : 'Select a size';
    if (!pickedProductSize) return `Size ${pickedRow?.size || picked} is sold out`;
    return onAddToCart ? 'Add to cart' : `Select size ${pickedProductSize}`;
  })();

  const confirm = () => {
    if (!pickedProductSize) return;
    onSelectSize?.(pickedProductSize);
    if (onAddToCart) onAddToCart(pickedProductSize);
    requestClose();
  };

  const renderSizeTable = () => (
    <div className="sg-table-wrap">
      <table className="sg-table">
        <thead>
          <tr>
            <th className="sg-col-size">{table.sizeLabel}</th>
            {table.columns.map((c) => <th key={c.key + c.label}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => {
            const available = productSizeFor(row.size);
            const isPicked = pickedRow?.size === row.size;
            const isRec = recommendation === row.size;
            return (
              <tr
                key={row.size}
                className={`${isPicked ? 'is-picked' : ''} ${!available ? 'is-unavailable' : ''}`}
                onClick={() => setPicked(row.size)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked(row.size); } }}
                aria-selected={isPicked}
              >
                <td className="sg-col-size">
                  <span className="sg-radio" aria-hidden="true" />
                  <span className="sg-size-label">{row.size}</span>
                  {isRec && <span className="sg-rec-chip">Your fit</span>}
                  {!available && <span className="sg-oos-chip">Sold out</span>}
                </td>
                {table.columns.map((c, i) => <td key={c.key + i}>{displayCell(c, row.cells[i])}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderDiagrams = () => views.length > 0 && (
    <div className={`sg-figure ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="sg-figure-expand"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'Close full screen diagram' : 'Open diagram full screen'}
      >
        {expanded ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        )}
      </button>
      <div className="sg-carousel" ref={carouselRef} onScroll={onCarouselScroll}>
        {views.map((v) => (
          <div className="sg-slide" key={v.name}>
            <GarmentView garment={chart.garment} view={v} valueFor={valueFor} hasMeasure={table?.custom ? hasMeasure : null} />
          </div>
        ))}
      </div>
      {views.length > 1 && (
        <div className="sg-view-switch" role="tablist" aria-label="Diagram view">
          {views.map((v, i) => (
            <button
              key={v.name}
              type="button"
              role="tab"
              aria-selected={viewIdx === i}
              className={viewIdx === i ? 'active' : ''}
              onClick={() => goToView(i)}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}
      {pickedRow && !chart.isPerfume && (
        <p className="sg-figure-caption">Showing measurements for size <strong>{pickedRow.size}</strong></p>
      )}
    </div>
  );

  return createPortal(
    <div
      className={`sg-overlay ${closing ? 'is-closing' : ''}`}
      onClick={requestClose}
      role="dialog"
      aria-modal="true"
      aria-label="Size guide"
    >
      <div
        className="sg-sheet"
        onClick={(e) => e.stopPropagation()}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div className="sg-handle-zone" onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}>
          <span className="sg-handle" />
        </div>

        <header className="sg-header">
          <div className="sg-product">
            {image && <img src={image} alt="" className="sg-product-img" loading="lazy" />}
            <div className="sg-product-meta">
              <p className="sg-eyebrow">{chart?.isPerfume ? 'Volume guide' : 'Size guide'} · {chart?.title}</p>
              {(productName || product?.name) && <h2 className="sg-product-name">{productName || product?.name}</h2>}
              {showPrice && (
                <div className="sg-price-row">
                  <span className="sg-price">₹{Number(price).toLocaleString('en-IN')}</span>
                  {Number(mrp) > Number(price) && <span className="sg-mrp">₹{Number(mrp).toLocaleString('en-IN')}</span>}
                  {discount > 0 && <span className="sg-off">{discount}% off</span>}
                </div>
              )}
            </div>
          </div>
          <button type="button" className="sg-close" onClick={requestClose} aria-label="Close size guide">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        {table && (
          <div className="sg-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'chart'} className={tab === 'chart' ? 'active' : ''} onClick={() => setTab('chart')}>
              Size Chart
            </button>
            <button type="button" role="tab" aria-selected={tab === 'measure'} className={tab === 'measure' ? 'active' : ''} onClick={() => setTab('measure')}>
              How to Measure
            </button>
          </div>
        )}

        <div className="sg-body">
          {/* ───────── Apparel / footwear / belts ───────── */}
          {table && tab === 'chart' && (
            <>
              <div className="sg-unit-row">
                <span className="sg-unit-note">Measurements are in {unitWord}</span>
                <div className="sg-unit-toggle" role="group" aria-label="Measurement unit">
                  <button type="button" className={unit === 'in' ? 'active' : ''} onClick={() => setUnit('in')} aria-pressed={unit === 'in'}>in</button>
                  <button type="button" className={unit === 'cm' ? 'active' : ''} onClick={() => setUnit('cm')} aria-pressed={unit === 'cm'}>cm</button>
                </div>
              </div>
              {renderSizeTable()}
              {chart?.fitTip && <p className="sg-fit-tip">{chart.fitTip}</p>}
              {renderDiagrams()}
            </>
          )}

          {table && tab === 'measure' && (
            <>
              {renderDiagrams()}
              <ol className="sg-steps">
                {measureKeys.map(([label, desc], i) => (
                  <li key={label}>
                    <span className="sg-step-num">{i + 1}</span>
                    <div>
                      <strong>{label}</strong>
                      <p>{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {chart?.fitKey && (
                <div className="sg-finder">
                  <h3>Find your size</h3>
                  <p>
                    {chart.fitKey === 'waist' ? 'Enter your body waist' : chart.fitKey === 'length' ? 'Enter your foot length' : 'Enter your body chest'}
                    {' '}in {unitWord.toLowerCase()}.
                  </p>
                  <div className="sg-finder-row">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={bodyInput}
                      onChange={(e) => setBodyInput(e.target.value)}
                      placeholder={chart.fitKey === 'waist' ? (unit === 'in' ? 'e.g. 32' : 'e.g. 81') : chart.fitKey === 'length' ? (unit === 'in' ? 'e.g. 10.3' : 'e.g. 26') : (unit === 'in' ? 'e.g. 38' : 'e.g. 97')}
                      aria-label="Your measurement"
                    />
                    <div className="sg-unit-toggle" role="group" aria-label="Measurement unit">
                      <button type="button" className={unit === 'in' ? 'active' : ''} onClick={() => setUnit('in')}>in</button>
                      <button type="button" className={unit === 'cm' ? 'active' : ''} onClick={() => setUnit('cm')}>cm</button>
                    </div>
                  </div>
                  {chart.fitEase && (
                    <div className="sg-fit-pref" role="group" aria-label="Preferred fit">
                      {[['slim', 'Slim'], ['regular', 'Regular'], ['relaxed', 'Relaxed']].map(([k, l]) => (
                        <button key={k} type="button" className={fitPref === k ? 'active' : ''} onClick={() => setFitPref(k)}>{l}</button>
                      ))}
                    </div>
                  )}
                  {recommendation && (
                    <button type="button" className="sg-rec-result" onClick={() => { setPicked(recommendation); setTab('chart'); }}>
                      <span>We recommend</span>
                      <strong>{recommendation}</strong>
                      <span className="sg-rec-link">Select →</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ───────── Perfumes ───────── */}
          {chart?.isPerfume && (
            <>
              <div className="sg-perfume-grid">
                {chart.tiers.map((t) => {
                  const available = productSizeFor(t.volume);
                  const isPicked = picked && sizesMatch(t.volume, picked);
                  return (
                    <button
                      key={t.volume}
                      type="button"
                      className={`sg-perfume-card ${isPicked ? 'is-picked' : ''} ${!available ? 'is-unavailable' : ''}`}
                      onClick={() => setPicked(t.volume)}
                    >
                      <span className="sg-perfume-top">
                        <strong>{t.volume}</strong>
                        {t.badge && <em>{t.badge}</em>}
                      </span>
                      <span className="sg-perfume-stat">{t.sprays} sprays · {t.duration}</span>
                      <span className="sg-perfume-desc">{t.bestFor}</span>
                    </button>
                  );
                })}
              </div>
              <div className="sg-notes">
                {chart.tips.map((t) => (
                  <div key={t.title} className="sg-note"><strong>{t.title}</strong><p>{t.desc}</p></div>
                ))}
              </div>
            </>
          )}

          {/* ───────── Other accessories ───────── */}
          {chart?.isInfo && (
            <div className="sg-notes">
              {chart.notes.map((t) => (
                <div key={t.title} className="sg-note"><strong>{t.title}</strong><p>{t.desc}</p></div>
              ))}
            </div>
          )}

          <p className="sg-guarantee">Still unsure about your size? Chat with us on WhatsApp and we’ll help you pick.</p>
        </div>

        {!chart?.isInfo && (onSelectSize || onAddToCart) && (
          <footer className="sg-footer">
            {picked && (
              <span className="sg-footer-size">
                Size <strong>{pickedRow?.size || picked}</strong>
              </span>
            )}
            <button type="button" className="sg-cta" disabled={!pickedProductSize} onClick={confirm}>
              {footerLabel}
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
