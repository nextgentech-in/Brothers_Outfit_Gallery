import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAdminProducts, getCachedAdminProducts, updateProductVariantStock } from '../../services/adminService';
import { useAdminUI } from '../../context/AdminUIContext';
import './AdminInventory.css';

export default function AdminInventory() {
  // 1. Instant loading from cache: 0ms initial render if data exists in cache
  const cachedInitial = useMemo(() => getCachedAdminProducts() || [], []);
  const [products, setProducts] = useState(cachedInitial);
  const [loading, setLoading] = useState(cachedInitial.length === 0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Controls & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'low' | 'out' | 'in'
  const [sortBy, setSortBy] = useState('low_first'); // 'low_first' | 'out_first' | 'high_first' | 'name_asc' | 'newest'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  
  // Pagination
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // Expanded variant rows in Table view (Set of product IDs)
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Editing & Dirty State
  const [savingId, setSavingId] = useState(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [dirtyProductIds, setDirtyProductIds] = useState(new Set());
  const fileInputRef = useRef(null);

  const { showToast, showConfirm } = useAdminUI();

  const getProductImage = (p) => {
    if (p.thumbnailUrl && typeof p.thumbnailUrl === 'string' && p.thumbnailUrl.trim()) return p.thumbnailUrl;
    if (p.image && typeof p.image === 'string' && p.image.trim()) return p.image;
    if (Array.isArray(p.images) && p.images.length > 0) {
      const first = p.images[0];
      if (typeof first === 'string' && first.trim()) return first;
      if (first && typeof first.url === 'string' && first.url.trim()) return first.url;
    }
    return '/images/hero.png';
  };

  // Fetch products with SWR behavior (silent background refresh if already hydrated)
  const fetchProducts = useCallback(async (forceRefresh = false) => {
    try {
      if (products.length === 0 || forceRefresh) {
        setLoading(true);
      } else {
        setIsSyncing(true);
      }
      const data = await getAdminProducts(forceRefresh);
      setProducts(data);
      // Reset dirty set only if not mid-edit
      setDirtyProductIds(prev => {
        // preserve dirty IDs if any products were actively edited
        return prev.size > 0 ? prev : new Set();
      });
    } catch (err) {
      console.error(err);
      showToast('Failed to load inventory', 'error');
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [products.length, showToast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Bulk save all modified products
  const handleBulkSave = useCallback(async () => {
    if (dirtyProductIds.size === 0) {
      showToast('No unsaved stock changes.', 'info');
      return;
    }

    const modifiedProducts = products.filter(p => dirtyProductIds.has(p.id));
    const confirmed = await showConfirm({
      title: 'Save All Inventory Changes',
      message: `Save updated stock counts for ${modifiedProducts.length} modified product(s)?`,
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
      showToast(`Successfully saved ${modifiedProducts.length} product(s)!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to bulk save inventory', 'error', 7000, {
        label: 'Retry',
        onClick: () => handleBulkSave()
      });
    } finally {
      setIsBulkSaving(false);
    }
  }, [dirtyProductIds, products, showConfirm, showToast]);

  // Keyboard shortcut Ctrl+S / Cmd+S for bulk save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (dirtyProductIds.size > 0) {
          e.preventDefault();
          handleBulkSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dirtyProductIds.size, handleBulkSave]);

  // Collect unique categories for quick filtering
  const categoriesList = useMemo(() => {
    const set = new Set();
    products.forEach(p => {
      if (p.category && typeof p.category === 'string') {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [products]);

  // Stock update handler
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

  // Quick Stepper (+/- step)
  const handleStepStock = (productId, variantId, delta) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const updatedVariants = (p.variants || []).map(v => {
          if (v.id === variantId) {
            const current = Number(v.stock || 0);
            const stepped = Math.max(0, current + delta);
            return { ...v, stock: stepped };
          }
          return v;
        });
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

  // Direct product total stock update (if no variants defined)
  const handleSimpleStockChange = (productId, newStock) => {
    const stockVal = Math.max(0, parseInt(newStock, 10) || 0);
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { ...p, stock: stockVal };
      }
      return p;
    }));
    setDirtyProductIds(prev => {
      const next = new Set(prev);
      next.add(productId);
      return next;
    });
  };

  const handleSimpleStepStock = (productId, delta) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const current = Number(p.stock || 0);
        const stepped = Math.max(0, current + delta);
        return { ...p, stock: stepped };
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
    setSavingId(product.id);
    // Optimistic UI update: remove dirty marker immediately
    setDirtyProductIds(prev => {
      const next = new Set(prev);
      next.delete(product.id);
      return next;
    });
    showToast(`Inventory for "${product.name}" saved!`, 'success');

    try {
      await updateProductVariantStock(product.id, product.variants || [], product.stock || 0);
    } catch (err) {
      console.error('Failed to save inventory stock:', err);
      // Rollback on failure
      setDirtyProductIds(prev => {
        const next = new Set(prev);
        next.add(product.id);
        return next;
      });
      showToast(err.message || 'Failed to save inventory', 'error', 7000, {
        label: 'Retry',
        onClick: () => handleSaveStock(product)
      });
    } finally {
      setSavingId(null);
    }
  };

  // Toggle row expansion in table view
  const toggleRowExpansion = (productId) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const expandAllRows = () => {
    setExpandedRows(new Set(products.map(p => p.id)));
  };

  const collapseAllRows = () => {
    setExpandedRows(new Set());
  };

  // CSV Export
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

  // CSV Import
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
          message: `Found stock updates for ${targetCount} product(s) in CSV. Apply these counts now?`,
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

        await fetchProducts(true);
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

  // Quick stats
  const stats = useMemo(() => {
    let totalItems = products.length;
    let totalStockUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inStockCount = 0;

    products.forEach(p => {
      const stock = p.stock || 0;
      totalStockUnits += stock;
      if (stock === 0) outOfStockCount++;
      else if (stock <= 5) lowStockCount++;
      else inStockCount++;
    });

    return { totalItems, totalStockUnits, lowStockCount, outOfStockCount, inStockCount };
  }, [products]);

  // Filtering & Sorting
  const filteredAndSorted = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const list = products.filter(p => {
      // Category match
      if (selectedCategory !== 'all' && (p.category || '').toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Stock status filter
      const totalStock = p.stock || 0;
      if (filterMode === 'low' && (totalStock === 0 || totalStock > 5)) return false;
      if (filterMode === 'out' && totalStock !== 0) return false;
      if (filterMode === 'in' && totalStock <= 5) return false;

      // Search match
      if (q) {
        const nameMatch = p.name?.toLowerCase().includes(q);
        const skuMatch = p.sku?.toLowerCase().includes(q);
        const catMatch = p.category?.toLowerCase().includes(q);
        const variantMatch = (p.variants || []).some(v => 
          v.color?.toLowerCase().includes(q) ||
          v.size?.toLowerCase().includes(q) ||
          v.sku?.toLowerCase().includes(q)
        );
        if (!nameMatch && !skuMatch && !catMatch && !variantMatch) return false;
      }

      return true;
    });

    // Sort order
    return list.sort((a, b) => {
      const stockA = a.stock || 0;
      const stockB = b.stock || 0;
      if (sortBy === 'low_first') return stockA - stockB;
      if (sortBy === 'out_first') {
        if (stockA === 0 && stockB !== 0) return -1;
        if (stockB === 0 && stockA !== 0) return 1;
        return stockA - stockB;
      }
      if (sortBy === 'high_first') return stockB - stockA;
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      // newest (default fallback)
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
  }, [products, searchTerm, selectedCategory, filterMode, sortBy]);

  // Pagination calculation
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredAndSorted.length / pageSize) || 1;
  const currentSafePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    if (pageSize === 'all') return filteredAndSorted;
    const startIndex = (currentSafePage - 1) * pageSize;
    return filteredAndSorted.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSorted, currentSafePage, pageSize]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, filterMode, sortBy, pageSize]);

  return (
    <div className="admin-inventory-page">
      {/* Top Header Bar */}
      <div className="admin-header">
        <div>
          <div className="admin-header-title-row">
            <h1 className="admin-title">Inventory & Stock Manager</h1>
            {isSyncing && <span className="admin-syncing-pill">⚡ Syncing...</span>}
          </div>
          <p className="admin-subtitle">
            High-density quick stock editor. Update quantities instantly without unnecessary scrolling.
          </p>
        </div>

        <div className="admin-inventory-actions">
          <button
            type="button"
            className="admin-btn-secondary"
            onClick={() => fetchProducts(true)}
            title="Refresh latest stock from database"
          >
            🔄 Refresh
          </button>

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
            📥 Import CSV
          </button>
          <button
            type="button"
            className="admin-btn-secondary"
            onClick={handleExportCSV}
            title="Download full catalog inventory as CSV"
          >
            📤 Export CSV
          </button>

          {dirtyProductIds.size > 0 && (
            <button
              type="button"
              className="admin-btn-primary admin-btn-pulse"
              onClick={handleBulkSave}
              disabled={isBulkSaving}
            >
              {isBulkSaving ? 'SAVING ALL...' : `💾 SAVE ALL (${dirtyProductIds.size})`}
            </button>
          )}
        </div>
      </div>

      {/* Floating Save Reminder when edits are pending */}
      {dirtyProductIds.size > 0 && (
        <div className="inventory-dirty-bar">
          <div className="dirty-bar-content">
            <span className="dirty-bar-icon">⚠️</span>
            <span>You have <strong>{dirtyProductIds.size}</strong> unsaved product stock changes. Press <em>Ctrl+S</em> or click to save.</span>
          </div>
          <div className="dirty-bar-actions">
            <button 
              type="button" 
              className="dirty-btn-save" 
              onClick={handleBulkSave}
              disabled={isBulkSaving}
            >
              {isBulkSaving ? 'Saving...' : `Save All Changes (${dirtyProductIds.size})`}
            </button>
            <button 
              type="button" 
              className="dirty-btn-discard" 
              onClick={() => {
                fetchProducts(true);
                setDirtyProductIds(new Set());
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Quick Metrics Bar */}
      <div className="inventory-metrics-strip">
        <div className="metric-chip">
          <span className="metric-chip-label">Total Products</span>
          <span className="metric-chip-val">{stats.totalItems}</span>
        </div>
        <div className="metric-chip">
          <span className="metric-chip-label">Total Stock Units</span>
          <span className="metric-chip-val text-brand">{stats.totalStockUnits.toLocaleString()}</span>
        </div>
        <div 
          className={`metric-chip metric-chip-clickable ${filterMode === 'low' ? 'metric-chip--active' : ''}`}
          onClick={() => setFilterMode(prev => prev === 'low' ? 'all' : 'low')}
          title="Click to filter low stock items"
        >
          <span className="metric-chip-label">⚠️ Low Stock (≤ 5)</span>
          <span className="metric-chip-val text-warn">{stats.lowStockCount}</span>
        </div>
        <div 
          className={`metric-chip metric-chip-clickable ${filterMode === 'out' ? 'metric-chip--active' : ''}`}
          onClick={() => setFilterMode(prev => prev === 'out' ? 'all' : 'out')}
          title="Click to filter out of stock items"
        >
          <span className="metric-chip-label">🚫 Out of Stock</span>
          <span className="metric-chip-val text-danger">{stats.outOfStockCount}</span>
        </div>
        <div 
          className={`metric-chip metric-chip-clickable ${filterMode === 'in' ? 'metric-chip--active' : ''}`}
          onClick={() => setFilterMode(prev => prev === 'in' ? 'all' : 'in')}
          title="Click to filter in-stock items"
        >
          <span className="metric-chip-label">✅ In Stock</span>
          <span className="metric-chip-val text-success">{stats.inStockCount}</span>
        </div>
      </div>

      {/* Practical Controls Bar: Search, Category, Stock Filters, Sorting & View Toggle */}
      <div className="admin-inventory-toolbar">
        <div className="toolbar-search-row">
          <div className="toolbar-search-box">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Quick search by product name, SKU, color or size..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="toolbar-search-input"
            />
            {searchTerm && (
              <button 
                type="button" 
                className="clear-search-btn" 
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="toolbar-select-wrapper">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="toolbar-select"
            >
              <option value="all">All Categories ({categoriesList.length})</option>
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="toolbar-select-wrapper">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="toolbar-select"
            >
              <option value="low_first">⚠️ Low Stock First</option>
              <option value="out_first">🚫 Out of Stock First</option>
              <option value="high_first">📦 Highest Stock First</option>
              <option value="name_asc">🔤 Name (A - Z)</option>
              <option value="newest">🆕 Newest Added</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="view-mode-toggle" role="group" aria-label="View Mode">
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Compact Table View (Practical & Fast)"
            >
              📋 Table
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Card Grid View"
            >
              🔲 Grid
            </button>
          </div>
        </div>

        {/* Filter Pills & Table Controls */}
        <div className="toolbar-filter-row">
          <div className="inventory-filter-pills" role="tablist">
            <button
              type="button"
              className={`inventory-pill ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All ({products.length})
            </button>
            <button
              type="button"
              className={`inventory-pill inventory-pill--warn ${filterMode === 'low' ? 'active' : ''}`}
              onClick={() => setFilterMode('low')}
            >
              ⚠️ Low Stock ({stats.lowStockCount})
            </button>
            <button
              type="button"
              className={`inventory-pill inventory-pill--danger ${filterMode === 'out' ? 'active' : ''}`}
              onClick={() => setFilterMode('out')}
            >
              🚫 Out of Stock ({stats.outOfStockCount})
            </button>
            <button
              type="button"
              className={`inventory-pill inventory-pill--success ${filterMode === 'in' ? 'active' : ''}`}
              onClick={() => setFilterMode('in')}
            >
              ✅ In Stock ({stats.inStockCount})
            </button>
          </div>

          {viewMode === 'table' && (
            <div className="table-quick-expands">
              <button type="button" className="text-link-btn" onClick={expandAllRows}>
                Expand All Variants
              </button>
              <span className="divider-dot">•</span>
              <button type="button" className="text-link-btn" onClick={collapseAllRows}>
                Collapse All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="admin-loading-state">
          <div className="admin-spinner" />
          <p>Loading inventory catalog...</p>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="admin-empty-inventory">
          <span style={{ fontSize: '36px' }}>🔍</span>
          <p>No products match your current filters or search term.</p>
          {(searchTerm || filterMode !== 'all' || selectedCategory !== 'all') && (
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={() => {
                setSearchTerm('');
                setFilterMode('all');
                setSelectedCategory('all');
              }}
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* COMPACT TABLE VIEW (Practical, high-density, no excessive scrolling) */
        <div className="inventory-table-container">
          <table className="inventory-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th style={{ minWidth: '240px' }}>Product</th>
                <th style={{ width: '110px' }}>Category</th>
                <th style={{ width: '130px' }}>Total Stock</th>
                <th style={{ minWidth: '320px' }}>Variant Stock (Quick Editor)</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map(product => {
                const isDirty = dirtyProductIds.has(product.id);
                const totalStock = product.stock || 0;
                const isLow = totalStock > 0 && totalStock <= 5;
                const isOut = totalStock === 0;
                const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
                const isExpanded = expandedRows.has(product.id);

                return (
                  <tr 
                    key={product.id} 
                    className={`inventory-table-row ${isDirty ? 'row--dirty' : ''} ${isOut ? 'row--out' : ''} ${isLow ? 'row--low' : ''}`}
                  >
                    {/* Expand/Collapse Toggle Button */}
                    <td className="cell-toggle">
                      {hasVariants && (
                        <button
                          type="button"
                          className="row-expand-btn"
                          onClick={() => toggleRowExpansion(product.id)}
                          title={isExpanded ? 'Collapse variants' : 'Expand all variants'}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      )}
                    </td>

                    {/* Product Info */}
                    <td className="cell-product">
                      <div className="product-media-combo">
                        <img 
                          src={getProductImage(product)} 
                          alt={product.name} 
                          className="product-tiny-thumb"
                          loading="lazy"
                        />
                        <div className="product-info-texts">
                          <Link 
                            to={`/admin/products/${product.id}`}
                            className="product-name-link"
                            title="Edit full product details"
                          >
                            {product.name}
                          </Link>
                          <span className="product-sku-tag">
                            SKU: <strong>{product.sku || 'N/A'}</strong>
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="cell-category">
                      <span className="category-pill-tag">
                        {product.category || 'General'}
                      </span>
                    </td>

                    {/* Total Stock Badge */}
                    <td className="cell-stock">
                      <div className="stock-badge-group">
                        <span className={`stock-level-badge ${isOut ? 'badge-danger' : isLow ? 'badge-warn' : 'badge-healthy'}`}>
                          {isOut ? '0 (Out)' : isLow ? `${totalStock} (Low)` : `${totalStock} units`}
                        </span>
                      </div>
                    </td>

                    {/* Variant Stock Quick Editor */}
                    <td className="cell-variants">
                      {!hasVariants ? (
                        <div className="simple-stock-control">
                          <span className="simple-stock-label">Direct Stock:</span>
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleSimpleStepStock(product.id, -1)}
                            disabled={totalStock <= 0}
                            title="Decrease by 1"
                          >
                            –
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={totalStock}
                            onChange={(e) => handleSimpleStockChange(product.id, e.target.value)}
                            className="compact-stock-input"
                            aria-label={`Stock for ${product.name}`}
                          />
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleSimpleStepStock(product.id, 1)}
                            title="Increase by 1"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="variant-editor-container">
                          {/* Inline chips view when collapsed; multi-row grid when expanded */}
                          <div className={`variant-chips-wrap ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
                            {product.variants.map(v => {
                              const vStock = Number(v.stock || 0);
                              const isVariantLow = vStock > 0 && vStock <= 5;
                              const isVariantOut = vStock === 0;

                              return (
                                <div 
                                  key={v.id} 
                                  className={`variant-compact-pill ${isVariantOut ? 'v-pill--out' : isVariantLow ? 'v-pill--low' : ''}`}
                                >
                                  <span className="v-pill-label" title={`${v.color} - ${v.size} ${v.sku ? `(${v.sku})` : ''}`}>
                                    {v.color} / <strong>{v.size}</strong>
                                  </span>
                                  <div className="v-pill-stepper">
                                    <button
                                      type="button"
                                      className="mini-step-btn"
                                      onClick={() => handleStepStock(product.id, v.id, -1)}
                                      disabled={vStock <= 0}
                                      title="Subtract 1"
                                    >
                                      –
                                    </button>
                                    <input 
                                      type="number" 
                                      min="0"
                                      value={v.stock}
                                      onChange={(e) => handleStockChange(product.id, v.id, e.target.value)}
                                      className={`v-stock-field ${isVariantOut ? 'field-danger' : isVariantLow ? 'field-warn' : ''}`}
                                      aria-label={`Stock for ${v.color} ${v.size}`}
                                    />
                                    <button
                                      type="button"
                                      className="mini-step-btn"
                                      onClick={() => handleStepStock(product.id, v.id, 1)}
                                      title="Add 1"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {!isExpanded && product.variants.length > 4 && (
                            <button
                              type="button"
                              className="more-variants-badge"
                              onClick={() => toggleRowExpansion(product.id)}
                            >
                              +{product.variants.length - 4} more
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="cell-actions">
                      <div className="row-action-btns">
                        <button
                          type="button"
                          onClick={() => handleSaveStock(product)}
                          disabled={savingId === product.id}
                          className={`row-save-btn ${isDirty ? 'btn--dirty' : ''}`}
                          title={isDirty ? 'Save stock modifications' : 'Synced'}
                        >
                          {savingId === product.id ? '...' : isDirty ? '💾 Save' : '✓'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARD GRID VIEW (Optimized with compact padding) */
        <div className="admin-inventory-grid">
          {paginatedProducts.map(product => {
            const isDirty = dirtyProductIds.has(product.id);
            const totalStock = product.stock || 0;
            const isLow = totalStock > 0 && totalStock <= 5;
            const isOut = totalStock === 0;

            return (
              <div 
                key={product.id} 
                className={`inventory-card ${isDirty ? 'inventory-card--dirty' : ''} ${isOut ? 'inventory-card--out' : ''} ${isLow ? 'inventory-card--low' : ''}`}
              >
                <div className="inventory-card-header">
                  <div className="card-header-left">
                    <img 
                      src={getProductImage(product)} 
                      alt={product.name} 
                      className="card-thumb"
                      loading="lazy"
                    />
                    <div>
                      <Link to={`/admin/products/${product.id}`} className="inventory-product-title">
                        {product.name}
                      </Link>
                      <div className="card-sub-info">
                        <span className="inventory-product-sku">SKU: {product.sku || 'N/A'}</span>
                        {product.category && <span className="card-category-tag">{product.category}</span>}
                      </div>
                    </div>
                  </div>
                  <div className={`inventory-total-badge ${isOut ? 'badge-danger' : isLow ? 'badge-warn' : ''}`}>
                    {isOut ? 'Out of Stock' : isLow ? `Low (${totalStock})` : `${totalStock} units`}
                  </div>
                </div>

                {(!product.variants || product.variants.length === 0) ? (
                  <div className="card-simple-stock">
                    <span className="variant-label">Product Stock Quantity</span>
                    <div className="v-pill-stepper">
                      <button
                        type="button"
                        className="mini-step-btn"
                        onClick={() => handleSimpleStepStock(product.id, -1)}
                        disabled={totalStock <= 0}
                      >
                        –
                      </button>
                      <input 
                        type="number" 
                        min="0"
                        value={totalStock}
                        onChange={(e) => handleSimpleStockChange(product.id, e.target.value)}
                        className="v-stock-field"
                      />
                      <button
                        type="button"
                        className="mini-step-btn"
                        onClick={() => handleSimpleStepStock(product.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="inventory-variants-list">
                    {product.variants.map(v => {
                      const vStock = Number(v.stock || 0);
                      return (
                        <div key={v.id} className="inventory-variant-item">
                          <span className="variant-label">
                            {v.color} - <strong>{v.size}</strong> {v.sku ? `(${v.sku})` : ''}
                          </span>
                          <div className="v-pill-stepper">
                            <button
                              type="button"
                              className="mini-step-btn"
                              onClick={() => handleStepStock(product.id, v.id, -1)}
                              disabled={vStock <= 0}
                            >
                              –
                            </button>
                            <input 
                              type="number" 
                              min="0"
                              value={v.stock}
                              onChange={(e) => handleStockChange(product.id, v.id, e.target.value)}
                              className={`variant-stock-input ${vStock <= 5 ? 'variant-stock-input--warn' : ''}`}
                              aria-label={`Stock for ${v.color} ${v.size}`}
                            />
                            <button
                              type="button"
                              className="mini-step-btn"
                              onClick={() => handleStepStock(product.id, v.id, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button 
                  type="button"
                  onClick={() => handleSaveStock(product)}
                  disabled={savingId === product.id}
                  className={`admin-btn-primary ${isDirty ? 'admin-btn--highlight' : ''}`}
                  style={{ width: '100%', marginTop: '14px', justifyContent: 'center' }}
                >
                  {savingId === product.id ? 'SAVING...' : isDirty ? '💾 SAVE CHANGES' : 'STOCK SYNCED'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer Controls */}
      <div className="inventory-pagination-footer">
        <div className="pagination-info">
          Showing <strong>{filteredAndSorted.length === 0 ? 0 : (currentPage - 1) * (pageSize === 'all' ? filteredAndSorted.length : pageSize) + 1}</strong>
          {' – '}
          <strong>{pageSize === 'all' ? filteredAndSorted.length : Math.min(currentPage * pageSize, filteredAndSorted.length)}</strong>
          {' of '}
          <strong>{filteredAndSorted.length}</strong> products
          {filteredAndSorted.length !== products.length && ` (filtered from ${products.length} total)`}
        </div>

        <div className="pagination-controls">
          <div className="page-size-selector">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="page-size-select"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value="all">All</option>
            </select>
          </div>

          {pageSize !== 'all' && totalPages > 1 && (
            <div className="pagination-buttons">
              <button
                type="button"
                className="page-nav-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
              >
                ◀ Prev
              </button>

              <div className="page-number-chips">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => {
                  // Show limited page chips if many pages
                  if (
                    num === 1 || 
                    num === totalPages || 
                    (num >= currentPage - 2 && num <= currentPage + 2)
                  ) {
                    return (
                      <button
                        key={num}
                        type="button"
                        className={`page-num-btn ${num === currentPage ? 'active' : ''}`}
                        onClick={() => setCurrentPage(num)}
                      >
                        {num}
                      </button>
                    );
                  } else if (
                    num === currentPage - 3 || 
                    num === currentPage + 3
                  ) {
                    return <span key={num} className="page-ellipsis">…</span>;
                  }
                  return null;
                })}
              </div>

              <button
                type="button"
                className="page-nav-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
              >
                Next ▶
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
