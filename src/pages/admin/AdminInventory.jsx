import { useState, useEffect } from 'react';
import { getAdminProducts, updateProductVariantStock } from '../../services/adminService';
import './AdminInventory.css';

export default function AdminInventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [savingId, setSavingId] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    const data = await getAdminProducts();
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleStockChange = (productId, variantId, newStock) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const updatedVariants = (p.variants || []).map(v => 
          v.id === variantId ? { ...v, stock: parseInt(newStock, 10) || 0 } : v
        );
        const newTotalStock = updatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
        return { ...p, variants: updatedVariants, stock: newTotalStock };
      }
      return p;
    }));
  };

  const handleSaveStock = async (product) => {
    setSavingId(product.id);
    await updateProductVariantStock(product.id, product.variants || [], product.stock || 0);
    setSavingId(null);
    alert(`Inventory for "${product.name}" saved!`);
  };

  const filtered = products.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-inventory-page">
      <div className="admin-header">
        <h1 className="admin-title">Quick Inventory & Stock Manager</h1>
      </div>

      <div className="admin-inventory-controls">
        <input 
          type="text" 
          placeholder="Search inventory by product name or SKU..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="admin-search-input"
        />
      </div>

      {loading ? (
        <p>Loading inventory...</p>
      ) : (
        <div className="admin-inventory-grid">
          {filtered.map(product => (
            <div key={product.id} className="inventory-card">
              <div className="inventory-card-header">
                <div>
                  <h3 className="inventory-product-title">{product.name}</h3>
                  <span className="inventory-product-sku">SKU: {product.sku || 'N/A'}</span>
                </div>
                <div className="inventory-total-badge">
                  Total Stock: <strong>{product.stock || 0}</strong>
                </div>
              </div>

              {(!product.variants || product.variants.length === 0) ? (
                <div style={{padding: '16px 0', color: '#666', fontSize: '13px'}}>
                  No color/size variants defined. Edit product to add variants.
                </div>
              ) : (
                <div className="inventory-variants-list">
                  {product.variants.map(v => (
                    <div key={v.id} className="inventory-variant-item">
                      <span className="variant-label">
                        {v.color} - <strong>{v.size}</strong> ({v.sku})
                      </span>
                      <input 
                        type="number" 
                        min="0"
                        value={v.stock}
                        onChange={(e) => handleStockChange(product.id, v.id, e.target.value)}
                        className="variant-stock-input"
                      />
                    </div>
                  ))}
                </div>
              )}

              <button 
                onClick={() => handleSaveStock(product)}
                disabled={savingId === product.id}
                className="admin-btn-primary"
                style={{width: '100%', marginTop: '16px', justifyContent: 'center'}}
              >
                {savingId === product.id ? 'SAVING...' : 'SAVE STOCK'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
