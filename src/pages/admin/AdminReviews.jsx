import { useState, useEffect } from 'react';
import { getAdminReviews, deleteReview, getAdminProducts } from '../../services/adminService';
import { submitReview } from '../../services/reviewService';
import { businessInfo } from '../../config/business';
import { useAdminUI } from '../../context/AdminUIContext';
import './AdminReviews.css';

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const { showToast, showConfirm } = useAdminUI();

  // Create Review Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [newReview, setNewReview] = useState({
    productId: '',
    productName: '',
    productSlug: '',
    userName: '',
    userEmail: '',
    rating: 5,
    comment: '',
    recommend: true,
    verifiedPurchase: true
  });

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const [reviewData, productData] = await Promise.all([
        getAdminReviews(),
        getAdminProducts().catch(() => [])
      ]);
      setReviews(reviewData || []);
      setProducts(productData || []);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Review',
      message: 'Are you sure you want to delete this customer review? It will be removed from the store.',
      confirmText: 'Delete Review',
      cancelText: 'Cancel',
      isDestructive: true
    });

    if (confirmed) {
      await deleteReview(id);
      showToast('Review deleted successfully.', 'success');
      fetchReviews();
    }
  };

  const handleCopyReviewLink = () => {
    const link = `${window.location.origin}/shop`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      showToast('Store review & catalog link copied to clipboard!', 'success');
    }
  };

  const handleCreateReview = async (e) => {
    e.preventDefault();
    if (!newReview.comment.trim()) {
      showToast('Please enter a review comment.', 'warning');
      return;
    }

    setSubmittingReview(true);
    try {
      // Find selected product info if chosen
      const selectedProd = products.find(p => p.id === newReview.productId);
      const payload = {
        ...newReview,
        productId: newReview.productId || 'general-store',
        productName: selectedProd?.name || newReview.productName || 'General Store Review',
        productSlug: selectedProd?.slug || '',
        userName: newReview.userName.trim() || 'Verified Customer',
        rating: Number(newReview.rating) || 5
      };

      await submitReview(payload);
      showToast('New review added successfully!', 'success');
      setShowAddModal(false);
      setNewReview({
        productId: '',
        productName: '',
        productSlug: '',
        userName: '',
        userEmail: '',
        rating: 5,
        comment: '',
        recommend: true,
        verifiedPurchase: true
      });
      fetchReviews();
    } catch (err) {
      console.error('Error submitting review:', err);
      showToast('Failed to add review: ' + err.message, 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const [previewImg, setPreviewImg] = useState(null);

  return (
    <div className="admin-reviews-page">
      {/* Header with Direct Review Action Links */}
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '24px' }}>
        <div>
          <h1 className="admin-title">Customer Reviews ({reviews.length})</h1>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0' }}>
            Manage verified store feedback and open direct review links for customers.
          </p>
        </div>

        {/* Action Buttons: Direct Links & Write Review */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Write / Add Review Button */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="admin-btn-primary"
            style={{ padding: '9px 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            ⭐ Write / Add Review
          </button>

          {/* Direct Google Review Link */}
          {businessInfo.googleMapsUrl && (
            <a
              href={businessInfo.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-action-btn"
              style={{
                padding: '9px 16px',
                background: '#0f172a',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📍 Google Review Page ↗
            </a>
          )}

          {/* Copy Direct Review Link */}
          <button
            type="button"
            onClick={handleCopyReviewLink}
            style={{
              padding: '9px 16px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📋 Copy Review Link
          </button>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>AUTHOR</th>
              <th>RATING</th>
              <th>RECOMMENDS</th>
              <th>PHOTOS</th>
              <th>COMMENT</th>
              <th>PRODUCT & DIRECT LINK</th>
              <th>DATE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{textAlign: 'center', padding: '40px'}}>Loading reviews...</td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan="8" style={{textAlign: 'center', padding: '40px'}}>No customer reviews found.</td></tr>
            ) : reviews.map(r => (
              <tr key={r.id}>
                <td>
                  <strong>{r.userName || r.author || 'Anonymous'}</strong>
                  {r.userEmail && <div style={{ fontSize: '11px', color: '#64748b' }}>{r.userEmail}</div>}
                  {r.verifiedPurchase !== false && (
                    <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 600 }}>✓ Verified</span>
                  )}
                </td>
                <td>
                  <span style={{color: '#f59e0b', fontWeight: 'bold', fontSize: '15px'}}>
                    {'★'.repeat(Number(r.rating) || 5)}
                  </span>
                </td>
                <td>
                  {r.recommend !== false ? (
                    <span style={{ color: '#15803d', fontWeight: 600, background: '#f0fdf4', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      👍 Yes
                    </span>
                  ) : (
                    <span style={{ color: '#b91c1c', fontWeight: 600, background: '#fef2f2', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      👎 No
                    </span>
                  )}
                </td>
                <td>
                  {r.images && r.images.length > 0 ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {r.images.map((img, i) => (
                        <img 
                          key={i} 
                          src={img} 
                          alt="Review attachment" 
                          style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                          onClick={() => setPreviewImg(img)}
                          title="Click to view full photo"
                        />
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>None</span>
                  )}
                </td>
                <td style={{ maxWidth: '280px', fontSize: '13px', lineHeight: '1.4' }}>{r.comment || r.reviewText}</td>
                <td>
                  <div><strong>{r.productName || 'General Store Review'}</strong></div>
                  {/* Direct Link to Open Review Form on the Storefront */}
                  <a
                    href={r.productSlug ? `/product/${r.productSlug}#reviews` : '/shop'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11.5px',
                      color: '#2563eb',
                      fontWeight: 600,
                      textDecoration: 'none',
                      marginTop: '4px'
                    }}
                  >
                    Open Review Form ↗
                  </a>
                </td>
                <td style={{fontSize: '12px', whiteSpace: 'nowrap'}}>
                  {r.dateFormatted || (r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString('en-IN') : 'Recent')}
                </td>
                <td>
                  <button onClick={() => handleDelete(r.id)} className="admin-action-btn delete">
                    DELETE
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Write / Add Direct Review */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '520px',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                ✍️ Add Customer Review
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReview} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Product Select */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                  Select Product (or Store Review):
                </label>
                <select
                  value={newReview.productId}
                  onChange={(e) => setNewReview({ ...newReview, productId: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="">🌟 General Store Review (All Products)</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Star Rating */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                  Rating (1 to 5 Stars):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewReview({ ...newReview, rating: star })}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: newReview.rating >= star ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                        background: newReview.rating >= star ? '#fef3c7' : '#f8fafc',
                        color: newReview.rating >= star ? '#b45309' : '#94a3b8',
                        fontSize: '16px',
                        cursor: 'pointer'
                      }}
                    >
                      ★ {star}
                    </button>
                  ))}
                </div>
              </div>

              {/* Author Name */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                  Reviewer Name:
                </label>
                <input
                  type="text"
                  value={newReview.userName}
                  onChange={(e) => setNewReview({ ...newReview, userName: e.target.value })}
                  placeholder="e.g. Rahul Patel"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Review Comment */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                  Review Comment:
                </label>
                <textarea
                  rows="3"
                  value={newReview.comment}
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  placeholder="Describe fabric quality, fitting, and overall customer satisfaction..."
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Recommends Product */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="recommend-check"
                  checked={newReview.recommend}
                  onChange={(e) => setNewReview({ ...newReview, recommend: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="recommend-check" style={{ fontSize: '13px', cursor: 'pointer' }}>
                  Customer recommends this product / store (👍)
                </label>
              </div>

              {/* Verified Purchase Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="verified-check"
                  checked={newReview.verifiedPurchase}
                  onChange={(e) => setNewReview({ ...newReview, verifiedPurchase: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="verified-check" style={{ fontSize: '13px', cursor: 'pointer' }}>
                  Mark as Verified Purchase (✓)
                </label>
              </div>

              {/* Submit / Cancel Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '10px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="admin-btn-primary"
                  style={{ padding: '10px 22px', fontSize: '13px' }}
                >
                  {submittingReview ? 'Submitting...' : '✓ Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {previewImg && (
        <div 
          onClick={() => setPreviewImg(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'pointer' }}
        >
          <img src={previewImg} alt="Preview" style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </div>
  );
}

