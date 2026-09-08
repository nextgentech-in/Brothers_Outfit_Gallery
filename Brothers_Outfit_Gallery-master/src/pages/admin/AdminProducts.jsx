import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminProducts, deactivateProduct, deleteProduct } from '../../services/adminService';
import './AdminProducts.css';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    const data = await getAdminProducts();
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDeactivate = async (id) => {
    if (window.confirm("Are you sure you want to deactivate this product?")) {
      await deactivateProduct(id);
      fetchProducts();
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("WARNING: Are you sure you want to PERMANENTLY delete this product?")) {
      await deleteProduct(id);
      fetchProducts();
    }
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-products">
      <div className="admin-header">
        <h1 className="admin-title">Products</h1>
        <Link to="/admin/products/new" className="admin-btn-primary">
          + ADD PRODUCT
        </Link>
      </div>

      <div className="admin-products-controls">
        <input 
          type="text" 
          placeholder="Search products by name or SKU..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="admin-search-input"
        />
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
              <th>SALE</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="10" style={{textAlign: 'center', padding: '40px'}}>Loading products...</td></tr>
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
