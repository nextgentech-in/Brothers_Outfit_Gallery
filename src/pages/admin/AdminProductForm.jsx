import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createProduct, updateProduct, getAdminProductById, deleteProductImage, generateProductId } from '../../services/adminService';
import './AdminProductForm.css';

import { getBackendUrl } from '../../utils/apiConfig';

const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
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
  const [selectedVariantSize, setSelectedVariantSize] = useState('');

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
  }

  const handleAddVariant = () => {
    if (!selectedVariantColor || !selectedVariantSize) return alert('Select color and size');

    const exists = formData.variants.find(v => v.color === selectedVariantColor && v.size === selectedVariantSize);
    if (exists) return alert('Variant combination already exists!');

    const newVariant = {
      id: `${selectedVariantColor}-${selectedVariantSize}-${Date.now()}`,
      color: selectedVariantColor,
      size: selectedVariantSize,
      sku: `${formData.sku || 'PRD'}-${selectedVariantColor[0].toUpperCase()}-${selectedVariantSize}`,
      stock: 0
    };

    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, newVariant]
    }));
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

    let hasErrors = false;
    const newPending = [];
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/jpg'];

    files.forEach((file) => {
      if (!validTypes.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|avif)$/i)) {
        alert(`${file.name}: Please upload a JPG, PNG, WEBP or AVIF image.`);
        hasErrors = true;
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name}: Image must be 2 MB or smaller.`);
        hasErrors = true;
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

  const checkEnsurePrimaryFlags = (allCount) => {
    // Safety check before publish
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
        const backendUrl = getBackendUrl();

        for (let i = 0; i < pendingImages.length; i++) {
          const authRes = await fetch(`${backendUrl}/api/imagekit/auth`);
          if (!authRes.ok) throw new Error("Failed to get ImageKit auth params. Ensure backend is running.");
          const { token, signature, expire } = await authRes.json();

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
            try { parsedErr = JSON.parse(errText); } catch (e) { }
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
      <div className="admin-header">
        <h1 className="admin-title">{isEdit ? 'EDIT PRODUCT' : 'ADD NEW PRODUCT'}</h1>
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

          <section className="admin-form-section">
            <h3>Sizes & Inventory</h3>
            <p className="admin-helper-text">Manage stock per color/size combination to enable them on the store front.</p>

            {formData.colors.length === 0 ? (
              <p style={{ color: '#dc2626', fontSize: '13px' }}>Please add at least one color first.</p>
            ) : (
              <>
                <div className="admin-add-variant-row">
                  <select value={selectedVariantColor} onChange={(e) => setSelectedVariantColor(e.target.value)}>
                    <option value="">-- Select Color --</option>
                    {formData.colors.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <select value={selectedVariantSize} onChange={(e) => setSelectedVariantSize(e.target.value)}>
                    <option value="">-- Select Size --</option>
                    {AVAILABLE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" className="admin-btn-secondary" onClick={handleAddVariant}>+ ADD SIZE</button>
                </div>

                {formData.colors.map(color => {
                  const colorVariants = formData.variants.filter(v => v.color === color.name);
                  if (colorVariants.length === 0) return null;

                  return (
                    <div key={color.name} className="admin-variant-color-group">
                      <h4>COLOR: {color.name.toUpperCase()}</h4>
                      <table className="admin-variant-table">
                        <thead>
                          <tr>
                            <th>SIZE</th>
                            <th>SKU</th>
                            <th>STOCK QUANTITY</th>
                            <th>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {colorVariants.map(v => (
                            <tr key={v.id}>
                              <td><strong>{v.size}</strong></td>
                              <td>{v.sku}</td>
                              <td>
                                <input type="number" min="0" value={v.stock} onChange={(e) => updateVariantStock(v.id, e.target.value)} />
                              </td>
                              <td>
                                <button type="button" className="admin-btn-text text-danger" onClick={() => removeVariant(v.id)}>Remove</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}

                <div className="admin-total-stock-banner">
                  TOTAL STOCK FOR THIS PRODUCT: <strong>{calculatedTotalStock}</strong>
                </div>
              </>
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
              {submitting ? 'PUBLISHING - DO NOT CLOSE...' : 'PUBLISH PRODUCT'}
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
