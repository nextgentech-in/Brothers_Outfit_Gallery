import { useState, useEffect, useMemo, useRef } from 'react';
import { getAdminProducts, updateProductVariantStock } from '../../services/adminService';
import { useAdminUI } from '../../context/AdminUIContext';
import './AdminInventory.css';

export default function AdminInventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'low' | 'out'
  const [savingId, setSavingId] = useState(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [dirtyProductIds, setDirtyProductIds] = useState(new Set());
  const fileInputRef = useRef(null);

  const { showToast, showConfirm } = useAdminUI();

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getAdminProducts();
      setProducts(data);
      setDirtyProductIds(new Set());
    } catch (err) {
      console.error(err);
      showToast('Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleStockChange = (productId, variantId, newStock) => {
    const stockVal = Math.max(0, parseInt(newStock, 10) || 0);

    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const updatedVariants = (p.variants || []).map(v => 
          v.id === variantId ? { ...v, stock: stockVal } : v
        );
        const newTotalStock = updatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
        return { ...p, variants: updatedVariants, stock: newTotalStock };
      }
      return p;
    }));

    setDirtyProductIds(prev => {
      const next = new Set(prev);
      next.add(productId);
      return next;
    });
  };

  const handleSaveStock = async (product) => {
    try {
      setSavingId(product.id);
      await updateProductVariantStock(product.id, product.variants || [], product.stock || 0);
      setDirtyProductIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
      showToast(`Inventory for "${product.name}" saved!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save inventory', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // Bulk save all modified products
  const handleBulkSave = async () => {
    if (dirtyProductIds.size === 0) {
      showToast('No unsaved stock changes.', 'info');
      return;
    }

    const modifiedProducts = products.filter(p => dirtyProductIds.has(p.id));
    const confirmed = await showConfirm({
      title: 'Bulk Update Inventory',
      message: `Save changes for ${modifiedProducts.length} modified product(s)?`,
      confirmText: 'Save All Changes',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    try {
      setIsBulkSaving(true);
      await Promise.all(
        modifiedProducts.map(p =>
          updateProductVariantStock(p.id, p.variants || [], p.stock || 0)
        )
      );
      setDirtyProductIds(new Set());
      showToast(`Successfully updated ${modifiedProducts.length} product(s)!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to bulk save inventory', 'error');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // CSV Export: Formats all products and their variants into a downloadable CSV
  const handleExportCSV = () => {
    if (!products || products.length === 0) {
      showToast('No products available to export', 'info');
      return;
    }

    const headers = ['Product ID', 'Product Name', 'SKU', 'Category', 'Total Stock', 'Variant ID', 'Color', 'Size', 'Variant SKU', 'Variant Stock'];
    const rows = [];

    products.forEach(p => {
      const pId = `"${(p.id || '').replace(/"/g, '""')}"`;
      const pName = `"${(p.name || '').replace(/"/g, '""')}"`;
      const pSku = `"${(p.sku || '').replace(/"/g, '""')}"`;
      const pCat = `"${(p.category || '').replace(/"/g, '""')}"`;
      const pTotalStock = p.stock || 0;

      if (!p.variants || p.variants.length === 0) {
        rows.push([pId, pName, pSku, pCat, pTotalStock, '""', '""', '""', '""', pTotalStock].join(','));
      } else {
        p.variants.forEach(v => {
          const vId = `"${(v.id || '').replace(/"/g, '""')}"`;
          const vColor = `"${(v.color || '').replace(/"/g, '""')}"`;
          const vSize = `"${(v.size || '').replace(/"/g, '""')}"`;
          const vSku = `"${(v.sku || '').replace(/"/g, '""')}"`;
          const vStock = v.stock || 0;
          rows.push([pId, pName, pSku, pCat, pTotalStock, vId, vColor, vSize, vSku, vStock].join(','));
        });
      }
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `brothers-inventory-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Inventory exported to CSV!', 'success');
  };

  // CSV Import: Reads CSV file and applies variant stock counts
  const handleImportCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        if (!text) return;

        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          showToast('CSV file is empty or missing data rows', 'warning');
          return;
        }

        // Simple CSV line parser taking quotes into account
        const parseLine = (line) => {
          const result = [];
          let cur = '';
          let insideQuote = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
              if (insideQuote && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                insideQuote = !insideQuote;
              }
            } else if (c === ',' && !insideQuote) {
              result.push(cur.trim());
              cur = '';
            } else {
              cur += c;
            }
          }
          result.push(cur.trim());
          return result;
        };

        const parsedRows = lines.slice(1).map(parseLine);
        const updatesByProductId = {};

        parsedRows.forEach(cols => {
          if (cols.length < 10) return;
          const [pId, , , , , vId, , , , vStockStr] = cols;
          const cleanPId = pId.replace(/^"|"$/g, '');
          const cleanVId = vId.replace(/^"|"$/g, '');
          const stockVal = Math.max(0, parseInt(vStockStr.replace(/^"|"$/g, ''), 10) || 0);

          if (!cleanPId) return;
          if (!updatesByProductId[cleanPId]) {
            updatesByProductId[cleanPId] = {};
          }
          if (cleanVId) {
            updatesByProductId[cleanPId][cleanVId] = stockVal;
          }
        });

        const targetCount = Object.keys(updatesByProductId).length;
        if (targetCount === 0) {
          showToast('No valid product stock entries found in CSV', 'error');
          return;
        }

        const confirmed = await showConfirm({
          title: 'Import CSV Inventory',
          message: `Found stock updates for ${targetCount} product(s) in CSV. Do you want to apply these counts now?`,
          confirmText: 'Apply Import',
          cancelText: 'Cancel'
        });

        if (!confirmed) return;

        setIsBulkSaving(true);
        let updatedCount = 0;

        for (const [prodId, variantUpdates] of Object.entries(updatesByProductId)) {
          const targetProduct = products.find(p => p.id === prodId);
          if (targetProduct) {
            const updatedVariants = (targetProduct.variants || []).map(v => {
              if (variantUpdates[v.id] !== undefined) {
                return { ...v, stock: variantUpdates[v.id] };
              }
              return v;
            });
            const newTotal = updatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
            await updateProductVariantStock(prodId, updatedVariants, newTotal);
            updatedCount++;
          }
        }

        await fetchProducts();
        showToast(`Successfully imported and updated ${updatedCount} products!`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Error parsing CSV file: ' + err.message, 'error');
      } finally {
        setIsBulkSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  // Filter products by search and low/out-of-stock criteria
  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const totalStock = p.stock || 0;
      if (filterMode === 'low') {
        return totalStock > 0 && totalStock <= 5;
      }
      if (filterMode === 'out') {
        return totalStock === 0;
      }
      return true;
    });
  }, [products, searchTerm, filterMode]);

  const lowStockCount = useMemo(() => {
    return products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 5).length;
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter(p => (p.stock || 0) === 0).length;
  }, [products]);

  return (
    <div className="admin-inventory-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Quick Inventory & Stock Manager</h1>
          <p className="admin-subtitle">Update variant quantities, monitor low-stock warnings, and import/export CSV</p>
        </div>

        <div className="admin-inventory-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="admin-btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            title="Import inventory stock from CSV file"
          >
            📥 IMPORT CSV
          </button>
          <button
            type="button"
            className="admin-btn-secondary"
            onClick={handleExportCSV}
            title="Download full catalog inventory as CSV"
          >
            📤 EXPORT CSV
          </button>
          {dirtyProductIds.size > 0 && (
            <button
              type="button"
              className="admin-btn-primary"
              onClick={handleBulkSave}
              disabled={isBulkSaving}
            >
              {isBulkSaving ? 'SAVING ALL...' : `💾 SAVE ALL CHANGES (${dirtyProductIds.size})`}
            </button>
          )}
        </div>
      </div>

      {/* Control Bar: Search & Stock Status Filters */}
      <div className="admin-inventory-controls">
        <input 
          type="text" 
          placeholder="Search inventory by product name or SKU..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="admin-search-input"
        />

        <div className="inventory-filter-pills" role="tablist">
          <button
            type="button"
            className={`inventory-pill ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All Products ({products.length})
          </button>
          <button
            type="button"
            className={`inventory-pill inventory-pill--warn ${filterMode === 'low' ? 'active' : ''}`}
            onClick={() => setFilterMode('low')}
          >
            ⚠️ Low Stock ({lowStockCount})
          </button>
          <button
            type="button"
            className={`inventory-pill inventory-pill--danger ${filterMode === 'out' ? 'active' : ''}`}
            onClick={() => setFilterMode('out')}
          >
            🚫 Out of Stock ({outOfStockCount})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading-state">
          <div className="admin-spinner" />
          <p>Loading catalog inventory...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty-inventory">
          <p>No products match your current search and stock filter.</p>
          {(searchTerm || filterMode !== 'all') && (
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={() => {
                setSearchTerm('');
                setFilterMode('all');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="admin-inventory-grid">
          {filtered.map(product => {
            const isDirty = dirtyProductIds.has(product.id);
            const isLow = (product.stock || 0) > 0 && (product.stock || 0) <= 5;
            const isOut = (product.stock || 0) === 0;

            return (
              <div 
                key={product.id} 
                className={`inventory-card ${isDirty ? 'inventory-card--dirty' : ''} ${isOut ? 'inventory-card--out' : ''} ${isLow ? 'inventory-card--low' : ''}`}
              >
                <div className="inventory-card-header">
                  <div>
                    <h3 className="inventory-product-title">{product.name}</h3>
                    <span className="inventory-product-sku">SKU: {product.sku || 'N/A'}</span>
                  </div>
                  <div className={`inventory-total-badge ${isOut ? 'badge-danger' : isLow ? 'badge-warn' : ''}`}>
                    {isOut ? 'Out of Stock' : isLow ? `Low Stock (${product.stock})` : `Total: ${product.stock || 0}`}
                  </div>
                </div>

                {(!product.variants || product.variants.length === 0) ? (
                  <div style={{ padding: '16px 0', color: '#666', fontSize: '13px' }}>
                    No color/size variants defined. Edit product in Products manager.
                  </div>
                ) : (
                  <div className="inventory-variants-list">
                    {product.variants.map(v => (
                      <div key={v.id} className="inventory-variant-item">
                        <span className="variant-label">
                          {v.color} - <strong>{v.size}</strong> {v.sku ? `(${v.sku})` : ''}
                        </span>
                        <input 
                          type="number" 
                          min="0"
                          value={v.stock}
                          onChange={(e) => handleStockChange(product.id, v.id, e.target.value)}
                          className={`variant-stock-input ${(v.stock || 0) <= 5 ? 'variant-stock-input--warn' : ''}`}
                          aria-label={`Stock for ${v.color} ${v.size}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button 
                  type="button"
                  onClick={() => handleSaveStock(product)}
                  disabled={savingId === product.id}
                  className={`admin-btn-primary ${isDirty ? 'admin-btn--highlight' : ''}`}
                  style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
                >
                  {savingId === product.id ? 'SAVING...' : isDirty ? '💾 SAVE CHANGES' : 'SAVE STOCK'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
