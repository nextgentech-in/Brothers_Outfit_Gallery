import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminProducts, deactivateProduct, deleteProduct, toggleProductTrending } from '../../services/adminService';
import { useAdminUI } from '../../context/AdminUIContext';
import './AdminProducts.css';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'trending' | 'sale' | 'inactive'
  const [togglingId, setTogglingId] = useState(null);
  const { showToast, showConfirm } = useAdminUI();

  const fetchProducts = async () => {
    setLoading(true);
    const data = await getAdminProducts();
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleToggleTrending = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    setTogglingId(id);
    // Optimistic UI update
    setProducts(prev => prev.map(p => p.id === id ? { ...p, isTrending: newStatus } : p));
    try {
      await toggleProductTrending(id, newStatus);
      showToast(newStatus ? 'Product marked as Trending!' : 'Product removed from Trending.', 'success');
    } catch (err) {
      console.error('Failed to toggle trending status:', err);
      // Rollback on error
      setProducts(prev => prev.map(p => p.id === id ? { ...p, isTrending: currentStatus } : p));
      showToast('Failed to update trending status. Please check your connection.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeactivate = async (id) => {
    const confirmed = await showConfirm({
      title: 'Deactivate Product',
      message: 'Are you sure you want to deactivate this product? It will be hidden from customer storefront.',
      confirmText: 'Deactivate',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      await deactivateProduct(id);
      showToast('Product deactivated successfully.', 'success');
      fetchProducts();
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Permanently Delete Product',
      message: 'WARNING: Are you sure you want to PERMANENTLY delete this product? This action cannot be undone.',
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      isDestructive: true
    });

    if (confirmed) {
      await deleteProduct(id);
      showToast('Product deleted permanently.', 'success');
      fetchProducts();
    }
  };

  // Counts for filter pills
  const trendingCount = products.filter(p => p.isTrending === true).length;
  const saleCount = products.filter(p => p.offerEnabled === true).length;
  const inactiveCount = products.filter(p => p.active === false).length;

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.categoryId?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'trending') return p.isTrending === true;
    if (filterType === 'sale') return p.offerEnabled === true;
    if (filterType === 'inactive') return p.active === false;
    return true;
  });

  return (
    <div className="admin-products">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Products</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
            Manage catalog, pricing, inventory stock and homepage trending placement.
          </p>
        </div>
        <Link to="/admin/products/new" className="admin-btn-primary">
          + ADD PRODUCT
        </Link>
      </div>

      <div className="admin-products-controls" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <input 
            type="text" 
            placeholder="Search products by name, SKU or category..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-search-input"
            style={{ flex: 1, minWidth: '260px' }}
          />

          {/* Quick Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFilterType('all')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: filterType === 'all' ? '1px solid #0f172a' : '1px solid #cbd5e1',
                background: filterType === 'all' ? '#0f172a' : '#ffffff',
                color: filterType === 'all' ? '#ffffff' : '#334155',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              All ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('trending')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: filterType === 'trending' ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                background: filterType === 'trending' ? '#fef3c7' : '#ffffff',
                color: filterType === 'trending' ? '#b45309' : '#334155',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🔥 Trending ({trendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('sale')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: filterType === 'sale' ? '1px solid #dc2626' : '1px solid #cbd5e1',
                background: filterType === 'sale' ? '#fee2e2' : '#ffffff',
                color: filterType === 'sale' ? '#b91c1c' : '#334155',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🏷️ Sale ({saleCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('inactive')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: filterType === 'inactive' ? '1px solid #64748b' : '1px solid #cbd5e1',
                background: filterType === 'inactive' ? '#f1f5f9' : '#ffffff',
                color: filterType === 'inactive' ? '#0f172a' : '#64748b',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Inactive ({inactiveCount})
            </button>
          </div>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>PRODUCT</th>
              <th>CATEGORY</th>
              <th>MRP</th>
              <th>SALE PRICE</th>
              <th>SIZES</th>
              <th>TOTAL STOCK</th>
              <th>TRENDING</th>
              <th>SALE</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="10" style={{textAlign: 'center', padding: '40px'}}>Loading products...</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  {filterType === 'trending' ? 'No products currently marked as Trending. Click "+ Add to Trending" on any product below!' : 'No products found.'}
                </td>
              </tr>
            ) : filteredProducts.map(p => {
              const activeMrp = p.mrp || p.compareAtPrice || 0;
              const activeSalePrice = p.salePrice || p.price || 0;
              const hasDiscount = activeMrp > activeSalePrice;
              const discount = hasDiscount ? Math.round(((activeMrp - activeSalePrice) / activeMrp) * 100) : 0;
              
              // Evaluate dynamic sizes directly from attached variants
              let sizesDisplay = "-";
              if (p.variants && p.variants.length > 0) {
                 const uniqueSizes = [...new Set(p.variants.map(v => v.size))];
                 sizesDisplay = uniqueSizes.join(', ');
              } else if (p.sizes?.length > 0) {
                 sizesDisplay = p.sizes.join(', ');
              }

              // Evaluate dynamic Stock from attached variants inherently overriding raw product level properties natively
              let totalStock = p.stock || 0;
              if (p.variants && p.variants.length > 0) {
                  totalStock = p.variants.reduce((acc, v) => acc + (parseInt(v.stock, 10) || 0), 0);
              }

              return (
                <tr key={p.id}>
                  <td>
                    <div className="admin-table-product-name">{p.name || 'Unnamed'}</div>
                    <div className="admin-table-sku">SKU: {p.sku || 'N/A'}</div>
                  </td>
                  <td>{p.category || p.categoryId || 'N/A'}</td>
                  <td className="admin-table-mrp">
                    {activeMrp ? `₹${activeMrp.toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td className="admin-table-sale-price">
                    {activeSalePrice ? `₹${activeSalePrice.toLocaleString('en-IN')}` : '-'}
                    {hasDiscount && <div className="admin-discount-badge">{discount}% OFF</div>}
                  </td>
                  <td>{sizesDisplay}</td>
                  <td>
                    <span className={`admin-stock-badge ${totalStock === 0 ? 'stock-out' : (totalStock <= 5 ? 'stock-low' : 'stock-in')}`}>
                      {totalStock}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={togglingId === p.id}
                      onClick={() => handleToggleTrending(p.id, p.isTrending)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        border: p.isTrending ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                        background: p.isTrending ? '#fef3c7' : '#ffffff',
                        color: p.isTrending ? '#b45309' : '#64748b',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: togglingId === p.id ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                      title={p.isTrending ? "Click to remove from Trending" : "Click to feature in Trending"}
                    >
                      {togglingId === p.id ? '...' : (p.isTrending ? '🔥 Trending' : '+ Add')}
                    </button>
                  </td>
                  <td>
                    {p.offerEnabled ? <span className="admin-badge admin-badge--sale">Active</span> : <span className="admin-badge admin-badge--neutral">None</span>}
                  </td>
                  <td>
                    {p.active ? <span className="admin-badge admin-badge--active">Active</span> : <span className="admin-badge admin-badge--inactive">Inactive</span>}
                  </td>
                  <td className="admin-table-actions">
                    <Link to={`/admin/products/${p.id}/edit`} className="admin-action-btn edit">EDIT</Link>
                    {p.active ? (
                        <button onClick={() => handleDeactivate(p.id)} className="admin-action-btn deactivate">DEACTIVATE</button>
                    ) : (
                        <button onClick={() => handleDelete(p.id)} className="admin-action-btn delete">DELETE</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
