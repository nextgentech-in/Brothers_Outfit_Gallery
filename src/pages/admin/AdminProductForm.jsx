import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createProduct, updateProduct, getAdminProductById, deleteProductImage, generateProductId } from '../../services/adminService';
import './AdminProductForm.css';

import { getBackendUrl } from '../../utils/apiConfig';

const CATEGORY_SIZES_MAP = {
  'Shirts': ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
  'T-Shirts': ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'],
  'Jeans': ['28', '30', '32', '34', '36', '38', '40', '42'],
  'Trousers': ['28', '30', '32', '34', '36', '38', '40', '42'],
  'Jackets': ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
  'Hoodies': ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
  'Ethnic Wear': ['36', '38', '40', '42', '44', '46', 'M', 'L', 'XL', 'XXL'],
  'Perfumes': ['10ml', '20ml', '30ml', '50ml', '75ml', '100ml', '120ml', '150ml', '200ml'],
  'Slippers': ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'],
  'Accessories': ['One Size', 'Free Size', 'Regular', 'Adjustable', 'Standard'],
  'Wallets': ['Standard', 'Slim', 'Bifold', 'Trifold'],
  'Watches': ['Standard', 'Dial 40mm', 'Dial 42mm', 'Adjustable Strap'],
  'Belts': ['28-32', '32-36', '36-40', '40-44', 'Free Size', 'Adjustable'],
};

const COMMON_BATCH_SIZES = {
  'Perfumes': ['30ml', '50ml', '100ml'],
  'Jeans': ['30', '32', '34', '36', '38'],
  'Trousers': ['30', '32', '34', '36', '38'],
  'Slippers': ['UK 7', 'UK 8', 'UK 9', 'UK 10'],
  'Accessories': ['One Size', 'Free Size'],
  'Wallets': ['Standard', 'Slim'],
  'Watches': ['Standard', 'Dial 40mm'],
  'Belts': ['32-36', '36-40'],
  'DEFAULT': ['S', 'M', 'L', 'XL', 'XXL']
};

const STANDARD_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Navy', hex: '#1e3a8a' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Grey', hex: '#6b7280' },
  { name: 'Brown', hex: '#78350f' },
  { name: 'Beige', hex: '#f5f5dc' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Custom (Type specific name)', hex: '#cccccc' }
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export default function AdminProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    sku: '',
    categoryId: 'Shirts',
    shortDescription: '',
    description: '',
    mrp: '',
    salePrice: '',
    colors: [],
    variants: [],
    offerEnabled: false,
    offerDiscountPercentage: 0,
    offerStartAt: '',
    offerEndAt: '',
    active: true,
  });

  // Ephemeral States
  const [selectedStandardColor, setSelectedStandardColor] = useState('Black');
  const [newColorName, setNewColorName] = useState('Black');
  const [newColorHex, setNewColorHex] = useState('#000000');
  const [selectedVariantColor, setSelectedVariantColor] = useState('');

  // Customizable Sizes & Bulk Stock States
  const [initialStockInput, setInitialStockInput] = useState(10);
  const [customSizeName, setCustomSizeName] = useState('');
  const [customSizeStock, setCustomSizeStock] = useState(10);
  const [bulkStockToApply, setBulkStockToApply] = useState(10);
  const [applyToAllColors, setApplyToAllColors] = useState(false);

  // Image Upload States
  const [existingImages, setExistingImages] = useState([]);
  const [pendingImages, setPendingImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);

  useEffect(() => {
    if (isEdit) {
      getAdminProductById(id).then(data => {
        if (data) {
          setFormData({
            ...data,
            mrp: data.mrp || data.compareAtPrice || '',
            salePrice: data.salePrice || data.price || '',
            variants: data.variants || [],
            colors: data.colors || [],
          });

          // Map legacy string images to object schema or use existing objects
          if (data.images && data.images.length > 0) {
            const mappedImages = data.images.map((img, idx) => {
              if (typeof img === 'string') {
                return { url: img, publicId: null, isPrimary: data.thumbnailUrl === img || idx === 0 };
              }
              return { url: img.url, publicId: img.publicId || img.path, isPrimary: img.isPrimary || (idx === 0 && !data.images?.some(i => i.isPrimary)) };
            });
            setExistingImages(mappedImages);
          }
        }
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };

      if (name === 'name' && !isEdit) {
        updated.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      }
      return updated;
    });
  };

  const handleStandardColorChange = (e) => {
    const selected = e.target.value;
    setSelectedStandardColor(selected);

    const matched = STANDARD_COLORS.find(c => c.name === selected);
    if (matched && matched.name !== 'Custom (Type specific name)') {
      setNewColorName(matched.name);
      setNewColorHex(matched.hex);
    } else {
      setNewColorName('');
      setNewColorHex('#cccccc');
    }
  };

  const handleAddColor = () => {
    if (!newColorName) return;
    setFormData(prev => ({
      ...prev,
      colors: [...prev.colors, { name: newColorName, hex: newColorHex }]
    }));
    setNewColorName('');
  };

  const handleRemoveColor = (name) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.filter(c => c.name !== name),
      variants: prev.variants.filter(v => v.color !== name)
    }));
  };

  // Helper to determine active target colors (or 'Standard' if product has no color variations)
  const getTargetColors = () => {
    if (!formData.colors || formData.colors.length === 0) return ['Standard'];
    if (applyToAllColors) return formData.colors.map(c => c.name);
    return [selectedVariantColor || formData.colors[0]?.name || 'Standard'];
  };

  // Add single size with custom initial stock
  const handleAddSizeWithStock = (size, stock = 10) => {
    if (!size || !String(size).trim()) return;
    const cleanSize = String(size).trim();
    const colorsToTarget = getTargetColors();

    setFormData(prev => {
      const updatedVariants = [...prev.variants];
      colorsToTarget.forEach(colName => {
        const existingIdx = updatedVariants.findIndex(v => v.color === colName && v.size === cleanSize);
        if (existingIdx >= 0) {
          // If already exists, update its stock
          updatedVariants[existingIdx] = {
            ...updatedVariants[existingIdx],
            stock: parseInt(stock, 10) || 0
          };
        } else {
          // Add new variant
          updatedVariants.push({
            id: `${colName}-${cleanSize}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            color: colName,
            size: cleanSize,
            sku: `${prev.sku || 'PRD'}-${colName[0]?.toUpperCase() || 'S'}-${cleanSize.replace(/[^a-zA-Z0-9]/g, '')}`,
            stock: parseInt(stock, 10) || 0
          });
        }
      });
      return { ...prev, variants: updatedVariants };
    });
  };

  // 1-Click Batch Add multiple sizes with preset stock
  const handleBatchAddSizes = (sizesList, batchStock = 10) => {
    const colorsToTarget = getTargetColors();
    setFormData(prev => {
      const updatedVariants = [...prev.variants];
      colorsToTarget.forEach(colName => {
        sizesList.forEach(sz => {
          const existingIdx = updatedVariants.findIndex(v => v.color === colName && v.size === sz);
          if (existingIdx >= 0) {
            updatedVariants[existingIdx] = {
              ...updatedVariants[existingIdx],
              stock: parseInt(batchStock, 10) || 0
            };
          } else {
            updatedVariants.push({
              id: `${colName}-${sz}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              color: colName,
              size: sz,
              sku: `${prev.sku || 'PRD'}-${colName[0]?.toUpperCase() || 'S'}-${sz.replace(/[^a-zA-Z0-9]/g, '')}`,
              stock: parseInt(batchStock, 10) || 0
            });
          }
        });
      });
      return { ...prev, variants: updatedVariants };
    });
  };

  // Bulk set stock for ALL existing variants simultaneously
  const handleApplyBulkStock = () => {
    const stockNum = parseInt(bulkStockToApply, 10) || 0;
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v => ({ ...v, stock: stockNum }))
    }));
  };

  // Handle adding user's custom-typed size (e.g. 250ml or 44 Slim)
  const handleAddCustomSize = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!customSizeName.trim()) {
      alert('Please enter a size or volume name (e.g. 250ml, 3XL, or Combo Pack)');
      return;
    }
    handleAddSizeWithStock(customSizeName.trim(), customSizeStock);
    setCustomSizeName('');
  };

  const updateVariantStock = (vId, stockVal) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v => v.id === vId ? { ...v, stock: parseInt(stockVal, 10) || 0 } : v)
    }));
  };

  const removeVariant = (vId) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== vId)
    }));
  };

  // -------------------------------------------------------------
  // IMAGE HANDLING LOGIC
  // -------------------------------------------------------------

  const onSelectFiles = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newPending = [];
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/jpg'];

    files.forEach((file) => {
      if (!validTypes.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|avif)$/i)) {
        alert(`${file.name}: Please upload a JPG, PNG, WEBP or AVIF image.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name}: Image must be 2 MB or smaller.`);
        return;
      }

      // Duplicate prevention: check if a file with same name and size exists
      const isPendingDup = pendingImages.some(p => p.name === file.name && p.size === file.size);
      // We can't perfectly check existing Images via name/size as they might be URLs, but we check pending
      if (isPendingDup) {
        return; // silently skip exact duplicate from being re-added
      }

      newPending.push({
        file,
        preview: URL.createObjectURL(file), // create local preview
        name: file.name,
        size: file.size,
        isPrimary: false
      });
    });

    if (newPending.length > 0) {
      setPendingImages(prev => {
        const combined = [...prev, ...newPending];
        // Ensure at least one image is primary if none are
        const hasPrimary = combined.some(p => p.isPrimary) || existingImages.some(e => e.isPrimary);
        if (!hasPrimary && combined.length > 0) {
          combined[0].isPrimary = true;
        }
        return combined;
      });
    }

    // Reset input so the same files can be selected again later
    e.target.value = '';
  };

  const removePendingImage = (index) => {
    setPendingImages(prev => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  const removeExistingImage = (index) => {
    setExistingImages(prev => {
      const copy = [...prev];
      const removed = copy.splice(index, 1)[0];
      if (removed.publicId || removed.path) {
        setImagesToDelete(d => [...d, removed.publicId || removed.path]);
      }
      return copy;
    });
  };

  const setPrimaryImage = (type, index) => {
    // Clear all existing
    setExistingImages(prev => prev.map((img, i) => ({ ...img, isPrimary: type === 'existing' && i === index })));
    setPendingImages(prev => prev.map((img, i) => ({ ...img, isPrimary: type === 'pending' && i === index })));
  };

  const formatSize = (bytes) => (bytes / (1024 * 1024)).toFixed(2) + ' MB';

  // -------------------------------------------------------------
  // SAVE AND PUBLISH LOGIC
  // -------------------------------------------------------------

  const handleSave = async () => {
    // Validations
    if (!formData.name) return setError("Name is required.");
    const mrp = parseFloat(formData.mrp);
    const sale = parseFloat(formData.salePrice);
    if (!mrp || mrp <= 0) return setError("MRP must be > 0.");
    if (!sale || sale <= 0) return setError("Sale Price must be > 0.");
    if (sale > mrp) return setError("Sale price cannot be greater than MRP.");

    if (existingImages.length === 0 && pendingImages.length === 0) {
      return setError("Please upload at least one valid product image.");
    }

    for (let v of formData.variants) {
      if (v.stock < 0) return setError("Variant stock cannot be negative.");
    }

    setSubmitting(true);
    setError(null);

    try {
      const finalProductId = isEdit ? id : generateProductId();

      // 1. Delete removed images from ImageKit
      for (const publicId of imagesToDelete) {
        await deleteProductImage(publicId);
      }

      // 2. Upload pending images via ImageKit API
      const newlyUploaded = [];
      if (pendingImages.length > 0) {
        const getImageKitAuthParams = async () => {
          const backendUrl = getBackendUrl();
          const endpoints = [
            backendUrl ? `${backendUrl}/api/imagekit/auth` : '/api/imagekit/auth',
            'http://localhost:3001/api/imagekit/auth'
          ];

          for (const ep of endpoints) {
            try {
              const res = await fetch(ep);
              if (res.ok) {
                const data = await res.json();
                if (data.token && data.signature && data.expire) {
                  return data;
                }
              }
            } catch {}
          }

          // Client-side Web Crypto fallback if private key is present
          const privateKey = import.meta.env.VITE_IMAGEKIT_PRIVATE_KEY || import.meta.env.IMAGEKIT_PRIVATE_KEY;
          if (privateKey && typeof window !== 'undefined' && window.crypto?.subtle) {
            try {
              const token = window.crypto.randomUUID ? window.crypto.randomUUID() : ('tok_' + Math.random().toString(36).slice(2) + Date.now());
              const expire = Math.floor(Date.now() / 1000) + 1800;
              const enc = new TextEncoder();
              const cryptoKey = await window.crypto.subtle.importKey(
                'raw',
                enc.encode(privateKey),
                { name: 'HMAC', hash: 'SHA-1' },
                false,
                ['sign']
              );
              const sigBuf = await window.crypto.subtle.sign(
                'HMAC',
                cryptoKey,
                enc.encode(token + expire)
              );
              const signature = Array.from(new Uint8Array(sigBuf))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
              return { token, signature, expire };
            } catch (fallbackErr) {
              console.warn("Client fallback signature generation error:", fallbackErr);
            }
          }

          throw new Error("Failed to get ImageKit auth params. Please ensure backend is running or check ImageKit credentials.");
        };

        for (let i = 0; i < pendingImages.length; i++) {
          const { token, signature, expire } = await getImageKitAuthParams();

          const item = pendingImages[i];
          const uniqueFileName = `${Date.now()}-${item.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("publicKey", import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY);
          formData.append("signature", signature);
          formData.append("expire", expire);
          formData.append("token", token);
          formData.append("fileName", uniqueFileName);
          formData.append("folder", `products/${finalProductId}/`);

          const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
            method: "POST",
            body: formData
          });

          if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            console.error("ImageKit upload error:", errText);
            let parsedErr;
            try { parsedErr = JSON.parse(errText); } catch { }
            const detail = parsedErr?.message || errText;
            throw new Error(`Upload failed for ${item.name}: ${detail}`);
          }
          const uploadData = await uploadRes.json();

          newlyUploaded.push({
            url: uploadData.url,
            publicId: uploadData.fileId,
            alt: formData.name + ' - ' + (i + 1),
            isPrimary: item.isPrimary
          });
        }
      }

      // 3. Combine images and fix sort ordering
      let combinedImages = [...existingImages, ...newlyUploaded];

      // Auto-assign primary if missing somehow
      if (combinedImages.length > 0 && !combinedImages.some(img => img.isPrimary)) {
        combinedImages[0].isPrimary = true;
      }

      combinedImages = combinedImages.map((img, idx) => ({ ...img, sortOrder: idx }));

      const primaryImg = combinedImages.find(img => img.isPrimary) || combinedImages[0];
      const thumbnailUrl = primaryImg ? primaryImg.url : '';

      const autoDiscount = Math.round(((mrp - sale) / mrp) * 100);

      const payload = {
        ...formData,
        mrp: mrp,
        salePrice: sale,
        price: sale,
        compareAtPrice: mrp,
        discountPercentage: autoDiscount,
        stock: formData.variants.reduce((acc, v) => acc + (v.stock || 0), 0),
        sizes: [...new Set(formData.variants.map(v => v.size))].filter(Boolean),
        images: combinedImages,
        thumbnailUrl: thumbnailUrl,
        image: thumbnailUrl, // Legacy fallback
      };

      // 4. Save to firestore
      if (isEdit) {
        await updateProduct(id, payload);
      } else {
        await createProduct(payload, finalProductId); // Passing explicit ID
      }
      navigate('/admin/products');
    } catch (err) {
      console.error('Save Error:', err);
      if (err.message && err.code?.includes('storage/unauthorized')) {
        setError("Failed to upload images: Storage Unauthorized. Make sure you are logged in as admin!");
      } else {
        setError(`Failed to save product: ${err.message}`);
      }
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading form...</div>;

  const activeMrp = parseFloat(formData.mrp) || 0;
  const activeSale = parseFloat(formData.salePrice) || 0;
  const currentDiscount = (activeMrp && activeSale && activeMrp > activeSale) ? Math.round(((activeMrp - activeSale) / activeMrp) * 100) : 0;
  const calculatedTotalStock = formData.variants.reduce((acc, v) => acc + (v.stock || 0), 0);

  return (
    <div className="admin-product-form-container">
      <div className="admin-form-header-bar">
        <div className="admin-header-title-wrap">
          <h1 className="admin-title">{isEdit ? 'EDIT PRODUCT' : 'ADD NEW PRODUCT'}</h1>
          <span className="admin-header-subtitle">
            {isEdit ? `ID: ${id} • Edit pricing, inventory and photos` : 'Single-window product publishing with live inventory'}
          </span>
        </div>

        {/* Top Quick Actions Bar (Immediate Access on Mobile & Desktop) */}
        <div className="admin-header-actions-bar">
          <label className="admin-top-active-toggle" title="Store visibility status">
            <input 
              type="checkbox" 
              name="active" 
              checked={formData.active} 
              onChange={handleChange} 
            />
            <span className={`admin-status-pill ${formData.active ? 'is-active' : 'is-hidden'}`}>
              {formData.active ? '🟢 Visible in Store' : '⚪ Hidden Draft'}
            </span>
          </label>

          <button
            type="button"
            onClick={() => navigate('/admin/products')}
            className="admin-btn-secondary admin-top-cancel-btn"
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="admin-btn-primary admin-top-publish-btn"
          >
            {submitting ? 'Publishing...' : (isEdit ? '✓ Save Changes' : '🚀 Publish Product')}
          </button>
        </div>
      </div>

      {error && <div className="admin-alert-error">{error}</div>}

      <div className="admin-form-grid">
        <div className="admin-form-main">
          {/* Basic Info */}
          <section className="admin-form-section">
            <h3>Basic Information</h3>
            <div className="admin-form-group">
              <label>Product Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Premium Oversized Cotton Shirt" />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Slug (URL Friendly)</label>
                <input type="text" name="slug" value={formData.slug} onChange={handleChange} />
              </div>
              <div className="admin-form-group">
                <label>SKU (Base)</label>
                <input type="text" name="sku" value={formData.sku} onChange={handleChange} />
              </div>
              <div className="admin-form-group">
                <label>Category</label>
                <select name="categoryId" value={formData.categoryId} onChange={handleChange}>
                  <option value="Shirts">Shirts</option>
                  <option value="T-Shirts">T-Shirts</option>
                  <option value="Jeans">Jeans</option>
                  <option value="Trousers">Trousers</option>
                  <option value="Jackets">Jackets</option>
                  <option value="Hoodies">Hoodies</option>
                  <option value="Ethnic Wear">Ethnic Wear</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Perfumes">Perfumes</option>
                  <option value="Wallets">Wallets</option>
                  <option value="Slippers">Slippers</option>
                  <option value="Watches">Watches</option>
                  <option value="Belts">Belts</option>
                </select>
              </div>
            </div>
            <div className="admin-form-group">
              <label>Short Description</label>
              <textarea name="shortDescription" value={formData.shortDescription} onChange={handleChange} rows="2"></textarea>
            </div>
          </section>

          {/* Pricing */}
          <section className="admin-form-section">
            <h3 style={{ color: '#dc2626' }}>Pricing (Crucial)</h3>
            <div className="admin-form-row">
              <div className="admin-form-group price-field">
                <label>MRP (Maximum Retail Price)</label>
                <div className="price-input-wrapper">
                  <span>₹</span>
                  <input type="number" name="mrp" value={formData.mrp} onChange={handleChange} placeholder="2499" />
                </div>
              </div>
              <div className="admin-form-group price-field highlight">
                <label>SALE PRICE</label>
                <div className="price-input-wrapper">
                  <span>₹</span>
                  <input type="number" name="salePrice" value={formData.salePrice} onChange={handleChange} placeholder="1499" />
                </div>
              </div>
            </div>
            {currentDiscount > 0 && (
              <div className="auto-discount-banner">
                Automatic Discount: <strong>{currentDiscount}% OFF</strong>
              </div>
            )}
          </section>

          {/* Professional Image Upload Section */}
          <section className="admin-form-section">
            <h3>Product Images <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666' }}>(Max 2MB per image)</span></h3>

            <div className="admin-image-upload-wrapper">
              <label className="admin-btn-secondary admin-upload-trigger">
                + UPLOAD IMAGES
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={onSelectFiles}
                  style={{ display: 'none' }}
                />
              </label>
              <p className="admin-helper-text">Accepts JPG, PNG, WEBP, AVIF. Validation runs instantly.</p>
            </div>

            <div className="admin-images-grid">
              {/* Existing Images */}
              {existingImages.map((img, idx) => (
                <div key={'existing-' + idx} className={`admin-image-card ${img.isPrimary ? 'is-primary' : ''}`}>
                  <img src={img.url} alt="Stored Product Preview" className="admin-image-thumb" />
                  <div className="admin-image-meta">
                    <div className="admin-image-status">Active Store Image</div>

                    <div className="admin-image-actions">
                      {!img.isPrimary && (
                        <button onClick={() => setPrimaryImage('existing', idx)} className="btn-set-primary">Make Primary</button>
                      )}
                      {img.isPrimary && <span className="primary-label">PRIMARY</span>}
                      <button onClick={() => removeExistingImage(idx)} className="btn-remove-image">Remove</button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pending Images */}
              {pendingImages.map((fileObj, idx) => (
                <div key={'pending-' + idx} className={`admin-image-card pending-card ${fileObj.isPrimary ? 'is-primary' : ''}`}>
                  <img src={fileObj.preview} alt="Upload Preview" className="admin-image-thumb" />
                  <div className="admin-image-meta">
                    <strong>{fileObj.name}</strong>
                    <div className="admin-image-size">Size: {formatSize(fileObj.size)} ✅</div>

                    <div className="admin-image-actions">
                      {!fileObj.isPrimary && (
                        <button onClick={() => setPrimaryImage('pending', idx)} className="btn-set-primary">Make Primary</button>
                      )}
                      {fileObj.isPrimary && <span className="primary-label">PRIMARY</span>}
                      <button onClick={() => removePendingImage(idx)} className="btn-remove-image">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {existingImages.length === 0 && pendingImages.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', background: '#f5f5f4', borderRadius: '8px', color: '#78716c' }}>
                No images selected yet. Please upload at least one image.
              </div>
            )}
          </section>

          {/* Colors & Variants (Preserved) */}
          <section className="admin-form-section">
            <h3>Colors</h3>
            <div className="admin-color-pills">
              {formData.colors.map(c => (
                <div key={c.name} className="admin-color-pill">
                  <span className="color-dot" style={{ background: c.hex }}></span>
                  {c.name}
                  <button onClick={() => handleRemoveColor(c.name)}>x</button>
                </div>
              ))}
            </div>
            <div className="admin-add-color-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <select
                value={selectedStandardColor}
                onChange={handleStandardColorChange}
                style={{ width: '100%', padding: '12px', border: '1px solid #e7e5e4', borderRadius: '8px', marginBottom: '8px', background: '#fff', fontSize: '14px' }}
              >
                {STANDARD_COLORS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder="Color Name (e.g. Black)" value={newColorName} onChange={(e) => setNewColorName(e.target.value)} />
                <input type="color" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} className="color-picker-input" />
                <button type="button" className="admin-btn-secondary" onClick={handleAddColor}>ADD</button>
              </div>
            </div>
          </section>

          {/* Sizes & Inventory Section */}
          <section className="admin-form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, paddingBottom: 0, border: 'none' }}>📦 Sizes & Inventory Management</h3>
                <p className="admin-helper-text" style={{ margin: '4px 0 0' }}>
                  Smart category sizing (Clothes in sizes, Perfumes in ml, Accessories in Free Size). Fully customizable with bulk stock options.
                </p>
              </div>
              <span style={{ padding: '4px 10px', background: '#f1f5f9', color: '#0f172a', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: '1px solid #cbd5e1' }}>
                Mode: {formData.categoryId || 'Shirts'} ({((formData.categoryId || '').toLowerCase().includes('perfume')) ? 'Volumes in ml' : (formData.categoryId === 'Jeans' || formData.categoryId === 'Trousers') ? 'Waist Inches' : 'Apparel / Standard'})
              </span>
            </div>

            {/* Target Color Selector (Only if colors are defined) */}
            {formData.colors.length > 0 ? (
              <div style={{ padding: '14px 18px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Managing sizes for color:</label>
                  <select 
                    value={selectedVariantColor || formData.colors[0]?.name} 
                    onChange={(e) => setSelectedVariantColor(e.target.value)}
                    disabled={applyToAllColors}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 700, background: '#fff' }}
                  >
                    {formData.colors.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={applyToAllColors} 
                    onChange={(e) => setApplyToAllColors(e.target.checked)} 
                    style={{ width: '16px', height: '16px', accentColor: '#0f172a' }}
                  />
                  Apply added sizes & stock to ALL colors at once
                </label>
              </div>
            ) : (
              <div style={{ padding: '10px 16px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>
                💡 Standard Mode (No color variation required for {formData.categoryId || 'this product'} — you can add sizes directly!)
              </div>
            )}

            {/* Step 1: 1-Click Quick Add Common Sizes */}
            {(() => {
              const activeCat = formData.categoryId || 'Shirts';
              const batchPresets = COMMON_BATCH_SIZES[activeCat] || COMMON_BATCH_SIZES['DEFAULT'];
              return (
                <div style={{ padding: '16px 20px', background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '10px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <strong style={{ fontSize: '13.5px', color: '#1c1917', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⚡ 1-Click Batch Add Popular Sizes:
                      </strong>
                      <span style={{ fontSize: '12.5px', color: '#78716c' }}>
                        Popular for {activeCat}: ({batchPresets.join(', ')})
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#44403c' }}>Stock each:</span>
                      <input 
                        type="number" 
                        min="0" 
                        value={initialStockInput} 
                        onChange={(e) => setInitialStockInput(parseInt(e.target.value, 10) || 0)}
                        style={{ width: '70px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', textAlign: 'center', background: '#fff' }}
                      />
                      <button 
                        type="button" 
                        onClick={() => handleBatchAddSizes(batchPresets, initialStockInput)}
                        className="admin-btn-secondary"
                        style={{ padding: '7px 14px', fontSize: '12.5px', fontWeight: 700, background: '#0f172a', color: '#fff', cursor: 'pointer' }}
                      >
                        + Add All {batchPresets.length} Sizes Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Step 2: Category Preset Chips & Custom Size Input */}
            {(() => {
              const activeCat = formData.categoryId || 'Shirts';
              const catSizes = CATEGORY_SIZES_MAP[activeCat] || CATEGORY_SIZES_MAP['Shirts'];
              const isPerfume = (activeCat || '').toLowerCase().includes('perfume');
              return (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1c1917', marginBottom: '8px' }}>
                    Or Pick Individual {isPerfume ? 'Volumes (ml)' : 'Sizes'}:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    {catSizes.map(sz => {
                      const targetCol = getTargetColors()[0] || 'Standard';
                      const alreadyAdded = formData.variants.some(v => v.color === targetCol && v.size === sz);
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => handleAddSizeWithStock(sz, initialStockInput)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            border: alreadyAdded ? '1px solid #86efac' : '1px solid #cbd5e1',
                            background: alreadyAdded ? '#f0fdf4' : '#ffffff',
                            color: alreadyAdded ? '#15803d' : '#334155',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s'
                          }}
                        >
                          {alreadyAdded ? '✓ ' + sz : '+ ' + sz}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Size Form */}
                  <form onSubmit={handleAddCustomSize} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', padding: '14px 18px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Custom Size:</span>
                    <input
                      type="text"
                      placeholder={isPerfume ? "e.g. 250ml or 100ml Tester" : "e.g. 44 Slim or Custom Fit or XXL"}
                      value={customSizeName}
                      onChange={(e) => setCustomSizeName(e.target.value)}
                      style={{ flex: '1', minWidth: '180px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Stock:</span>
                    <input
                      type="number"
                      min="0"
                      value={customSizeStock}
                      onChange={(e) => setCustomSizeStock(parseInt(e.target.value, 10) || 0)}
                      style={{ width: '70px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', textAlign: 'center', background: '#fff' }}
                    />
                    <button
                      type="submit"
                      className="admin-btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 700, background: '#1e293b', color: '#fff', cursor: 'pointer' }}
                    >
                      + Add Custom Size
                    </button>
                  </form>
                </div>
              );
            })()}

            {/* Step 3: Variants Table with Multiple Stocks and Bulk Updater */}
            {formData.variants.length > 0 ? (
              <div style={{ marginTop: '24px' }}>
                {/* Bulk Set All Stocks Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    ⚡ Multiple Stock Manager:
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12.5px', color: '#475569' }}>Set stock for ALL sizes to:</span>
                    <input
                      type="number"
                      min="0"
                      value={bulkStockToApply}
                      onChange={(e) => setBulkStockToApply(parseInt(e.target.value, 10) || 0)}
                      style={{ width: '70px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', textAlign: 'center', background: '#fff' }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyBulkStock}
                      style={{ padding: '6px 14px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ⚡ Apply to All ({formData.variants.length}) Sizes
                    </button>
                  </div>
                </div>

                {/* Responsive Table Wrapper */}
                <div className="admin-table-scroll-wrapper">
                  <table className="admin-variant-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {formData.colors.length > 0 && <th>COLOR</th>}
                        <th>SIZE / VOLUME</th>
                        <th>SKU</th>
                        <th>STOCK QUANTITY (LIVE)</th>
                        <th>STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.variants.map((v) => (
                        <tr key={v.id}>
                          {formData.colors.length > 0 && (
                            <td><strong>{v.color}</strong></td>
                          )}
                          <td>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                              {v.size}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>{v.sku}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="number"
                                min="0"
                                value={v.stock}
                                onChange={(e) => updateVariantStock(v.id, e.target.value)}
                                style={{ width: '85px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '14px', background: '#fff' }}
                              />
                              <span style={{ fontSize: '12px', color: '#64748b' }}>units</span>
                            </div>
                          </td>
                          <td>
                            {(parseInt(v.stock, 10) || 0) > 0 ? (
                              <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '12px' }}>
                                ✓ In Stock
                              </span>
                            ) : (
                              <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '12px' }}>
                                ⚠ Out of Stock
                              </span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="admin-btn-text text-danger"
                              onClick={() => removeVariant(v.id)}
                              style={{ fontSize: '12px' }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="admin-total-stock-banner" style={{ marginTop: '16px' }}>
                  TOTAL PRODUCT STOCK (ALL SIZES COMBINED): <strong>{calculatedTotalStock} UNITS</strong>
                </div>
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', background: '#fafaf9', borderRadius: '8px', border: '1px dashed #d6d3d1', color: '#78716c' }}>
                <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 600 }}>No sizes added yet for this product.</p>
                <p style={{ margin: 0, fontSize: '12.5px' }}>Click any preset size chip above or click <strong>"1-Click Batch Add"</strong> to instantly initialize all sizes with stock.</p>
              </div>
            )}
          </section>

          <section className="admin-form-section">
            <h3>Limited-Time Sale Offer</h3>
            <label className="admin-checkbox-param">
              <input type="checkbox" name="offerEnabled" checked={formData.offerEnabled} onChange={handleChange} />
              Enable Limited-Time Offer?
            </label>
            {formData.offerEnabled && (
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Offer Start Date</label>
                  <input type="datetime-local" name="offerStartAt" value={formData.offerStartAt} onChange={handleChange} />
                </div>
                <div className="admin-form-group">
                  <label>Offer End Date</label>
                  <input type="datetime-local" name="offerEndAt" value={formData.offerEndAt} onChange={handleChange} />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar: Publishing */}
        <div className="admin-form-sidebar">
          <section className="admin-form-section">
            <h3>Publishing</h3>
            <label className="admin-checkbox-param highlight-checkbox">
              <input type="checkbox" name="active" checked={formData.active} onChange={handleChange} />
              ACTIVE (Visible on Store)
            </label>
          </section>

          <div className="admin-form-actions-bottom" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '32px' }}>
            <button
              onClick={handleSave}
              disabled={submitting}
              className="admin-btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '15px' }}
            >
              {submitting ? 'SAVING - DO NOT CLOSE...' : (isEdit ? '✓ SAVE CHANGES' : '🚀 PUBLISH PRODUCT')}
            </button>
            {submitting && (
              <p style={{ fontSize: '12px', color: '#78716c', textAlign: 'center', marginTop: '-8px' }}>
                Uploading images to ImageKit securely...
              </p>
            )}
            <button
              onClick={() => navigate('/admin/products')}
              className="admin-btn-secondary"
              style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '15px' }}
              disabled={submitting}
            >
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
